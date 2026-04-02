import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import forge from "npm:node-forge@1.3.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { merchant_id, year, month } = await req.json();

    if (!merchant_id || !year || !month) {
      throw new Error("Missing merchant_id, year, or month");
    }

    // 1. Fetch Merchant Config
    const { data: config, error: configError } = await supabaseClient
      .from("merchant_einvoice_config")
      .select("*")
      .eq("merchant_id", merchant_id)
      .single();

    if (configError || !config) {
      throw new Error(`Merchant config not found: ${configError?.message}`);
    }

    // 2. Fetch Merchant Details (for address/contact)
    const { data: merchant, error: merchantError } = await supabaseClient
      .from("merchants")
      .select("*")
      .eq("id", merchant_id)
      .single();

    if (merchantError || !merchant) {
      throw new Error(`Merchant details not found: ${merchantError?.message}`);
    }

    // 3. Fetch Pending Orders for the specific month
    const monthPadded = String(month).padStart(2, "0");
    const startDate = `${year}-${monthPadded}-01T00:00:00Z`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${monthPadded}-${lastDay}T23:59:59Z`;

    const { data: orders, error: ordersError } = await supabaseClient
      .from("orders")
      .select("id, order_number, subtotal, tax_amount, total_amount, created_at")
      .eq("merchant_id", merchant_id)
      .eq("einvoice_status", "pending_buyer_request")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (ordersError) {
      throw new Error(`Error fetching orders: ${ordersError.message}`);
    }

    if (!orders || orders.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, message: "No pending orders to consolidate" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Build Consolidated LHDN Payload
    const invoiceNumber = `CON-MS-${merchant_id.substring(0, 8)}-${year}${monthPadded}`;
    const payload = buildConsolidatedPayload(config, merchant, orders, invoiceNumber);

    // 5. Sign Document
    const { signedInvoice, docDigest } = signDocument(payload, config);

    // 6. Get LHDN Token
    const token = await getLhdnToken(config);

    // 7. Submit to LHDN
    console.log(`[LHDN] Submitting consolidated invoice ${invoiceNumber} for merchant ${merchant_id} (${orders.length} orders)`);
    const lhdnResponse = await submitToLhdn(config, invoiceNumber, signedInvoice, docDigest, token);

    // 8. Record in DB and Update Orders
    const { data: einvoice, error: einvoiceError } = await supabaseClient
      .from("einvoices")
      .insert({
        merchant_id,
        order_number: invoiceNumber,
        submission_uid: lhdnResponse.submissionUID,
        lhdn_uuid: lhdnResponse.uuid,
        lhdn_long_id: lhdnResponse.longId,
        status: "submitted",
        qr_code_url: lhdnResponse.longId ? `${getApiBase(config)}/documents/${lhdnResponse.uuid}/details` : null,
      })
      .select()
      .single();

    if (einvoiceError) {
      console.error("Error saving einvoice record:", einvoiceError);
    }

    // Update orders as processed
    await supabaseClient
      .from("orders")
      .update({ einvoice_status: "sent_to_consolidated_batch" })
      .in("id", orders.map(o => o.id));

    // Audit Log
    await supabaseClient.from("einvoice_audit_log").insert({
      merchant_id,
      action: "consolidation",
      endpoint: `${getApiBase(config)}/documentsubmissions`,
      request_body: { invoice_number: invoiceNumber, orders_count: orders.length },
      response_body: lhdnResponse,
      status_code: 200,
    });

    return new Response(JSON.stringify({ success: true, data: einvoice, processed: orders.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Edge Function Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

// ─── Helper Functions ──────────────────────────────────────────────────

function getApiBase(config: any) {
  return config.env === "production"
    ? "https://api.myinvois.hasil.gov.my/api/v1.0"
    : "https://preprod-api.myinvois.hasil.gov.my/api/v1.0";
}

async function getLhdnToken(config: any) {
  const url = config.env === "production"
    ? "https://api.myinvois.hasil.gov.my/connect/token"
    : "https://preprod-api.myinvois.hasil.gov.my/connect/token";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.client_id,
      client_secret: config.client_secret,
      scope: "InvoicingAPI",
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`LHDN Token Auth Failed: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return data.access_token;
}

