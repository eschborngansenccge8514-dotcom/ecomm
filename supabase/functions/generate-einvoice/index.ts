import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = { 
  "Access-Control-Allow-Origin": "*", 
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" 
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { order_id, merchant_id, customer, merchant_overrides } = body;

    if (!order_id || !merchant_id) throw new Error("Missing order_id or merchant_id");

    // 1. Get Config (stored in public schema)
    const { data: config, error: configError } = await supabase
      .from("merchant_einvoice_config")
      .select("*")
      .eq("merchant_id", merchant_id)
      .single();
    
    if (configError || !config) throw new Error("E-Invoice configuration not found for this merchant. Please complete the setup in Settings.");

    // 2. Get Merchant and Order details (stored in public schema)
    const { data: merchant } = await supabase.from("merchants").select("*").eq("id", merchant_id).single();
    const { data: order } = await supabase.from("orders").select("*, order_items(*)").eq("id", order_id).single();
    if (!order) throw new Error("Order not found");

    const payload = buildLhdnPayload(config, merchant, order, customer, merchant_overrides);
    const token = await getLhdnToken(config);

    try {
      const lhdnResponse = await submitToLhdn(config, order.order_number, payload, token);
      const uuid = lhdnResponse.uuid;
      
      // 3. Optional: Poll for validation status to get LongId (needed for public share)
      let longId = null;
      let status = "submitted";
      
      const portalDomain = config.env === "production" ? "https://myinvois.hasil.gov.my" : "https://preprod.myinvois.hasil.gov.my";
      
      // Try polling up to 5 times (approx 5-10 seconds)
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 1500)); // Wait 1.5s between polls
        const details = await getDocumentDetails(config, uuid, token);
        if (details.status === "Valid") {
          longId = details.longId;
          status = "valid";
          break;
        } else if (details.status === "Invalid") {
          status = "invalid";
          break;
        }
      }

      const qr_code_url = longId 
        ? `${portalDomain}/${uuid}/share/${longId}`
        : `${portalDomain}/documents/${uuid}`;

      // 4. Save result to public.einvoices
      const { data: savedInvoice, error: saveError } = await supabase
        .from("einvoices")
        .upsert({
          merchant_id: merchant_id,
          order_id: order_id,
          order_number: order.order_number,
          lhdn_uuid: uuid,
          lhdn_long_id: longId,
          submission_uid: lhdnResponse.submissionUid || uuid,
          qr_code_url: qr_code_url,
          status: status,
          invoice_type: "01",
          submitted_at: new Date().toISOString(),
          validated_at: status === "valid" ? new Date().toISOString() : null
        }, { onConflict: 'order_id' })
        .select()
        .single();

      if (saveError) {
        console.error("Error saving to public.einvoices:", saveError);
        return new Response(JSON.stringify({ 
          success: true, 
          data: { 
            lhdn_uuid: uuid, 
            status: status,
            qr_code_url: qr_code_url,
            lhdn_long_id: longId
          },
          warning: "Database save failed but submission was successful."
        }), { headers: jsonHeaders });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        data: {
          ...savedInvoice,
          qr_code_url
        } 
      }), { headers: jsonHeaders });
    } catch (err) {
       console.error("LHDN Submission Error:", err.message);
       return new Response(JSON.stringify({ success: false, error: err.message, debug_payload: payload }), { headers: jsonHeaders, status: 400 });
    }
  } catch (error) {
    console.error("Edge Function Error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: jsonHeaders, status: 400 });
  }
});

async function getDocumentDetails(config: any, uuid: string, token: string) {
  const url = config.env === "production" 
    ? `https://api.myinvois.hasil.gov.my/api/v1.0/documents/${uuid}` 
    : `https://preprod-api.myinvois.hasil.gov.my/api/v1.0/documents/${uuid}`;
  
  const res = await fetch(url, { 
    method: "GET", 
    headers: { "Authorization": `Bearer ${token}` } 
  });
  
  if (!res.ok) return { status: "unknown" };
  return await res.json();
}

async function getLhdnToken(config: any) {
  const url = config.env === "production" ? "https://api.myinvois.hasil.gov.my/connect/token" : "https://preprod-api.myinvois.hasil.gov.my/connect/token";
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "client_credentials", client_id: config.client_id, client_secret: config.client_secret, scope: "InvoicingAPI" }) });
  if (!res.ok) throw new Error(`Token Auth Failed: ${res.status}. Check client_id/secret.`);
  const data = await res.json();
  return data.access_token;
}

