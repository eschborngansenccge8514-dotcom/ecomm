import { Hono } from 'hono'
import { getSupabaseClient, Bindings } from '../lib/supabase'
import { EmailService } from '../lib/resend'

const einvoice = new Hono<{ Bindings: Bindings }>()

// --- Get LHDN Token ---
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
      scope: "InvoicingAPI" 
    }) 
  });
  
  if (!res.ok) throw new Error(`Token Auth Failed: ${res.status}.`);
  const data = await res.json() as any;
  return data.access_token;
}

// --- Get Document Details ---
async function getDocumentDetails(config: any, uuid: string, token: string) {
  const url = config.env === "production" 
    ? `https://api.myinvois.hasil.gov.my/api/v1.0/documents/${uuid}/details` 
    : `https://preprod-api.myinvois.hasil.gov.my/api/v1.0/documents/${uuid}/details`;
  
  const res = await fetch(url, { 
    method: "GET", 
    headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" } 
  });
  
  if (!res.ok) throw new Error(`LHDN document lookup failed: ${res.status}`)
  return await res.json();
}

// --- Get Submission Details ---
async function getSubmissionDetails(config: any, uid: string, token: string) {
  const url = config.env === "production" 
    ? `https://api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions/${uid}` 
    : `https://preprod-api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions/${uid}`;
  
  const res = await fetch(url, { 
    method: "GET", 
    headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" } 
  });
  
  if (!res.ok) throw new Error(`LHDN submission lookup failed: ${res.status}`)
  return await res.json();
}

// --- Helpers ---
const roundMYR = (val: any) => Math.round((parseFloat(val) || 0) * 100) / 100;
const isoDate = () => new Date().toISOString().split('T')[0];
const isoTime = () => new Date().toISOString().split('T')[1].replace(/\..+/, 'Z');

const mapStateToLHDN = (state: string): string => {
  if (!state) return '17';
  const s = state.toLowerCase();
  if (s.includes('johor')) return '01';
  if (s.includes('kedah')) return '02';
  if (s.includes('kelantan')) return '03';
  if (s.includes('melaka') || s.includes('malacca')) return '04';
  if (s.includes('negeri sembilan')) return '05';
  if (s.includes('pahang')) return '06';
  if (s.includes('pulau pinang') || s.includes('penang')) return '07';
  if (s.includes('perak')) return '08';
  if (s.includes('perlis')) return '09';
  if (s.includes('selangor')) return '10';
  if (s.includes('terengganu')) return '11';
  if (s.includes('sabah')) return '12';
  if (s.includes('sarawak')) return '13';
  if (s.includes('kuala lumpur')) return '14';
  if (s.includes('labuan')) return '15';
  if (s.includes('putrajaya')) return '16';
  if (/^\d{2}$/.test(state.trim())) {
    const val = state.trim();
    return val === '00' ? '17' : val;
  }
  return '17';
};

const mapCountryToLHDN = (country: string): string => {
  if (!country) return 'MYS';
  const c = country.trim().toUpperCase();
  if (c === 'MY' || c === 'MALAYSIA') return 'MYS';
  return c;
};

const mapIdTypeToLHDN = (idType: string): string => {
  if (!idType) return 'BRN';
  const t = idType.trim().toUpperCase();
  // Valid LHDN schemeIDs: TIN, BRN, PASSPORT, NRIC, ARMY
  if (t === 'MYKAD' || t === 'NRIC') return 'NRIC';
  if (t === 'PASSPORT') return 'PASSPORT';
  if (t === 'BRN') return 'BRN';
  if (t === 'ARMY') return 'ARMY';
  if (t === 'POLICE') return 'NRIC'; // Default to NRIC for police as they are typically local
  return 'BRN';
};

