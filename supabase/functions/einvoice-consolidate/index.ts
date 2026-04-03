import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json"
};

const STATE_MAPPING: Record<string, string> = {
  "johor": "01", "kedah": "02", "kelantan": "03", "melaka": "04", "negeri sembilan": "05", "pahang": "06", 
  "pulau pinang": "07", "penang": "07", "perak": "08", "perlis": "09", "selangor": "10", "terengganu": "11", 
  "sabah": "12", "sarawak": "13", "kuala lumpur": "14", "labuan": "15", "putrajaya": "16"
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

    // 2. Fetch Merchant Details
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
      .select("id, order_number, subtotal, tax_amount, total_amount, created_at, delivery_fee")
      .eq("merchant_id", merchant_id)
      .eq("einvoice_status", "pending_buyer_request")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (ordersError) {
      throw new Error(`Error fetching orders: ${ordersError.message}`);
    }

    if (!orders || orders.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, message: "No pending orders to consolidate" }), {
        headers: jsonHeaders,
      });
    }

    // 4. Build Consolidated LHDN Payload
    const invoiceNumber = `CON-MS-${merchant_id.substring(0, 8)}-${year}${monthPadded}`;
    const payload = buildConsolidatedPayload(config, merchant, orders, invoiceNumber);

    // 5. Get LHDN Token
    const token = await getLhdnToken(config);

    // 6. Submit to LHDN
    console.log(`[LHDN] Submitting consolidated invoice ${invoiceNumber} for merchant ${merchant_id} (${orders.length} orders)`);
    console.log(`[LHDN] Using Supplier TIN: ${payload.Invoice[0].AccountingSupplierParty[0].Party[0].PartyIdentification[0].ID[0]._}`);
    
    // Save Audit Log Before Submission
    const { data: auditLog, error: auditErr } = await supabaseClient.from("einvoice_audit_log").insert({
      merchant_id,
      action: "consolidation",
      endpoint: "documentsubmissions",
      request_body: { invoice_number: invoiceNumber, payload, orders_count: orders.length },
      status_code: 0, // Pending
    }).select().single();
    if (auditErr) console.error("Audit log creation error:", auditErr);

    let lhdnResponse;
    try {
      lhdnResponse = await submitToLhdn(config, invoiceNumber, payload, token);
      
      if (auditLog) {
         await supabaseClient.from("einvoice_audit_log").update({
            response_body: lhdnResponse,
            status_code: 200,
         }).eq("id", auditLog.id);
      }
    } catch (lhdnErr: any) {
      if (auditLog) {
         await supabaseClient.from("einvoice_audit_log").update({
            response_body: { error: lhdnErr.message, stack: lhdnErr.stack },
            status_code: 400,
         }).eq("id", auditLog.id);
      }
      throw lhdnErr;
    }

    // 7. Record in DB and Update Orders
    const totalAmount = orders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
    const { data: einvoice, error: einvoiceError } = await supabaseClient
      .from("einvoices")
      .insert({
        merchant_id,
        order_number: invoiceNumber,
        submission_uid: lhdnResponse.submissionUID || lhdnResponse.uuid,
        lhdn_uuid: lhdnResponse.uuid,
        status: "submitted",
        invoice_type: "11", // Mark as Consolidated internally
        total_amount: totalAmount,
        orders_count: orders.length,
        submitted_at: new Date().toISOString()
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

    return new Response(JSON.stringify({ success: true, data: einvoice, processed: orders.length }), {
      headers: jsonHeaders,
    });

  } catch (error: any) {
    console.error("Edge Function Error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: jsonHeaders,
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

  // STRICT credentials handling with .trim()
  const client_id = (config.client_id || "").trim();
  const client_secret = (config.client_secret || "").trim();

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: client_id,
      client_secret: client_secret,
      scope: "InvoicingAPI",
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Token Auth Failed: ${res.status}. ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return data.access_token;
}

function buildConsolidatedPayload(config: any, merchant: any, orders: any[], invoiceNumber: string) {
  const roundMYR = (val: any) => Number((Math.round((parseFloat(val) || 0) * 100) / 100).toFixed(2));
  
  const now = new Date();
  const issueDate = now.toISOString().split("T")[0];
  const issueTime = now.getUTCHours().toString().padStart(2, "0") + ":" + 
                    now.getUTCMinutes().toString().padStart(2, "0") + ":" + 
                    now.getUTCSeconds().toString().padStart(2, "0") + "Z";

  // Use identical MSI/TIN logic as working individual submission
  const tin = config.tin?.trim() || "IG25351615030";
  const stateCode = STATE_MAPPING[merchant?.state?.toLowerCase()] || "14";
  let baseMsic = config.msic_code || "47912";
  if (baseMsic === "47910") baseMsic = "47912"; 
  const msicName = config.description || "Retail sale of any kind of product over the Internet";

  // Aggregate orders into Line Items
  const items = orders.map((o: any, index: number) => {
    const lineTotal = roundMYR(o.subtotal || 0);
    return {
      "ID": [{ _: String(index + 1) }],
      "InvoicedQuantity": [{ _: 1.0, unitCode: "C62" }],
      "LineExtensionAmount": [{ _: lineTotal, currencyID: "MYR" }],
      "TaxTotal": [{
        "TaxAmount": [{ _: 0.0, currencyID: "MYR" }],
        "TaxSubtotal": [{
          "TaxableAmount": [{ _: lineTotal, currencyID: "MYR" }],
          "TaxAmount": [{ _: 0.0, currencyID: "MYR" }],
          "TaxCategory": [{
            "ID": [{ _: "06" }], // Align with working API (Not Subject to SST)
            "Percent": [{ _: 0.0 }],
            "TaxExemptionReason": [{ _: "Not Subject to SST" }],
            "TaxScheme": [{ "ID": [{ _: "OTH" }] }],
          }],
        }],
      }],
      "Item": [{
        "CommodityClassification": [{
          "ItemClassificationCode": [{ _: "004", listID: "CLASS" }], // Align with working API (Consolidated)
        }],
        "Description": [{ _: `Receipt ${o.order_number}` }],
      }],
      "Price": [{ "PriceAmount": [{ _: lineTotal, currencyID: "MYR" }] }],
      "ItemPriceExtension": [{ "Amount": [{ _: lineTotal, currencyID: "MYR" }] }]
    };
  });

  const totalLineExtension = roundMYR(orders.reduce((s, o) => s + (o.subtotal || 0), 0));
  const totalTax      = 0.0;
  const totalGrand    = totalLineExtension;

  const partyIdentification = [{ "ID": [{ _: tin, schemeID: "TIN" }] }];
  if (config.brn && config.brn.trim() !== "" && config.brn.trim().toUpperCase() !== "NA") {
     const brn = config.brn.trim();
     const scheme = /^\d{12}$/.test(brn) ? "NRIC" : "BRN";
     partyIdentification.push({ "ID": [{ _: brn, schemeID: scheme }] });
  }

  return {
    "Invoice": [{
      "UBLVersionID": [{ _: "2.1" }],
      "CustomizationID": [{ _: "urn:cert.lhdn.gov.my:invoice" }],
      "ID": [{ _: invoiceNumber }],
      "IssueDate": [{ _: issueDate }],
      "IssueTime": [{ _: issueTime }],
      "InvoiceTypeCode": [{ _: "01", listVersionID: "1.0" }], // Standard Invoice (01) is used for Consolidated
      "DocumentCurrencyCode": [{ _: "MYR" }],
      "TaxCurrencyCode": [{ _: "MYR" }],
      "AccountingSupplierParty": [{
        "Party": [{
          "IndustryClassificationCode": [{ _: baseMsic, name: msicName }],
          "PartyIdentification": partyIdentification,
          "PostalAddress": [{
            "AddressLine": [{ "Line": [{ _: merchant?.address_line1 || "Street" }] }],
            "PostalZone": [{ _: merchant?.postcode || "50000" }],
            "CityName": [{ _: merchant?.city || "Kuala Lumpur" }],
            "CountrySubentityCode": [{ _: stateCode }],
            "Country": [{ "IdentificationCode": [{ _: "MYS", listAgencyID: "6", listID: "ISO3166-1" }] }],
          }],
          "PartyLegalEntity": [{ "RegistrationName": [{ _: merchant?.store_name || "Merchant" }] }],
          "Contact": [{
            "Telephone": [{ _: merchant?.phone || "0123456789" }],
            "ElectronicMail": [{ _: merchant?.email || "merchant@example.com" }]
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
             "CityName": [{ _: "Kuala Lumpur" }],
             "CountrySubentityCode": [{ _: "14" }],
             "Country": [{ "IdentificationCode": [{ _: "MYS", listAgencyID: "6", listID: "ISO3166-1" }] }],
          }],
          "PartyLegalEntity": [{ "RegistrationName": [{ _: "General Public" }] }],
          "Contact": [{
            "Telephone": [{ _: "000000000" }],
            "ElectronicMail": [{ _: "customer@test.com" }]
          }]
        }],
      }],
      "TaxTotal": [{
        "TaxAmount": [{ _: totalTax, currencyID: "MYR" }],
        "TaxSubtotal": [{
          "TaxableAmount": [{ _: totalLineExtension, currencyID: "MYR" }],
          "TaxAmount": [{ _: totalTax, currencyID: "MYR" }],
          "TaxCategory": [{
            "ID": [{ _: "06" }],
            "Percent": [{ _: 0.0 }],
            "TaxExemptionReason": [{ _: "Not Subject to SST" }],
            "TaxScheme": [{ "ID": [{ _: "OTH" }] }],
          }],
        }],
      }],
      "LegalMonetaryTotal": [{
        "LineExtensionAmount": [{ _: totalLineExtension, currencyID: "MYR" }],
        "AllowanceTotalAmount": [{ _: 0.0, currencyID: "MYR" }],
        "TaxExclusiveAmount": [{ _: totalLineExtension, currencyID: "MYR" }],
        "TaxInclusiveAmount": [{ _: totalGrand, currencyID: "MYR" }],
        "PayableAmount": [{ _: totalGrand, currencyID: "MYR" }],
      }],
      "InvoiceLine": items,
    }],
  };
}

async function submitToLhdn(config: any, invoiceNumber: string, payload: any, token: string) {
  const url = config.env === "production" 
    ? "https://api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions" 
    : "https://preprod-api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions";
  
  const docString = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const docBytes = encoder.encode(docString);
  
  // High-compatibility binary-to-string conversion for btoa
  let binary = "";
  for (let i = 0; i < docBytes.byteLength; i++) {
    binary += String.fromCharCode(docBytes[i]);
  }
  const b64Document = btoa(binary);
  
  // Use crypto.subtle for hashing to match working einvoice-submit logic
  const hashBuffer = await crypto.subtle.digest("SHA-256", docBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const calculatedHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

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

  const data = await res.json();
  if (!res.ok) throw new Error(`LHDN Submission Failed: ${JSON.stringify(data)}`);
  
  return data.acceptedDocuments?.[0] || data;
}
