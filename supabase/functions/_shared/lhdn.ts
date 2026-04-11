const STATE_MAPPING: Record<string, string> = {
  "johor": "01", "kedah": "02", "kelantan": "03", "melaka": "04", "negeri sembilan": "05", "pahang": "06", 
  "pulau pinang": "07", "penang": "07", "perak": "08", "perlis": "09", "selangor": "10", "terengganu": "11", 
  "sabah": "12", "sarawak": "13", "kuala lumpur": "14", "labuan": "15", "putrajaya": "16"
};

export function roundMYR_str(val: any) {
  return (Math.round((parseFloat(val) || 0) * 100) / 100).toFixed(2);
}

export async function getLhdnToken(config: any) {
  const url = config.env === "production" 
    ? "https://api.myinvois.hasil.gov.my/connect/token" 
    : "https://preprod-api.myinvois.hasil.gov.my/connect/token";

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

export async function submitToLhdn(config: any, invoiceNumber: string, payload: any, token: string) {
  const url = config.env === "production" 
    ? "https://api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions" 
    : "https://preprod-api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions";
  
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

export function buildUblJson(config: any, merchant: any, orders: any[], invoiceNumber: string, mode: 'individual' | 'consolidated' = 'individual', customerOverride?: any) {
  const tin = config.tin?.trim() || "IG25351615030";
  const stateCode = STATE_MAPPING[merchant?.state?.toLowerCase()] || "14";
  
  const now = new Date();
  const issueDate = now.toISOString().split("T")[0];
  const issueTime = now.getUTCHours().toString().padStart(2, "0") + ":" + 
                    now.getUTCMinutes().toString().padStart(2, "0") + ":" + 
                    now.getUTCSeconds().toString().padStart(2, "0") + "Z";

  // MSIC and identity mapping
  let baseMsic = config.msic_code || "47912";
  if (baseMsic === "47910") baseMsic = "47912"; 
  const msicName = config.description || "Retail sale of any kind of product over the Internet";

  const sellerTin = tin;
  const sellerId = config.registration_no || "NA";
  const sellerIdType = config.registration_no_type || "BRN"; 

  // Builder for Tax Line
  const taxLine = (taxableAmount: string, rate = 0, category = "06") => {
    const taxAmt = roundMYR_str((parseFloat(taxableAmount) * rate) / 100);
    const taxExemptionReason = rate === 0 ? "Not Subject to SST" : null;
    
    return {
      "TaxAmount": [{ "_": taxAmt, "currencyID": "MYR" }],
      "TaxSubtotal": [{
        "TaxableAmount": [{ "_": taxableAmount, "currencyID": "MYR" }],
        "TaxAmount": [{ "_": taxAmt, "currencyID": "MYR" }],
        "TaxCategory": [{
          "ID": [{ "_": category }],
          "Percent": [{ "_": rate.toFixed(2) }],
          ...(taxExemptionReason ? { "TaxExemptionReason": [{ "_": taxExemptionReason }] } : {}),
          "TaxScheme": [{ "ID": [{ "_": "OTH", "schemeID": "UN/ECE 5153", "schemeAgencyID": "6" }] }]
        }]
      }]
    };
  };

  // Items building (mode specific)
  let ublLines = [];
  if (mode === 'consolidated') {
    ublLines = orders.map((o: any, index: number) => {
      const lineTotal = roundMYR_str(o.subtotal || 0);
      return {
        "ID": [{ "_": String(index + 1) }],
        "InvoicedQuantity": [{ "_": "1.00", "unitCode": "C62" }],
        "LineExtensionAmount": [{ "_": lineTotal, "currencyID": "MYR" }],
        "TaxTotal": [taxLine(lineTotal, 0, "06")],
        "Item": [{
          "CommodityClassification": [{ "ItemClassificationCode": [{ "_": "004", "listID": "CLASS" }] }],
          "Description": [{ "_": `Receipt ${o.order_number}` }]
        }],
        "Price": [{ "PriceAmount": [{ "_": lineTotal, "currencyID": "MYR" }] }],
        "ItemPriceExtension": [{ "Amount": [{ "_": lineTotal, "currencyID": "MYR" }] }]
      };
    });
  } else {
    // Individual mode (one order, multiple line items)
    const order = orders[0];
    const items = order.order_items || order.pos_transaction_items || [];
    ublLines = items.map((item: any, index: number) => {
      const lineTotal = roundMYR_str(item.line_total || item.total || item.line_total_rm || 0);
      const rate = parseFloat(item.tax_rate || 0);
      const taxCode = item.lhdn_tax_type || (rate > 0 ? "02" : "06");

      return {
        "ID": [{ "_": String(index + 1) }],
        "InvoicedQuantity": [{ "_": roundMYR_str(item.quantity || item.qty || 1.00), "unitCode": "C62" }],
        "LineExtensionAmount": [{ "_": lineTotal, "currencyID": "MYR" }],
        "TaxTotal": [taxLine(lineTotal, rate, taxCode)],
        "Item": [{
          "CommodityClassification": [{ "ItemClassificationCode": [{ "_": (item.classification_code || "004"), "listID": "CLASS" }] }],
          "Description": [{ "_": item.product_name || item.name || "Item" }]
        }],
        "Price": [{ "PriceAmount": [{ "_": roundMYR_str(item.unit_price || item.price || item.unit_price_rm || 0), "currencyID": "MYR" }] }],
        "ItemPriceExtension": [{ "Amount": [{ "_": lineTotal, "currencyID": "MYR" }] }]
      };
    });
  }

  const totalLineExtension = roundMYR_str(ublLines.reduce((s: number, l: any) => s + parseFloat(l.LineExtensionAmount[0]._), 0));
  const totalTaxAmount = roundMYR_str(ublLines.reduce((s: number, l: any) => s + parseFloat(l.TaxTotal[0].TaxAmount[0]._), 0));
  const payableAmount = roundMYR_str(parseFloat(totalLineExtension) + parseFloat(totalTaxAmount));

  // Buyer Info
  const isB2C = (!customerOverride?.tin || customerOverride.tin === "EI00000000010");
  const customerTin = customerOverride?.tin || "EI00000000010";
  const customerId = customerOverride?.id_number || "NA";
  const customerIdScheme = (customerOverride?.id_type || (isB2C ? "NRIC" : "BRN")).toUpperCase();
  const customerName = customerOverride?.name || "General Public";

  return {
    "Invoice": [{
      "UBLVersionID": [{ "_": "2.1" }],
      "CustomizationID": [{ "_": "urn:cert.lhdn.gov.my:invoice" }],
      "ID": [{ "_": invoiceNumber }],
      "IssueDate": [{ "_": issueDate }],
      "IssueTime": [{ "_": issueTime }],
      "InvoiceTypeCode": [{ "_": "01", "listVersionID": "1.0" }],
      "DocumentCurrencyCode": [{ "_": "MYR" }],
      "TaxCurrencyCode": [{ "_": "MYR" }],
      "UBLExtensions": [{ "UBLExtension": [{ "ExtensionURI": [{ "_": "urn:oasis:names:specification:ubl:dsig:ext:XADES" }], "ExtensionContent": [{ "UBLDocumentSignatures": [{ "SignatureInformation": [{ "ID": [{ "_": "urn:oasis:names:specification:ubl:signature:1" }], "ReferencedSignatureID": [{ "_": "urn:oasis:names:specification:ubl:signature:Invoice" }], "Signature": [{ "Id": "placeholderforid", "Object": [] }] }] }] }] }] }],
      "Signature": [{ "ID": [{ "_": "urn:oasis:names:specification:ubl:signature:Invoice" }], "SignatureMethod": [{ "_": "urn:oasis:names:specification:ubl:dsig:ext:XADES" }] }],
      "AccountingSupplierParty": [{
        "Party": [{
          "IndustryClassificationCode": [{ "_": baseMsic, "name": msicName }],
          "PartyIdentification": [
            { "ID": [{ "_": sellerTin, "schemeID": "TIN" }] },
            { "ID": [{ "_": sellerId, "schemeID": sellerIdType }] }
          ],
          "PostalAddress": [{
            "AddressLine": [{ "Line": [{ "_": merchant?.address_line1 || "N/A" }] }],
            "PostalZone": [{ "_": merchant?.postcode || "50000" }],
            "CityName": [{ "_": merchant?.city || "Kuala Lumpur" }],
            "CountrySubentityCode": [{ "_": stateCode }],
            "Country": [{ "IdentificationCode": [{ "_": "MYS", "listAgencyID": "6", "listID": "ISO3166-1" }] }]
          }],
          "PartyLegalEntity": [{ "RegistrationName": [{ "_": merchant?.store_name || "Merchant" }] }],
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
            "AddressLine": [{ "Line": [{ "_": "N/A" }] }],
            "PostalZone": [{ "_": "00000" }],
            "CityName": [{ "_": "Kuala Lumpur" }],
            "CountrySubentityCode": [{ "_": "14" }],
            "Country": [{ "IdentificationCode": [{ "_": "MYS", "listAgencyID": "6", "listID": "ISO3166-1" }] }]
          }],
          "PartyLegalEntity": [{ "RegistrationName": [{ "_": customerName }] }],
          "Contact": [{
            "Telephone": [{ "_": "000000000" }],
            "ElectronicMail": [{ "_": "customer@example.com" }]
          }]
        }]
      }],
      "TaxTotal": [{
        "TaxAmount": [{ "_": totalTaxAmount, "currencyID": "MYR" }],
        "TaxSubtotal": [{
          "TaxableAmount": [{ "_": totalLineExtension, "currencyID": "MYR" }],
          "TaxAmount": [{ "_": totalTaxAmount, "currencyID": "MYR" }],
          "TaxCategory": [{
            "ID": [{ "_": "01" }], -- In Malaysia, 01 is often used for consolidated or simplified tax total if items are mixed
            "Percent": [{ "_": "0.00" }],
            "TaxScheme": [{ "ID": [{ "_": "OTH", "schemeID": "UN/ECE 5153", "schemeAgencyID": "6" }] }]
          }]
        }]
      }],
      "LegalMonetaryTotal": [{
        "LineExtensionAmount": [{ "_": totalLineExtension, "currencyID": "MYR" }],
        "TaxExclusiveAmount": [{ "_": totalLineExtension, "currencyID": "MYR" }],
        "TaxInclusiveAmount": [{ "_": payableAmount, "currencyID": "MYR" }],
        "AllowanceTotalAmount": [{ "_": "0.00", "currencyID": "MYR" }],
        "PayableAmount": [{ "_": payableAmount, "currencyID": "MYR" }]
      }],
      "InvoiceLine": ublLines
    }]
  };
}
