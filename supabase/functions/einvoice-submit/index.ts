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

const roundMYR = (val: any) => Number((Math.round((parseFloat(val) || 0) * 100) / 100).toFixed(2));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.json();
    const orderId = body.order_id || body.orderId;
    const posRequestId = body.pos_request_id || body.posRequestId;
    const merchantId = body.merchant_id || body.merchantId;
    const customer = body.customer;
    const merchantOverrides = body.merchant_overrides;

    if (!merchantId || (!orderId && !posRequestId)) {
      throw new Error("Missing merchant_id, order_id, or pos_request_id");
    }

    // 1. Fetch Config
    const { data: config, error: configError } = await supabase
      .from("merchant_einvoice_config")
      .select("*")
      .eq("merchant_id", merchantId)
      .single();

    if (configError || !config) throw new Error("E-Invoice configuration not found. Please complete setup in Dashboard.");

    // 2. Fetch Merchant Details
    const { data: merchant } = await supabase.from("merchants").select("*").eq("id", merchantId).single();
    if (!merchant) throw new Error("Merchant details not found.");

    // 3. Fetch Order/Transaction Details
    let orderDetails: any = null;
    let items: any[] = [];
    let orderNumber = "";
    let deliveryFee = 0;
    let discountAmount = 0;
    let customerDataForLhdn: any = customer;

    if (orderId) {
      const { data: order } = await supabase.from("orders").select("*, order_items(*)").eq("id", orderId).single();
      if (!order) throw new Error("Order not found");
      orderDetails = order;
      orderNumber = order.order_number;
      deliveryFee = parseFloat(order.delivery_fee) || 0;
      discountAmount = parseFloat(order.discount_amount) || 0;
      items = (order.order_items || []).map((i: any) => ({
        name: i.product_name || "Item",
        quantity: parseFloat(i.quantity) || 1,
        unitPrice: parseFloat(i.unit_price) || 0,
        total: parseFloat(i.line_total) || 0
      }));
    } else {
      const { data: tx } = await supabase.from("pos_transactions").select("*").eq("id", posRequestId).single();
      if (!tx) throw new Error("POS transaction not found");
      orderDetails = tx;
      orderNumber = tx.receipt_number || `POS-${tx.id.substring(0, 8)}`;
      items = (tx.items || []).map((i: any) => ({
        name: i.name || "Item",
        quantity: parseFloat(i.quantity) || 1,
        unitPrice: parseFloat(i.price) || 0,
        total: parseFloat(i.total) || 0
      }));
      discountAmount = parseFloat(tx.discount_amount) || 0;

      // Try to fetch POS request data if no customer override provided
      if (!customerDataForLhdn && posRequestId) {
        const { data: posReq } = await supabase
          .from("pos_einvoice_requests")
          .select("*")
          .eq("transaction_id", posRequestId)
          .single();
        if (posReq) {
          customerDataForLhdn = {
            name: posReq.customer_name,
            tin: posReq.customer_tin,
            id_type: posReq.customer_id_type,
            id_number: posReq.customer_id_number,
            email: posReq.customer_email,
            address: posReq.customer_address
          };
        }
      }
    }

    // 4. Build LHDN Payload
    const payload = buildLhdnJson(config, merchant, orderDetails, items, orderNumber, deliveryFee, discountAmount, customerDataForLhdn, merchantOverrides);
    const token = await getLhdnToken(config);

    // 5. Submit to LHDN
    try {
      const lhdnResponse = await submitToLhdn(config, orderNumber, payload, token);

      // Save record correctly
      const totalAmount = Number(payload.Invoice[0].LegalMonetaryTotal[0].PayableAmount[0]._);
      const subTotal = Number(payload.Invoice[0].LegalMonetaryTotal[0].TaxExclusiveAmount[0]._);
      const taxAmount = Number(payload.Invoice[0].TaxTotal[0].TaxAmount[0]._);

      const { data: savedRecord } = await supabase.from("einvoices").upsert({
        merchant_id: merchantId,
        order_id: orderId || null,
        pos_request_id: posRequestId || null,
        order_number: orderNumber,
        lhdn_uuid: lhdnResponse.uuid,
        lhdn_long_id: lhdnResponse.longId,
        submission_uid: lhdnResponse.submissionUid || lhdnResponse.uuid,
        qr_code_url: `${config.env === "production" ? "https://myinvois.hasil.gov.my" : "https://preprod.myinvois.hasil.gov.my"}/${lhdnResponse.uuid}/share/${lhdnResponse.longId}`,
        status: "submitted",
        invoice_type: "01",
        submitted_at: new Date().toISOString(),
        buyer_name: payload.Invoice[0].AccountingCustomerParty[0].Party[0].PartyLegalEntity[0].RegistrationName[0]._,
        buyer_tin: payload.Invoice[0].AccountingCustomerParty[0].Party[0].PartyIdentification[0].ID[0]._,
        total_amount: totalAmount,
        tax_amount: taxAmount,
        einvoice_details: payload
      }, { onConflict: (orderId ? 'order_id' : 'pos_request_id') }).select().single();

      // Sync line items
      if (savedRecord?.id) {
         const insertLines = payload.Invoice[0].InvoiceLine.map((line: any) => ({
            document_id: savedRecord.id,
            description: line.Item[0].Description[0]._,
            quantity: Number(line.InvoicedQuantity[0]._),
            unit_price: Number(line.Price[0].PriceAmount[0]._),
            classification_code: line.Item[0].CommodityClassification[0].ItemClassificationCode[0]._,
            tax_type: line.TaxTotal[0].TaxSubtotal[0].TaxCategory[0].ID[0]._,
            tax_rate: Number(line.TaxTotal[0].TaxSubtotal[0].TaxCategory[0].Percent[0]._),
            line_total_rm: Number(line.LineExtensionAmount[0]._)
         }));
         await supabase.from("einvoice_line_items").delete().eq("document_id", savedRecord.id);
         await supabase.from("einvoice_line_items").insert(insertLines);
      }

      return new Response(JSON.stringify({ success: true, data: lhdnResponse }), { headers: jsonHeaders });
    } catch (err: any) {
      console.error("LHDN Rejection:", err.message);
      const errorMsg = err.message || "Unknown error";

      if (merchantId && orderNumber) {
        const { data: savedRecord } = await supabase.from("einvoices").upsert({
          merchant_id: merchantId,
          order_id: orderId || null,
          pos_request_id: posRequestId || null,
          order_number: orderNumber,
          status: "error",
          error_message: errorMsg,
          submitted_at: new Date().toISOString(),
          buyer_name: payload.Invoice[0].AccountingCustomerParty[0].Party[0].PartyLegalEntity[0].RegistrationName[0]._,
          buyer_tin: payload.Invoice[0].AccountingCustomerParty[0].Party[0].PartyIdentification[0].ID[0]._,
          total_amount: Number(payload.Invoice[0].LegalMonetaryTotal[0].PayableAmount[0]._),
          tax_amount: Number(payload.Invoice[0].TaxTotal[0].TaxAmount[0]._),
          einvoice_details: payload
        }, { onConflict: (orderId ? 'order_id' : 'pos_request_id') }).select().single();

        if (savedRecord?.id) {
           const insertLines = payload.Invoice[0].InvoiceLine.map((line: any) => ({
              document_id: savedRecord.id,
              description: line.Item[0].Description[0]._,
              quantity: Number(line.InvoicedQuantity[0]._),
              unit_price: Number(line.Price[0].PriceAmount[0]._),
              classification_code: line.Item[0].CommodityClassification[0].ItemClassificationCode[0]._,
              tax_type: line.TaxTotal[0].TaxSubtotal[0].TaxCategory[0].ID[0]._,
              tax_rate: Number(line.TaxTotal[0].TaxSubtotal[0].TaxCategory[0].Percent[0]._),
              line_total_rm: Number(line.LineExtensionAmount[0]._)
           }));
           await supabase.from("einvoice_line_items").delete().eq("document_id", savedRecord.id);
           await supabase.from("einvoice_line_items").insert(insertLines);
        }
      }

      return new Response(JSON.stringify({ success: false, error: errorMsg, debug_payload: payload }), { headers: jsonHeaders });
    }

  } catch (error: any) {
    console.error("Function Error:", error.message);
    // Return 200 so the client can read the body and show the real error
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: jsonHeaders });
  }
});