function buildLhdnJson(merchant: any, config: any, buyer: any, items: any[], orderNumber: string, totalAmount: number, classificationCode = '022') {
  const safeTin = (buyer.tin || '').trim();
  const safeId  = (buyer.id_number || '').trim();
  
  if (safeTin === 'EI00000000010' && safeId === 'NA') {
      classificationCode = '004';
  }

  // Builder for Tax Line
  const taxLine = (taxableAmount: number, rate = 0, category = "06") => {
    const taxAmt = roundMYR((taxableAmount * rate) / 100);
    return {
      "TaxAmount": [{ "_": roundMYR(taxAmt).toFixed(2), "currencyID": "MYR" }],
      "TaxSubtotal": [{
        "TaxableAmount": [{ "_": roundMYR(taxableAmount).toFixed(2), "currencyID": "MYR" }],
        "TaxAmount": [{ "_": roundMYR(taxAmt).toFixed(2), "currencyID": "MYR" }],
        "TaxCategory": [{
          "ID": [{ "_": category }],
          "Percent": [{ "_": rate.toFixed(2) }],
          ...(rate === 0 ? { "TaxExemptionReason": [{ "_": "Not Subject to SST" }] } : {}),
          "TaxScheme": [{ "ID": [{ "_": "OTH", "schemeID": "UN/ECE 5153", "schemeAgencyID": "6" }] }]
        }]
      }]
    };
  };

  const ublLines = items.map((item: any, i: number) => {
    const qty = Number(item.quantity) || 1;
    const price = Number(item.unitPrice) || 0;
    const lineTotal = roundMYR(qty * price);
    const rate = Number(item.taxRate || 0);
    const category = item.taxType || (rate > 0 ? "01" : "06");

    return {
      "ID": [{"_": String(i + 1)}],
      "InvoicedQuantity": [{"_": qty.toFixed(2), "unitCode": "C62"}],
      "LineExtensionAmount": [{"_": lineTotal.toFixed(2), "currencyID": "MYR"}],
      "ItemPriceExtension": [{
        "Amount": [{"_": lineTotal.toFixed(2), "currencyID": "MYR"}]
      }],
      "Item": [{
        "CommodityClassification": [{"ItemClassificationCode": [{"_": item.classificationCode || classificationCode, "listID": "CLASS"}]}],
        "Description": [{"_": item.description}]
      }],
      "Price": [{"PriceAmount": [{"_": price.toFixed(2), "currencyID": "MYR"}]}],
      "TaxTotal": [taxLine(lineTotal, rate, category)]
    };
  });

  const totalLineExtension = roundMYR(ublLines.reduce((s: number, l: any) => s + parseFloat(l.LineExtensionAmount[0]._), 0));
  const totalTaxAmount = roundMYR(ublLines.reduce((s: number, l: any) => s + parseFloat(l.TaxTotal[0].TaxAmount[0]._), 0));
  const payableAmount = roundMYR(totalLineExtension + totalTaxAmount);

  return {
    "Invoice": [
      {
        "UBLVersionID": [{"_": "2.1"}],
        "CustomizationID": [{"_": "urn:cert.lhdn.gov.my:invoice"}],
        "ID": [{"_": orderNumber}],
        "IssueDate": [{"_": isoDate()}],
        "IssueTime": [{"_": isoTime()}],
        "InvoiceTypeCode": [{"_": "01", "listVersionID": "1.0"}],
        "DocumentCurrencyCode": [{"_": "MYR"}],
        "TaxCurrencyCode": [{"_": "MYR"}],
        "UBLExtensions": [{
          "UBLExtension": [{
            "ExtensionURI": [{"_": "urn:oasis:names:specification:ubl:dsig:ext:XADES"}],
            "ExtensionContent": [{
              "UBLDocumentSignatures": [{
                "SignatureInformation": [{
                  "ID": [{"_": "urn:oasis:names:specification:ubl:signature:1"}],
                  "ReferencedSignatureID": [{"_": "urn:oasis:names:specification:ubl:signature:Invoice"}],
                  "Signature": [{"Id": "placeholderforid", "Object": []}]
                }]
              }]
            }]
          }]
        }],
        "Signature": [{
          "ID": [{"_": "urn:oasis:names:specification:ubl:signature:Invoice"}],
          "SignatureMethod": [{"_": "urn:oasis:names:specification:ubl:dsig:ext:XADES"}]
        }],
        "AccountingSupplierParty": [{
          "Party": [{
            "IndustryClassificationCode": [{"_": config.msic_code || "47910", "name": config.description || "Retail sale via internet"}],
            "PartyIdentification": [
              {"ID": [{"_": (config.tin || "").trim(), "schemeID": "TIN"}]},
              {"ID": [{"_": (config.registration_no || "NA").trim(), "schemeID": (config.registration_no_type || "BRN").trim()}]}
            ],
            "PostalAddress": [{
              "AddressLine": [{"Line": [{"_": merchant.address_line1 || "N/A"}]}],
              "PostalZone": [{"_": merchant.postcode || "00000"}],
              "CityName": [{"_": merchant.city || "N/A"}],
              "CountrySubentityCode": [{"_": mapStateToLHDN(merchant.state)}],
              "Country": [{"IdentificationCode": [{"_": mapCountryToLHDN(merchant.country), "listAgencyID": "6", "listID": "ISO3166-1"}]}]
            }],
            "PartyLegalEntity": [{"RegistrationName": [{"_": merchant.store_name}]}],
            "Contact": [{
              "Telephone": [{"_": merchant.phone || "00-00000000"}],
              "ElectronicMail": [{"_": merchant.email || "noreply@einvoice.my"}]
            }]
          }]
        }],
        "AccountingCustomerParty": [{
          "Party": [{
            "PartyIdentification": [
              {"ID": [{"_": (buyer.tin || "EI00000000010").trim(), "schemeID": "TIN"}]},
              {"ID": [{"_": (buyer.id_number || "NA").trim(), "schemeID": mapIdTypeToLHDN(buyer.id_type)}]}
            ],
            "PostalAddress": [{
              "AddressLine": [{"Line": [{"_": buyer.address_line1 || "N/A"}]}],
              "PostalZone": [{"_": buyer.postcode || "00000"}],
              "CityName": [{"_": buyer.city || "N/A"}],
              "CountrySubentityCode": [{"_": mapStateToLHDN(buyer.state)}],
              "Country": [{"IdentificationCode": [{"_": mapCountryToLHDN(buyer.country), "listAgencyID": "6", "listID": "ISO3166-1"}]}]
            }],
            "PartyLegalEntity": [{"RegistrationName": [{"_": buyer.name}]}],
            "Contact": [{
              "Telephone": [{"_": buyer.phone || "NA"}],
              "ElectronicMail": [{"_": buyer.email || "noreply@einvoice.my"}]
            }]
          }]
        }],
      "TaxTotal": [{
        "TaxAmount": [{"_": totalTaxAmount.toFixed(2), "currencyID": "MYR"}],
        "TaxSubtotal": [{
          "TaxableAmount": [{"_": totalLineExtension.toFixed(2), "currencyID": "MYR"}],
          "TaxAmount": [{"_": totalTaxAmount.toFixed(2), "currencyID": "MYR"}],
          "TaxCategory": [{
            "ID": [{"_": "01"}],
            "Percent": [{"_": "0.00"}],
            "TaxScheme": [{"ID": [{"_": "OTH", "schemeID": "UN/ECE 5153", "schemeAgencyID": "6"}]}]
          }]
        }]
      }],
      "LegalMonetaryTotal": [{
        "LineExtensionAmount": [{"_": totalLineExtension.toFixed(2), "currencyID": "MYR"}],
        "TaxExclusiveAmount": [{"_": totalLineExtension.toFixed(2), "currencyID": "MYR"}],
        "TaxInclusiveAmount": [{"_": payableAmount.toFixed(2), "currencyID": "MYR"}],
        "AllowanceTotalAmount": [{"_": "0.00", "currencyID": "MYR"}],
        "PayableAmount": [{"_": payableAmount.toFixed(2), "currencyID": "MYR"}]
      }],
      "InvoiceLine": ublLines
    }]
  };
}