function buildConsolidatedPayload(config: any, merchant: any, orders: any[], invoiceNumber: string) {
  const roundMYR = (val: any) => (Math.round((parseFloat(val) || 0) * 100) / 100).toFixed(2);
  const isoDate = () => new Date().toISOString().split("T")[0];
  const isoTime = () => new Date().toISOString().split("T")[1].replace(/\..+/, "Z");

  // Aggregate orders into Line Items
  const items = orders.map((o: any, index: number) => ({
    "ID": [{ _: String(index + 1) }],
    "InvoicedQuantity": [{ _: 1, unitCode: "C62" }],
    "LineExtensionAmount": [{ _: roundMYR(o.subtotal), currencyID: "MYR" }],
    "TaxTotal": [{
      "TaxAmount": [{ _: roundMYR(o.tax_amount || 0), currencyID: "MYR" }],
      "TaxSubtotal": [{
        "TaxableAmount": [{ _: roundMYR(o.subtotal), currencyID: "MYR" }],
        "TaxAmount": [{ _: roundMYR(o.tax_amount || 0), currencyID: "MYR" }],
        "TaxCategory": [{
          "ID": [{ _: "E" }],
          "Percent": [{ _: "0.00" }],
          "TaxExemptionReason": [{ _: "Not Subject to SST" }],
          "TaxScheme": [{ "ID": [{ _: "OTH" }] }],
        }],
      }],
    }],
    "Item": [{
      "CommodityClassification": [{
        "ItemClassificationCode": [{ _: "008", listID: "CLASS" }],
      }],
      "Description": [{ _: `Receipt ${o.order_number}` }],
    }],
    "Price": [{ "PriceAmount": [{ _: roundMYR(o.subtotal), currencyID: "MYR" }] }],
  }));

  const totalSubtotal = roundMYR(orders.reduce((s, o) => s + (o.subtotal || 0), 0));
  const totalTax      = roundMYR(orders.reduce((s, o) => s + (o.tax_amount || 0), 0));
  const totalGrand    = roundMYR(orders.reduce((s, o) => s + (o.total_amount || 0), 0));

  return {
    "Invoice": [{
      "UBLVersionID": [{ _: "2.1" }],
      "CustomizationID": [{ _: "urn:cert.lhdn.gov.my:invoice" }],
      "ID": [{ _: invoiceNumber }],
      "IssueDate": [{ _: isoDate() }],
      "IssueTime": [{ _: isoTime() }],
      "InvoiceTypeCode": [{ _: "11", listVersionID: "1.0" }], // Consolidated
      "DocumentCurrencyCode": [{ _: "MYR" }],
      "TaxCurrencyCode": [{ _: "MYR" }],
      "AccountingSupplierParty": [{
        "Party": [{
          "IndustryClassificationCode": [{ _: config.msic_code || "47910", name: config.description || "Retail" }],
          "PartyIdentification": [
            { "ID": [{ _: config.tin, schemeID: "TIN" }] },
            { "ID": [{ _: config.brn, schemeID: "BRN" }] },
          ],
          "PostalAddress": [{
            "AddressLine": [{ "Line": [{ _: merchant.address_line1 || "Merchant Address" }] }],
            "PostalZone": [{ _: merchant.postcode || "00000" }],
            "CityName": [{ _: merchant.city || "Kuala Lumpur" }],
            "CountrySubentityCode": [{ _: merchant.state || "14" }],
            "Country": [{ "IdentificationCode": [{ _: "MYS", listAgencyID: "6", listID: "ISO3166-1" }] }],
          }],
          "PartyLegalEntity": [{ "RegistrationName": [{ _: merchant.store_name || "Merchant" }] }],
          "Contact": [{
            "Telephone": [{ _: merchant.phone || "00-00000000" }],
            "ElectronicMail": [{ _: merchant.email || "noreply@einvoice.my" }]
          }]
        }],
      }],
      "AccountingCustomerParty": [{
        "Party": [{
          "PartyIdentification": [
            { "ID": [{ _: "EI00000000010", schemeID: "TIN" }] },
            { "ID": [{ _: "NA", schemeID: "BRN" }] }
          ],
          "PostalAddress": [{
             "AddressLine": [{ "Line": [{ _: "N/A" }] }],
             "Country": [{ "IdentificationCode": [{ _: "MYS", listAgencyID: "6", listID: "ISO3166-1" }] }],
          }],
          "PartyLegalEntity": [{ "RegistrationName": [{ _: "General Public" }] }],
          "Contact": [{
            "Telephone": [{ _: "00-00000000" }],
            "ElectronicMail": [{ _: "customer@test.com" }]
          }]
        }],
      }],
      "TaxTotal": [{
        "TaxAmount": [{ _: totalTax, currencyID: "MYR" }],
        "TaxSubtotal": [{
          "TaxableAmount": [{ _: totalSubtotal, currencyID: "MYR" }],
          "TaxAmount": [{ _: totalTax, currencyID: "MYR" }],
          "TaxCategory": [{
            "ID": [{ _: "E" }],
            "Percent": [{ _: "0.00" }],
            "TaxExemptionReason": [{ _: "Not Subject to SST" }],
            "TaxScheme": [{ "ID": [{ _: "OTH" }] }],
          }],
        }],
      }],
      "LegalMonetaryTotal": [{
        "LineExtensionAmount": [{ _: totalSubtotal, currencyID: "MYR" }],
        "AllowanceTotalAmount": [{ _: "0.00", currencyID: "MYR" }],
        "TaxExclusiveAmount": [{ _: totalSubtotal, currencyID: "MYR" }],
        "TaxInclusiveAmount": [{ _: totalGrand, currencyID: "MYR" }],
        "PayableAmount": [{ _: totalGrand, currencyID: "MYR" }],
      }],
      "InvoiceLine": items,
    }],
  };
}