function buildLhdnJson(config: any, merchant: any, order: any, items: any[], orderNumber: string, deliveryFee: number, discountAmount: number, customerOverride?: any, merchantOverride?: any) {
  const tin = config.tin?.trim() || "IG25351615030";
  const stateCode = STATE_MAPPING[merchant?.state?.toLowerCase()] || "14";
  const issueDate = new Date().toISOString().split("T")[0];
  const issueTime = new Date().getUTCHours().toString().padStart(2, "0") + ":" +
                    new Date().getUTCMinutes().toString().padStart(2, "0") + ":" +
                    new Date().getUTCSeconds().toString().padStart(2, "0") + "Z";

  // MSIC Fallback
  // MSIC Fallback logic — MSMEs can use 47912
  let baseMsic = config.msic_code || "47912";
  if (baseMsic === "47910") baseMsic = "47912";
  const msicCode = merchantOverride?.msic_code || baseMsic;
  const msicName = config.description || "Retail sale of any kind of product over the Internet";

  // Tax line helper — LHDN uses "E" (Exempt) for SST-exempt items
  const taxLine = (taxableAmount: number) => ({
    "TaxAmount": [{ "_": 0.00, "currencyID": "MYR" }],
    "TaxSubtotal": [{
      "TaxableAmount": [{ "_": taxableAmount, "currencyID": "MYR" }],
      "TaxAmount": [{ "_": 0.00, "currencyID": "MYR" }],
      "TaxCategory": [{
        "ID": [{ "_": "06" }],
        "Percent": [{ "_": 0.00 }],
        "TaxExemptionReason": [{ "_": "Not Subject to SST" }],
        "TaxScheme": [{ "ID": [{ "_": "OTH", "schemeID": "UN/ECE 5153", "schemeAgencyID": "6" }] }]
      }]
    }]
  });

  // Build invoice lines
  const ublLines = items.map((item, index) => {
    const lineTotal = roundMYR(item.total);
    return {
      "ID": [{ "_": String(index + 1) }],
      "InvoicedQuantity": [{ "_": roundMYR(item.quantity) || 1.00, "unitCode": "C62" }],
      "LineExtensionAmount": [{ "_": lineTotal, "currencyID": "MYR" }],
      "TaxTotal": [taxLine(lineTotal)],
      "Item": [{
        "CommodityClassification": [{ "ItemClassificationCode": [{ "_": (customerOverride?.classification_code || "004"), "listID": "CLASS" }] }],
        "Description": [{ "_": item.name }]
      }],
      "Price": [{ "PriceAmount": [{ "_": roundMYR(item.unitPrice), "currencyID": "MYR" }] }],
      "ItemPriceExtension": [{ "Amount": [{ "_": lineTotal, "currencyID": "MYR" }] }]
    };
  });

  // Add Delivery Fee as a line item if applicable
  if (deliveryFee > 0) {
    const fee = roundMYR(deliveryFee);
    ublLines.push({
      "ID": [{ "_": String(ublLines.length + 1) }],
      "InvoicedQuantity": [{ "_": 1.00, "unitCode": "C62" }],
      "LineExtensionAmount": [{ "_": fee, "currencyID": "MYR" }],
      "TaxTotal": [taxLine(fee)],
      "Item": [{
        "CommodityClassification": [{ "ItemClassificationCode": [{ "_": "004", "listID": "CLASS" }] }],
        "Description": [{ "_": "Delivery Fee" }]
      }],
      "Price": [{ "PriceAmount": [{ "_": fee, "currencyID": "MYR" }] }],
      "ItemPriceExtension": [{ "Amount": [{ "_": fee, "currencyID": "MYR" }] }]
    });
  }

  const totalLineExtension = roundMYR(ublLines.reduce((sum, l) => sum + parseFloat(l.LineExtensionAmount[0]._.toString()), 0));
  const payableAmount = roundMYR(totalLineExtension - (discountAmount || 0));

  // Identity Mapping
  const sellerTin = config.tin?.trim();
  const sellerId = config.registration_no || "NA";
  const sellerIdType = config.registration_no_type || "BRN"; // Can be BRN, NRIC, PASSPORT

  const isB2C = (!customerOverride?.tin || customerOverride.tin === "EI00000000010");
  const customerTin = customerOverride?.tin || "EI00000000010";
  const customerId = customerOverride?.id_number || "NA";
  const customerIdScheme = (customerOverride?.id_type || (isB2C ? "NRIC" : "BRN")).toUpperCase();
  
  const customerName = customerOverride?.name || order?.buyer_name || order?.customer_name || (isB2C ? "General Public" : "Buyer");
  const customerEmail = customerOverride?.email || order?.buyer_email || order?.customer_email || "customer@example.com";
  
  let rawPhone = customerOverride?.phone || order?.buyer_phone || order?.customer_phone || order?.delivery_address?.phone || "000000000";
  const customerPhone = rawPhone.replace(/[\s-]/g, '') || "000000000";
  
  const customerAddr = customerOverride?.address || order?.customer_address || order?.delivery_address?.line1 || "N/A";

  const invoice: any = {
    "Invoice": [{
      "UBLVersionID": [{ "_": "2.1" }],
      "CustomizationID": [{ "_": "urn:cert.lhdn.gov.my:invoice" }],
      "ID": [{ "_": orderNumber }],
      "IssueDate": [{ "_": issueDate }],
      "IssueTime": [{ "_": issueTime }],
      "InvoiceTypeCode": [{ "_": "01", "listVersionID": "1.0" }],
      "DocumentCurrencyCode": [{ "_": "MYR" }],
      "TaxCurrencyCode": [{ "_": "MYR" }],
      "AccountingSupplierParty": [{
        "Party": [{
          "IndustryClassificationCode": [{ "_": msicCode, "name": msicName }],
          "PartyIdentification": [
            { "ID": [{ "_": sellerTin, "schemeID": "TIN" }] },
            { "ID": [{ "_": sellerId, "schemeID": sellerIdType }] }
          ],
          "PostalAddress": [{
            "AddressLine": [
              { "Line": [{ "_": merchant?.address_line1 || "N/A" }] }
            ],
            "PostalZone": [{ "_": merchant?.postcode || "50000" }],
            "CityName": [{ "_": merchant?.city || "Kuala Lumpur" }],
            "CountrySubentityCode": [{ "_": stateCode }],
            "Country": [{ "IdentificationCode": [{ "_": "MYS", "listAgencyID": "6", "listID": "ISO3166-1" }] }]
          }],
          "PartyLegalEntity": [{ "RegistrationName": [{ "_": merchant?.store_name || merchant?.company_name || "Merchant" }] }],
          "Contact": [{
            "Telephone": [{ "_": merchant?.phone || "0123456789" }],
            "ElectronicMail": [{ "_": merchant?.email || "merchant@example.com" }]
          }]
        }]
      }],
      "AccountingCustomerParty": [{
        "Party": [{
          "PartyIdentification": [
            { "ID": [{ "_": customerTin, "schemeID": "TIN" }] },
            { "ID": [{ "_": customerId, "schemeID": customerIdScheme }] }
          ],
          "PostalAddress": [{
            "AddressLine": [{ "Line": [{ "_": customerAddr }] }],
            "PostalZone": [{ "_": "00000" }],
            "CityName": [{ "_": "Kuala Lumpur" }],
            "CountrySubentityCode": [{ "_": "14" }],
            "Country": [{ "IdentificationCode": [{ "_": "MYS", "listAgencyID": "6", "listID": "ISO3166-1" }] }]
          }],
          "PartyLegalEntity": [{ "RegistrationName": [{ "_": customerName }] }],
          "Contact": [{
            "Telephone": [{ "_": customerPhone }],
            "ElectronicMail": [{ "_": customerEmail }]
          }]
        }]
      }],
      "TaxTotal": [{
        "TaxAmount": [{ "_": 0.00, "currencyID": "MYR" }],
        "TaxSubtotal": [{
          "TaxableAmount": [{ "_": totalLineExtension, "currencyID": "MYR" }],
          "TaxAmount": [{ "_": 0.00, "currencyID": "MYR" }],
          "TaxCategory": [{
            "ID": [{ "_": "06" }],
            "Percent": [{ "_": 0.00 }],
            "TaxExemptionReason": [{ "_": "Not Subject to SST" }],
            "TaxScheme": [{ "ID": [{ "_": "OTH", "schemeID": "UN/ECE 5153", "schemeAgencyID": "6" }] }]
          }]
        }]
      }],
      "LegalMonetaryTotal": [{
        "LineExtensionAmount": [{ "_": totalLineExtension, "currencyID": "MYR" }],
        "TaxExclusiveAmount": [{ "_": totalLineExtension, "currencyID": "MYR" }],
        "TaxInclusiveAmount": [{ "_": totalLineExtension, "currencyID": "MYR" }],
        "AllowanceTotalAmount": [{ "_": roundMYR(discountAmount), "currencyID": "MYR" }],
        "PayableAmount": [{ "_": payableAmount, "currencyID": "MYR" }]
      }],
      "InvoiceLine": ublLines
    }]
  };

  // Only include AllowanceCharge if there is a discount
  if (discountAmount > 0) {
    invoice.Invoice[0].AllowanceCharge = [{
      "ChargeIndicator": [{ "_": false }],
      "AllowanceChargeReason": [{ "_": "Discount" }],
      "Amount": [{ "_": roundMYR(discountAmount), "currencyID": "MYR" }]
    }];
  }

  return invoice;
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
    })
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as any;
    const detail = errBody?.error_description || errBody?.error || res.status;
    throw new Error(`Token Auth Failed: ${detail}`);
  }

  const data = await res.json() as any;
  return data.access_token;
}