function buildLhdnPayload(config: any, merchant: any, order: any, customerOverride?: any, merchantOverride?: any) {
  const roundMYR = (val: any) => Number((Math.round((parseFloat(val) || 0) * 100) / 100).toFixed(2));
  const tin = config.tin?.trim() || "IG25351615030";
  const stateCode = STATE_MAPPING[merchant?.state?.toLowerCase()] || "14";

  const now = new Date();
  const issueDate = now.toISOString().split("T")[0];
  const issueTime = now.getUTCHours().toString().padStart(2, "0") + ":" + 
                    now.getUTCMinutes().toString().padStart(2, "0") + ":" + 
                    now.getUTCSeconds().toString().padStart(2, "0") + "Z";

  let baseMsic = config.msic_code || "47912";
  if (baseMsic === "47910") baseMsic = "47912"; 
  
  const itemClassificationCode = customerOverride?.classification_code || "004"; 
  const msicCode = merchantOverride?.msic_code || baseMsic;
  
  const finalMsicCode = msicCode === "47910" ? "47912" : msicCode;
  
  const msicName = merchantOverride?.description || config.description || "Retail sale of any kind of product over the Internet";

  const items = (order.order_items || []).map((item: any, index: number) => ({
    "ID": [{ _: String(index + 1) }],
    "InvoicedQuantity": [{ _: Number(item.quantity) || 1.0, unitCode: "C62" }],
    "LineExtensionAmount": [{ _: roundMYR(item.line_total), currencyID: "MYR" }],
    "TaxTotal": [{ "TaxAmount": [{ _: 0.0, currencyID: "MYR" }], "TaxSubtotal": [{ "TaxableAmount": [{ _: roundMYR(item.line_total), currencyID: "MYR" }], "TaxAmount": [{ _: 0.0, currencyID: "MYR" }], "TaxCategory": [{ "ID": [{ _: "06" }], "Percent": [{ _: 0.0 }], "TaxExemptionReason": [{ _: "Not Subject to SST" }], "TaxScheme": [{ "ID": [{ _: "OTH" }] }] }] }] }],
    "Item": [{ 
      "CommodityClassification": [{ "ItemClassificationCode": [{ _: itemClassificationCode, listID: "CLASS" }] }], 
      "Description": [{ _: item.product_name || "Item" }] 
    }],
    "Price": [{ "PriceAmount": [{ _: roundMYR(item.unit_price), currencyID: "MYR" }] }],
    "ItemPriceExtension": [{ "Amount": [{ _: roundMYR(item.line_total), currencyID: "MYR" }] }]
  }));

  const deliveryFee = parseFloat(order.delivery_fee) || 0;
  if (deliveryFee > 0) {
    items.push({
      "ID": [{ _: String(items.length + 1) }],
      "InvoicedQuantity": [{ _: 1.0, unitCode: "C62" }],
      "LineExtensionAmount": [{ _: roundMYR(deliveryFee), currencyID: "MYR" }],
      "TaxTotal": [{ "TaxAmount": [{ _: 0.0, currencyID: "MYR" }], "TaxSubtotal": [{ "TaxableAmount": [{ _: roundMYR(deliveryFee), currencyID: "MYR" }], "TaxAmount": [{ _: 0.0, currencyID: "MYR" }], "TaxCategory": [{ "ID": [{ _: "06" }], "Percent": [{ _: 0.0 }], "TaxExemptionReason": [{ _: "Not Subject to SST" }], "TaxScheme": [{ "ID": [{ _: "OTH" }] }] }] }] }],
      "Item": [{ 
        "CommodityClassification": [{ "ItemClassificationCode": [{ _: itemClassificationCode, listID: "CLASS" }] }], 
        "Description": [{ _: "Delivery Fee" }] 
      }],
      "Price": [{ "PriceAmount": [{ _: roundMYR(deliveryFee), currencyID: "MYR" }] }],
      "ItemPriceExtension": [{ "Amount": [{ _: roundMYR(deliveryFee), currencyID: "MYR" }] }]
    });
  }

  const totalLineExtension = items.reduce((sum: number, item: any) => sum + parseFloat(item.LineExtensionAmount[0]._), 0);
  const totalPayable = totalLineExtension;

  const partyIdentification = [{ "ID": [{ _: tin, schemeID: "TIN" }] }];
  if (config.brn && config.brn.trim() !== "" && config.brn.trim().toUpperCase() !== "NA") {
     const brn = config.brn.trim();
     const scheme = /^\d{12}$/.test(brn) ? "NRIC" : "BRN";
     partyIdentification.push({ "ID": [{ _: brn, schemeID: scheme }] });
  }

  const customerTin = customerOverride?.tin || "EI00000000010";
  const customerId = customerOverride?.id_number || "NA";
  const customerIdScheme = customerOverride?.id_type || "BRN";
  const customerName = customerOverride?.name || order.buyer_name || "General Public";

  return {
    "Invoice": [{
      "UBLVersionID": [{ _: "2.1" }], 
      "CustomizationID": [{ _: "urn:cert.lhdn.gov.my:invoice" }], 
      "ID": [{ _: order.order_number }], 
      "IssueDate": [{ _: issueDate }], 
      "IssueTime": [{ _: issueTime }], 
      "InvoiceTypeCode": [{ _: "01", listVersionID: "1.0" }], 
      "DocumentCurrencyCode": [{ _: "MYR" }], 
      "TaxCurrencyCode": [{ _: "MYR" }],
      "AccountingSupplierParty": [{
        "Party": [{
          "IndustryClassificationCode": [{ _: finalMsicCode, name: msicName }],
          "PartyIdentification": partyIdentification,
          "PostalAddress": [{ 
            "AddressLine": [{ "Line": [{ _: merchant?.address_line1 || "Street" }] }], 
            "PostalZone": [{ _: merchant?.postcode || "50000" }], 
            "CityName": [{ _: merchant?.city || "Kuala Lumpur" }], 
            "CountrySubentityCode": [{ _: stateCode }], 
            "Country": [{ "IdentificationCode": [{ _: "MYS", listAgencyID: "6", listID: "ISO3166-1" }] }] 
          }],
          "PartyLegalEntity": [{ "RegistrationName": [{ _: merchant?.store_name || "Merchant" }] }],
          "Contact": [{ "Telephone": [{ _: merchant?.phone || "0123456789" }], "ElectronicMail": [{ _: merchant?.email || "merchant@example.com" }] }]
        }]
      }],
      "AccountingCustomerParty": [{ 
        "Party": [{ 
          "PartyIdentification": [{ "ID": [{ _: customerTin, schemeID: "TIN" }] }, { "ID": [{ _: customerId, schemeID: customerIdScheme }] }], 
          "PostalAddress": [{ 
            "AddressLine": [{ "Line": [{ _: "N/A" }] }], 
            "CityName": [{ _: "Kuala Lumpur" }],
            "CountrySubentityCode": [{ _: "14" }],
            "Country": [{ "IdentificationCode": [{ _: "MYS", listAgencyID: "6", listID: "ISO3166-1" }] }] 
          }], 
          "PartyLegalEntity": [{ "RegistrationName": [{ _: customerName }] }], 
          "Contact": [{ "Telephone": [{ _: order.delivery_address?.phone || "000000000" }], "ElectronicMail": [{ _: order.buyer_email || "customer@example.com" }] }] 
        }] 
      }],
      "TaxTotal": [{ 
        "TaxAmount": [{ _: 0.0, currencyID: "MYR" }], 
        "TaxSubtotal": [{ "TaxableAmount": [{ _: roundMYR(totalLineExtension), currencyID: "MYR" }], "TaxAmount": [{ _: 0.0, currencyID: "MYR" }], "TaxCategory": [{ "ID": [{ _: "06" }], "Percent": [{ _: 0.0 }], "TaxExemptionReason": [{ _: "Not Subject to SST" }], "TaxScheme": [{ "ID": [{ _: "OTH" }] }] }] }] 
      }],
      "LegalMonetaryTotal": [{ 
        "LineExtensionAmount": [{ _: roundMYR(totalLineExtension), currencyID: "MYR" }], 
        "AllowanceTotalAmount": [{ _: 0.0, currencyID: "MYR" }], 
        "TaxExclusiveAmount": [{ _: roundMYR(totalLineExtension), currencyID: "MYR" }], 
        "TaxInclusiveAmount": [{ _: roundMYR(totalLineExtension), currencyID: "MYR" }], 
        "PayableAmount": [{ _: roundMYR(totalLineExtension), currencyID: "MYR" }] 
      }],
      "InvoiceLine": items
    }]
  };
}

async function submitToLhdn(config: any, invoiceNumber: string, payload: any, token: string) {
  const url = config.env === "production" ? "https://api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions" : "https://preprod-api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions";
  const docString = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const docBytes = encoder.encode(docString);
  let binary = "";
  for (let i = 0; i < docBytes.byteLength; i++) {
    binary += String.fromCharCode(docBytes[i]);
  }
  const b64Document = btoa(binary);
  const hashBuffer = await crypto.subtle.digest("SHA-256", docBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const calculatedHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  const res = await fetch(url, { method: "POST", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ documents: [{ format: "JSON", document: b64Document, documentHash: calculatedHash, codeNumber: invoiceNumber }] }) });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data.acceptedDocuments?.[0] || data;
}