function signDocument(payload: any, config: any) {
  if (!config.cert_p12_base64) {
    return { 
      signedInvoice: injectDummySignature(payload), 
      docDigest: "DUMMY_DIGEST" 
    };
  }
  
  const md = forge.md.sha256.create();
  md.update(JSON.stringify(payload), "utf8");
  const docDigest = forge.util.encode64(md.digest().getBytes());

  return { signedInvoice: injectDummySignature(payload), docDigest };
}

function injectDummySignature(payload: any) {
  const type = Object.keys(payload)[0];
  const block = {
     UBLExtensions: [{
       UBLExtension: [{
         ExtensionURI: [{ _: "urn:oasis:names:specification:ubl:dsig:enveloped:xades" }],
         ExtensionContent: [{
           UBLDocumentSignatures: [{
             SignatureInformation: [{
               ID: [{ _: "urn:oasis:names:specification:ubl:signature:1" }],
               ReferencedSignatureID: [{ _: "urn:oasis:names:specification:ubl:signature:Invoice" }],
               "ds:Signature": [{
                 "xmlns:ds": "http://www.w3.org/2000/09/xmldsig#",
                 "ds:SignatureValue": [{ _: "SANDBOX_PLACEHOLDER" }]
               }]
             }]
           }]
         }]
       }]
     }],
     Signature: [{
       ID: [{ _: "urn:oasis:names:specification:ubl:signature:Invoice" }],
       SignatureMethod: [{ _: "urn:oasis:names:specification:ubl:dsig:enveloped:xades" }],
     }]
  };
  
  return {
    [type]: payload[type].map((inv: any) => ({ ...block, ...inv }))
  };
}

async function submitToLhdn(config: any, invoiceNumber: string, signedInvoice: any, docDigest: string, token: string) {
  const url = `${getApiBase(config)}/documentsubmissions`;
  const docString = JSON.stringify(signedInvoice);
  const b64Document = btoa(docString);
  
  const md = forge.md.sha256.create();
  md.update(docString, "utf8");
  const calculatedHash = forge.util.encode64(md.digest().getBytes());

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      documents: [{
        format: "JSON",
        document: b64Document,
        documentHash: calculatedHash,
        codeNumber: invoiceNumber,
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`LHDN Submission Failed: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return data.acceptedDocuments?.[0] || data;
}