async function submitToLhdn(config: any, invoiceNumber: string, payload: any, token: string) {
  const url = config.env === "production"
    ? "https://api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions"
    : "https://preprod-api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions";

  const docString = JSON.stringify(payload);
  const docBytes = new TextEncoder().encode(docString);

  // Base64-encode the document
  let binary = "";
  for (let i = 0; i < docBytes.byteLength; i++) binary += String.fromCharCode(docBytes[i]);
  const b64Document = btoa(binary);

  // SHA-256 hash of the UTF-8 document bytes
  const hashBuffer = await crypto.subtle.digest("SHA-256", docBytes);
  const calculatedHash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      documents: [{ format: "JSON", document: b64Document, documentHash: calculatedHash, codeNumber: invoiceNumber }]
    })
  });

  const data = await res.json() as any;
  console.log("[submitToLhdn] Raw Response:", JSON.stringify(data));
  
  if (!res.ok) {
    // Surface the full LHDN error details
    const lhdnErrors = data?.error?.details
      ?.map((d: any) => d.message || d.error)
      .filter(Boolean)
      .join("; ");
    throw new Error(lhdnErrors || data?.error?.message || JSON.stringify(data));
  }
  
  const accepted = data.acceptedDocuments?.[0];
  if (!accepted) {
    throw new Error("LHDN accepted the submission but returned no document UUID. Response: " + JSON.stringify(data));
  }
  
  return {
    uuid: accepted.uuid,
    longId: accepted.longId,
    submissionUid: data.submissionUid || accepted.uuid
  };
}