// --- Submit Single (Individual) ---
einvoice.post('/submit', async (c) => {
  try {
    const body = await c.req.json()
    const orderId = body.orderId || body.order_id
    const posRequestId = body.posRequestId || body.pos_request_id
    const supabase = getSupabaseClient(c.env)
    
    let merchantId: string
    let orderNumber: string
    let totalAmount: number
    let items: any[] = []
    let buyer: any = {}
    let sourceTable: string = ''
    let sourceId: string = ''
    let merchant: any = {}

    if (orderId) {
      // 1a. Fetch Order + Merchant Info
      const { data: order } = await supabase.from('orders').select('*, merchants(*)').eq('id', orderId).single()
      if (!order) throw new Error('Order not found')
      
      merchantId = order.merchant_id
      merchant = order.merchants
      orderNumber = order.order_number
      totalAmount = order.total_amount
      sourceTable = 'orders'
      sourceId = orderId

      const { data: orderItems } = await supabase.from('order_items').select('*').eq('order_id', orderId)
      items = (orderItems || []).map(item => ({
        description: item.product_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        totalPrice: item.line_total
      }))

      const details = order.einvoice_details || {}
      // Merge with any admin-provided customer overrides (from the dashboard modal)
      const adminCustomer = body.customer || {}
      buyer = {
        name: adminCustomer.name || details.name || order.buyer_name || order.customer_name || 'General Public',
        tin: adminCustomer.tin || details.tin || 'EI00000000010',
        id_number: adminCustomer.id_number || details.id_no || 'NA',
        id_type: adminCustomer.id_type || details.id_type || 'BRN',
        email: adminCustomer.email || details.email || order.buyer_email || 'noreply@customer.com',
        phone: adminCustomer.phone || details.phone || order.delivery_address?.phone || 'NA',
        // Fixed: use address_line1 not address
        address_line1: adminCustomer.address_line1 || details.address_line1 || order.delivery_address?.line1 || order.delivery_address?.address_line1 || 'N/A',
        postcode: adminCustomer.postcode || details.postcode || order.delivery_address?.postcode || '00000',
        city: adminCustomer.city || details.city || order.delivery_address?.city || 'N/A',
        state: adminCustomer.state || details.state || order.delivery_address?.state || '00',
        country: adminCustomer.country || details.country || 'MYS',
        classification_code: adminCustomer.classification_code || details.classification_code || '022',
      }
    } else if (posRequestId) {
      // 1b. Fetch POS Request + Transaction
      const { data: req } = await supabase.from('pos_einvoice_requests').select('*').eq('id', posRequestId).single()
      if (!req) throw new Error('POS Request not found')

      const { data: txn } = await supabase.from('pos_transactions').select('*, merchants(*)').eq('id', req.transaction_id).single()
      if (!txn) throw new Error('POS Transaction not found')

      merchantId = txn.merchant_id
      merchant = txn.merchants
      orderNumber = txn.receipt_number
      totalAmount = txn.total_rm
      sourceTable = 'pos_einvoice_requests'
      sourceId = posRequestId

      const { data: txnItems } = await supabase.from('pos_transaction_items').select('*').eq('transaction_id', txn.id)
      items = (txnItems || []).map(item => ({
        description: item.product_name,
        quantity: item.qty,
        unitPrice: item.unit_price_rm,
        totalPrice: item.line_total_rm,
        taxRate: item.tax_rate,
        taxType: item.lhdn_tax_type
      }))

      const adminCustomer = body.customer || {}

      buyer = {
        name: (adminCustomer.name || req.customer_name || 'POS Customer').toUpperCase(),
        tin: (adminCustomer.tin || req.customer_tin || 'EI00000000010').toUpperCase(),
        id_number: (adminCustomer.id_number || req.customer_id_number || 'NA').toUpperCase(),
        id_type: adminCustomer.id_type || req.customer_id_type || 'BRN',
        email: adminCustomer.email || req.customer_email || 'noreply@customer.com',
        phone: (adminCustomer.phone || req.customer_phone || '').trim().replace(/[\s-]/g, '') || '0123456789',
        address_line1: (adminCustomer.address || adminCustomer.address_line1 || req.customer_address || 'N/A').toUpperCase(),
        postcode: adminCustomer.postcode || '00000',
        city: adminCustomer.city || 'N/A',
        state: adminCustomer.state || '14',
        country: adminCustomer.country || 'MYS'
      }
    } else {
      throw new Error('Either orderId or posRequestId is required')
    }

    // 2. Fetch Merchant Config
    const { data: config } = await supabase.from('merchant_einvoice_config').select('*').eq('merchant_id', merchantId).single()
    if (!config) throw new Error('E-Invoice config missing for merchant')
    if (!config.tin?.trim()) throw new Error('Supplier TIN is not configured. Please set your TIN in E-Invoice Settings.')

    // Also apply any merchant config overrides from the admin modal
    const merchantOverrides = body.merchant_overrides || {}
    if (merchantOverrides.msic_code) config.msic_code = merchantOverrides.msic_code
    if (merchantOverrides.description) config.description = merchantOverrides.description

    // 3. Map to LHDN JSON (UBL-compliant)
    const safeCustomerTin = (buyer.tin || 'EI00000000010').trim();
    const safeCustomerId = (buyer.id_number || 'NA').trim();
    let resolvedClassificationCode = buyer.classification_code || '022';
    if (safeCustomerTin === 'EI00000000010' && safeCustomerId === 'NA') {
        resolvedClassificationCode = '004';
    }

    const lhdnJson = buildLhdnJson(merchant, config, buyer, items, orderNumber, totalAmount, resolvedClassificationCode)

    // 4. Get Auth Token
    const token = await getLhdnToken(config)

    // 5. Submit to LHDN
    const submitUrl = config.env === "production"
      ? "https://api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions"
      : "https://preprod-api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions";

    const docString = JSON.stringify(lhdnJson);
    const docBytes = new TextEncoder().encode(docString);
    let binary = "";
    for (let i = 0; i < docBytes.byteLength; i++) binary += String.fromCharCode(docBytes[i]);
    const b64Document = btoa(binary);
    const hashBuffer = await crypto.subtle.digest("SHA-256", docBytes);
    const calculatedHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");


    // DEBUG: Log the payload being sent to LHDN
    console.log(`[LHDN Payload] ${docString}`);

    const res = await fetch(submitUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'OnBehalfOf': config.tin.trim(),
      },
      body: JSON.stringify({
        documents: [{
          format: "JSON",
          document: b64Document,
          documentHash: calculatedHash,
          codeNumber: orderNumber
        }]
      })
    })

    const result = (await res.json()) as any
    if (!res.ok) {
      const lhdnDetails = result?.error?.details?.map((d: any) => d.message).filter(Boolean).join('; ')
      const errorMsg = lhdnDetails || result?.error?.message || result?.message || JSON.stringify(result)
      console.error(`[LHDN API Error] Status: ${res.status}`, result);
      throw new Error(`LHDN Submission Failed: ${errorMsg}`)
    }

    if (result.rejectedDocuments && result.rejectedDocuments.length > 0) {
      const rejectErr = result.rejectedDocuments[0]?.error;
      const details = rejectErr?.details?.map((d: any) => d.message).filter(Boolean).join('; ');
      const errorMsg = details || rejectErr?.message || 'Document rejected by LHDN Validation';
      console.error('[LHDN Validation Error]', JSON.stringify(result.rejectedDocuments[0]));
      throw new Error(`LHDN Rejected: ${errorMsg}`);
    }


    // Calculate sum correctly from the payload line extensions or items
    const subTotal = items.reduce((s: number, i: any) => s + (Number(i.unitPrice) * Number(i.quantity)), 0);

    // 6. Create E-Invoice Record
    const { data: invoice } = await supabase.from('einvoices').upsert({
      merchant_id: merchantId,
      order_id: orderId || null,
      pos_request_id: posRequestId || null,
      order_number: orderNumber,
      submission_uid: result.submissionUid || result.acceptedDocuments?.[0]?.uuid,
      lhdn_uuid: result.acceptedDocuments?.[0]?.uuid,
      total_amount: totalAmount,
      tax_amount: Number((totalAmount - subTotal).toFixed(2)),
      buyer_name: buyer.name,
      buyer_tin: buyer.tin,
      status: 'submitted',
      einvoice_details: lhdnJson,
      metadata: posRequestId ? { pos_request_id: posRequestId } : {}
    }, { onConflict: (orderId ? 'order_id' : 'pos_request_id') }).select().single()

    // 6.1 Insert Line Items for consistency (mirroring Edge function behavior)
    if (invoice?.id) {
        const hasTaxLine = totalAmount > subTotal + 0.01;
        const insertLines = items.map((item: any) => ({
           document_id: invoice.id,
           description: item.description,
           quantity: Number(item.quantity),
           unit_price: Number(item.unitPrice),
           classification_code: resolvedClassificationCode,
           tax_type: hasTaxLine ? '01' : '06',
           tax_rate: hasTaxLine ? Math.round(((totalAmount - subTotal) / subTotal) * 100) : 0,
           line_total_rm: Number(item.unitPrice) * Number(item.quantity)
        }));
       await supabase.from("einvoice_line_items").delete().eq("document_id", invoice.id);
       await supabase.from("einvoice_line_items").insert(insertLines);
    }

    // 7. Update Source Table
    if (sourceTable === 'orders') {
      const { error: updateErr } = await supabase.from('orders').update({
         einvoice_status: 'individual_issued'
      }).eq('id', sourceId)
      if (updateErr) throw new Error(`Failed to update order status: ${updateErr.message}`)
    } else if (sourceTable === 'pos_einvoice_requests') {
      const { error: reqErr } = await supabase.from('pos_einvoice_requests').update({
         status: 'completed'
      }).eq('id', sourceId)
      if (reqErr) throw new Error(`Failed to update request status: ${reqErr.message}`)

      // Also update the parent transaction status
      const { data: request, error: fetchErr } = await supabase.from('pos_einvoice_requests').select('transaction_id').eq('id', sourceId).single()
      if (fetchErr) throw new Error(`Failed to fetch transaction ID: ${fetchErr.message}`)
      
      if (request?.transaction_id) {
        const { error: txErr } = await supabase.from('pos_transactions').update({
           einvoice_status: 'individual_issued'
        }).eq('id', request.transaction_id)
        if (txErr) throw new Error(`Failed to update transaction status: ${txErr.message}`)
      }
    }

    return c.json({ success: true, invoiceId: invoice.id, message: 'E-Invoice submitted successfully' })
  } catch (err: any) {
    console.error('[Submit Error]', err)
    return c.json({ message: err.message }, 400)
  }
})

// --- Consolidate ---
einvoice.post('/consolidate', async (c) => {
  try {
    const body = await c.req.json()
    const merchantId = body.merchantId || body.merchant_id
    if (!merchantId) throw new Error('merchant_id is required')
    console.log(`[Consolidate] Processing for merchant: ${merchantId}`)
    const supabase = getSupabaseClient(c.env)

    // 1. Fetch Merchant Config
    const { data: config, error: configError } = await supabase
      .from('merchant_einvoice_config')
      .select('*')
      .eq('merchant_id', merchantId)
      .single()

    if (configError || !config) throw new Error('Merchant E-Invoice configuration not found')

    // 2. Fetch staged items (Orders + POS Transactions)
    const { data: stagedOrders } = await supabase
      .from('orders')
      .select('id, subtotal, order_number, delivery_fee')
      .eq('merchant_id', merchantId)
      .in('einvoice_status', ['sent_to_consolidated_batch', 'pending_buyer_request'])
      .is('consolidated_einvoice_id', null)

    const { data: stagedPos } = await supabase
      .from('pos_transactions')
      .select('id, subtotal_rm, receipt_number')
      .eq('merchant_id', merchantId)
      .eq('einvoice_status', 'sent_to_consolidated_batch')
      .is('consolidated_einvoice_id', null)

    const staged = [
      ...(stagedOrders || []).map(o => ({
        id: o.id,
        source: 'orders',
        subtotal: o.subtotal,
        delivery_fee: o.delivery_fee,
        order_number: o.order_number
      })),
      ...(stagedPos || []).map(p => ({
        id: p.id,
        source: 'pos_transactions',
        subtotal: p.subtotal_rm,
        delivery_fee: 0,
        order_number: p.receipt_number
      }))
    ]

    if (staged.length === 0) return c.json({ success: true, message: 'No items to consolidate' })

    // 3. Prepare LHDN Submission (Consolidated Batch)
    const token = await getLhdnToken(config)
    const { data: merchant } = await supabase.from('merchants').select('*').eq('id', merchantId).single()
    
    // Chunk staged orders into max 100 per e-invoice to follow LHDN constraints
    const CHUNK_SIZE = 100
    const finalResults = []
    
    const now = new Date()
    const monthYear = `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`
    const submitUrl = config.env === "production" 
      ? "https://api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions" 
      : "https://preprod-api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions"

    for (let i = 0; i < staged.length; i += CHUNK_SIZE) {
      const chunk = staged.slice(i, i + CHUNK_SIZE)
      
      const totalAmount = chunk.reduce((acc, curr) => acc + (Number(curr.subtotal) || 0) + (Number(curr.delivery_fee) || 0), 0)
      
      // For consolidated, we use the "General Public" buyer profile & Code 004
      const buyer = {
        name: "General Public",
        tin: "EI00000000010",
        id_number: "NA",
        id_type: "BRN", // Since id_number is NA, LHDN rule ERR236 permits BRN/NRIC=NA for Code 004
        email: merchant.email || "noreply@einvoice.my",
        phone: merchant.phone || "012-3456789",
        address_line1: "NA",
        postcode: "00000",
        city: "NA",
        state: "14", // Wilayah Persekutuan Kuala Lumpur
        country: "MYS"
      }

      // Line-by-Line: Each receipt is a separate line item as per LHDN Guidelines
      const items = chunk.map(order => ({
        description: `Receipt ${order.order_number || order.id.slice(0, 8)}`,
        quantity: 1,
        unitPrice: (Number(order.subtotal) || 0) + (Number(order.delivery_fee) || 0),
        totalPrice: (Number(order.subtotal) || 0) + (Number(order.delivery_fee) || 0)
      }))

      const batchNumber = `CON-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      const lhdnPayload = buildLhdnJson(merchant, config, buyer, items, batchNumber, totalAmount, "004")

      const docString = JSON.stringify(lhdnPayload)
      const docBytes = new TextEncoder().encode(docString)
      let binary = ""
      for (let j = 0; j < docBytes.byteLength; j++) binary += String.fromCharCode(docBytes[j])
      const b64Document = btoa(binary)
      const hashBuffer = await crypto.subtle.digest("SHA-256", docBytes)
      const calculatedHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("")

      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "OnBehalfOf": (config.tin || "").trim()
        },
        body: JSON.stringify({
          documents: [{
            format: "JSON",
            document: b64Document,
            documentHash: calculatedHash,
            codeNumber: batchNumber
          }]
        })
      })

      const result = await res.json() as any
      if (!res.ok) {
         const errorMsg = result?.error?.message || result?.message || `LHDN Submission Failed: ${res.status}`
         throw new Error(errorMsg)
      }
      
      if (result.rejectedDocuments && result.rejectedDocuments.length > 0) {
         const rejectErr = result.rejectedDocuments[0]?.error
         const details = rejectErr?.details?.map((d: any) => d.message).filter(Boolean).join('; ')
         const errorMsg = details || rejectErr?.message || 'Consolidated document rejected by LHDN'
         throw new Error(`LHDN Rejected: ${errorMsg}`)
      }

      const lhdnUuid = result.acceptedDocuments?.[0]?.uuid

      // Create E-Invoice & Submission Record for this chunk
      const { data: invoice, error: invErr } = await supabase.from('einvoices').insert({
        merchant_id: merchantId,
        invoice_type: 'consolidated',
        total_amount: totalAmount,
        orders_count: chunk.length,
        status: lhdnUuid ? 'submitted' : 'staged',
        order_number: batchNumber,
        lhdn_uuid: lhdnUuid,
        submission_uid: lhdnUuid
      }).select().single()

      if (invErr) throw invErr

      if (lhdnUuid) {
        await supabase.from('einvoice_submissions').insert({
          merchant_id: merchantId,
          einvoice_id: invoice.id,
          batch_id: batchNumber,
          lhdn_uuid: lhdnUuid,
          status: 'Pending',
          submission_payload: lhdnPayload,
          response_payload: result
        })

        // Link chunk items to this consolidated invoice
        const orderIds = chunk.filter(s => s.source === 'orders').map(s => s.id)
        const posIds = chunk.filter(s => s.source === 'pos_transactions').map(s => s.id)

        if (orderIds.length > 0) {
          const { error: orderErr } = await supabase.from('orders')
            .update({ 
              consolidated_einvoice_id: invoice.id,
              einvoice_status: 'consolidated' 
            })
            .in('id', orderIds)
          if (orderErr) throw new Error(`Failed to update orders: ${orderErr.message}`)
        }

        if (posIds.length > 0) {
          const { error: posErr } = await supabase.from('pos_transactions')
            .update({ 
              consolidated_einvoice_id: invoice.id,
              einvoice_status: 'consolidated' 
            })
            .in('id', posIds)
          if (posErr) throw new Error(`Failed to update transactions: ${posErr.message}`)
        }
      }
      finalResults.push({ invoiceId: invoice.id, lhdnUuid })
    }

    return c.json({ success: true, processedChunks: finalResults.length, results: finalResults })
  } catch (err: any) {
    console.error('[Consolidate Error]', err)
    return c.json({ error: err.message }, 400)
  }
})

// --- Check Status ---
einvoice.post('/check-status', async (c) => {
  try {
    const { identifiers, identifier_type } = await c.req.json()
    const supabase = getSupabaseClient(c.env)

    let query = supabase.from("einvoice_submissions").select("*")
    
    if (identifier_type === 'lhdn_uuid') query = query.in("lhdn_uuid", identifiers)
    else if (identifier_type === 'batch_id') query = query.in("batch_id", identifiers)
    else if (identifier_type === 'order_id') query = query.contains("order_ids", identifiers)

    const { data: results, error } = await query
    if (error) throw error

    return c.json(results || [])
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

// --- Poll Status (Jobs) ---
einvoice.post('/poll-status', async (c) => {
  try {
    const supabase = getSupabaseClient(c.env)
    const emailService = new EmailService(c.env.RESEND_API_KEY)

    let body: any = {}
    if (c.req.header('content-type')?.includes('application/json')) {
      try { body = await c.req.json() } catch (e) {}
    }

    let allPending: any[] = []

    if (body.invoice_id || body.lhdn_uuid) {
      // Manual poll for specific invoice
      let p1: any[] = []
      let p2: any[] = []

      if (body.invoice_id) {
        const { data: d1 } = await supabase.from('einvoice_submissions')
          .select('id, merchant_id, batch_id, lhdn_uuid, invoice_type, order_ids')
          .eq('einvoice_id', body.invoice_id)
        
        const { data: d2 } = await supabase.from('einvoices')
          .select('id, merchant_id, lhdn_uuid, submission_uid, order_id')
          .eq('id', body.invoice_id)
        
        p1 = d1 || []
        p2 = d2 || []
      } else {
        const { data: d1 } = await supabase.from('einvoice_submissions')
          .select('id, merchant_id, batch_id, lhdn_uuid, invoice_type, order_ids')
          .eq('lhdn_uuid', body.lhdn_uuid)
        
        const { data: d2 } = await supabase.from('einvoices')
          .select('id, merchant_id, lhdn_uuid, submission_uid, order_id')
          .eq('lhdn_uuid', body.lhdn_uuid)
        
        p1 = d1 || []
        p2 = d2 || []
      }

      allPending = [
        ...p1.map((p: any) => ({ 
          ...p, 
          submission_id: p.batch_id, 
          doc_uuid: p.lhdn_uuid, 
          table: 'einvoice_submissions', 
          order_ids: p.order_ids || [] 
        })),
        ...p2.map((p: any) => ({ 
          ...p, 
          submission_id: p.submission_uid || p.batch_id, // fallback to batch_id if uid is missing
          doc_uuid: p.lhdn_uuid, 
          table: 'einvoices', 
          order_ids: p.order_id ? [p.order_id] : [] 
        }))
      ]
    } else {
      // Cron poll
      const { data: p1 } = await supabase.from('einvoice_submissions')
        .select('id, merchant_id, batch_id, lhdn_uuid, invoice_type, order_ids')
        .eq('status', 'submitted')
        .lt('submitted_at', new Date(Date.now() - 2 * 60 * 1000).toISOString()).limit(20)
        
      const { data: p2 } = await supabase.from('einvoices')
        .select('id, merchant_id, lhdn_uuid, submission_uid, order_id')
        .eq('status', 'submitted')
        .not('lhdn_uuid', 'is', null)
        .limit(20)

      allPending = [
        ...(p1 || []).map((p: any) => ({ ...p, submission_id: p.batch_id, doc_uuid: p.lhdn_uuid, table: 'einvoice_submissions', order_ids: p.order_ids || [] })),
        ...(p2 || []).map((p: any) => ({ ...p, submission_id: p.submission_uid, doc_uuid: p.lhdn_uuid, table: 'einvoices', order_ids: p.order_id ? [p.order_id] : [] }))
      ]
    }

    if (allPending.length === 0) return c.json({ success: true, polled: 0 })

    for (const submission of allPending) {
      try {
        const { data: config } = await supabase.from('merchant_einvoice_config').select('*').eq('merchant_id', submission.merchant_id).single()
        if (!config) continue

        const token = await getLhdnToken(config)

        let lhdnResult: any;
        let rawStatus: string | undefined;
        let documentErrors: any[] = [];
        let viaDoc = false;

        // Fallback strategy: try submission_id first, then fallback to doc_uuid
        if (submission.submission_id) {
          try {
            lhdnResult = await getSubmissionDetails(config, submission.submission_id, token)
            rawStatus = lhdnResult.overallStatus?.toLowerCase()
            documentErrors = lhdnResult.errors || []
            
            if (lhdnResult.documentSummary?.length > 0) {
              const doc = lhdnResult.documentSummary.find((d: any) => d.uuid === submission.doc_uuid) || lhdnResult.documentSummary[0]
              rawStatus = doc.status?.toLowerCase()
            }
          } catch (submissionErr: any) {
            console.warn(`Submission API failed for ${submission.submission_id}: ${submissionErr.message}`)
            if (submission.doc_uuid) {
              viaDoc = true
              lhdnResult = await getDocumentDetails(config, submission.doc_uuid, token)
              rawStatus = lhdnResult.status?.toLowerCase()
              documentErrors = lhdnResult.validationSteps?.flatMap((s: any) => s.error ? [s.error] : []) || []
            } else {
              throw submissionErr
            }
          }
        } else if (submission.doc_uuid) {
          viaDoc = true
          lhdnResult = await getDocumentDetails(config, submission.doc_uuid, token)
          rawStatus = lhdnResult.status?.toLowerCase()
          documentErrors = lhdnResult.validationSteps?.flatMap((s: any) => s.error ? [s.error] : []) || []
        } else {
          continue
        }

        console.log(`Status for ${submission.doc_uuid}: ${rawStatus} (via ${viaDoc ? 'Document' : 'Submission'} API)`)

        const newStatus = rawStatus === 'valid' ? 'validated' : (rawStatus === 'invalid' || rawStatus === 'rejected') ? 'rejected' : rawStatus

        if (!newStatus || ['submitted', 'in progress', 'pending'].includes(newStatus)) continue

        if (submission.table === 'einvoice_submissions') {
          await supabase.from('einvoice_submissions').update({
            status:        newStatus, 
            lhdn_response: lhdnResult,
            error_codes:   documentErrors.map((e: any) => e.code || e).filter(Boolean),
            validated_at:  new Date().toISOString()
          }).eq('id', submission.id)
        }

        if (submission.doc_uuid) {
          await supabase.from('einvoices').update({
            status:        newStatus,
            error_code:    documentErrors[0]?.code || null,
            error_message: documentErrors[0]?.message || null,
            validated_at:  new Date().toISOString()
          }).eq('lhdn_uuid', submission.doc_uuid)
        }

        if (newStatus === 'validated' && submission.order_ids?.length === 1) {
           await supabase.from('orders').update({ einvoice_status: 'individual_issued' }).eq('id', submission.order_ids[0])
           
           if (!viaDoc) { 
             // Try fetching order to send email
             const { data: order } = await supabase.from('orders').select('*, merchants(*)').eq('id', submission.order_ids[0]).single()
             if (order && order.customer_email) {
               const apiBase = config.env === 'production' ? 'https://api.myinvois.hasil.gov.my/api/v1.0' : 'https://preprod-api.myinvois.hasil.gov.my/api/v1.0';
               await emailService.sendInvoiceEmail(order.merchants, {
                 customerEmail: order.customer_email,
                 customerName:  order.customer_name || 'Valued Customer',
                 orderNumber:   order.order_number,
                 qrCodeUrl:     `${apiBase}/documents/${submission.doc_uuid}/details`,
                 uuid:          submission.doc_uuid,
                 invoiceType:   'invoice'
               }).catch(e => console.error(`Email sending failed for submission ${submission.id}`, e))
             }
           }
        }
      } catch (e) {
        console.error(`Polling failed for ${submission.id || submission.doc_uuid}`, e)
      }
    }

    return c.json({ success: true, polled: allPending.length })
  } catch (err: any) {
    console.error('[Submit Route Error]', err);
    return c.json({ error: err.message }, 400)
  }
})

// --- Test Connection ---
einvoice.post('/test-connection', async (c) => {
  try {
    const body = await c.req.json()
    const merchantId = body.merchantId || body.merchant_id
    if (!merchantId) throw new Error('merchant_id is required')
    console.log(`[Test Connection] Processing for merchant: ${merchantId}`)
    const supabase = getSupabaseClient(c.env)

    const { data: config, error: configError } = await supabase
      .from('merchant_einvoice_config')
      .select('*')
      .eq('merchant_id', merchantId)
      .single()

    if (configError || !config) throw new Error('Configuration not found for merchant: ' + merchantId)

    // Try to rotate token/get new one
    await getLhdnToken(config)

    return c.json({ success: true, message: 'Connection to LHDN successful' })
  } catch (err: any) {
    console.error('[Test Connection Error]', err)
    return c.json({ error: err.message }, 400)
  }
})

export default einvoice
