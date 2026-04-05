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
    ? `https://api.myinvois.hasil.gov.my/api/v1.0/documents/${uuid}` 
    : `https://preprod-api.myinvois.hasil.gov.my/api/v1.0/documents/${uuid}`;
  
  const res = await fetch(url, { 
    method: "GET", 
    headers: { "Authorization": `Bearer ${token}` } 
  });
  
  if (!res.ok) throw new Error(`LHDN lookup failed: ${res.status}`)
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

function buildLhdnJson(merchant: any, config: any, buyer: any, items: any[], orderNumber: string, classificationCode = '022') {
  const safeTin = (buyer.tin || '').trim();
  const safeId  = (buyer.id_number || '').trim();
  
  if (safeTin === 'EI00000000010' && safeId === 'NA') {
      classificationCode = '004';
  }

  const subtotal = items.reduce((s: number, i: any) => s + (Number(i.unitPrice) * Number(i.quantity)), 0);
  const tax = 0; // Default to 0 for now
  const total = subtotal + tax;

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
              {"ID": [{"_": (buyer.id_number || "NA").trim(), "schemeID": (buyer.id_type || "BRN").trim()}]}
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
          "TaxAmount": [{"_": roundMYR(tax), "currencyID": "MYR"}],
          "TaxSubtotal": [{
            "TaxableAmount": [{"_": roundMYR(subtotal), "currencyID": "MYR"}],
            "TaxAmount": [{"_": roundMYR(tax), "currencyID": "MYR"}],
            "TaxCategory": [{
              "ID": [{"_": "06"}],
              "Percent": [{"_": 0}],
              "TaxExemptionReason": [{"_": "Not Subject to SST"}],
              "TaxScheme": [{"ID": [{"_": "OTH", "schemeID": "UN/ECE 5153", "schemeAgencyID": "6"}]}]
            }]
          }]
        }],
        "LegalMonetaryTotal": [{
          "LineExtensionAmount": [{"_": roundMYR(subtotal), "currencyID": "MYR"}],
          "TaxExclusiveAmount": [{"_": roundMYR(subtotal), "currencyID": "MYR"}],
          "TaxInclusiveAmount": [{"_": roundMYR(total), "currencyID": "MYR"}],
          "AllowanceTotalAmount": [{"_": 0, "currencyID": "MYR"}],
          "PayableAmount": [{"_": roundMYR(total), "currencyID": "MYR"}]
        }],
        "InvoiceLine": items.map((item: any, i: number) => ({
          "ID": [{"_": String(i + 1)}],
          "InvoicedQuantity": [{"_": Number(item.quantity), "unitCode": "C62"}],
          "LineExtensionAmount": [{"_": roundMYR(Number(item.unitPrice) * Number(item.quantity)), "currencyID": "MYR"}],
          "ItemPriceExtension": [{
            "Amount": [{"_": roundMYR(Number(item.unitPrice) * Number(item.quantity)), "currencyID": "MYR"}]
          }],
          "Item": [{
            // Use the classification code selected by the merchant (defaults to 022 = Others)
            "CommodityClassification": [{"ItemClassificationCode": [{"_": classificationCode, "listID": "CLASS"}]}],
            "Description": [{"_": item.description}]
          }],
          "Price": [{"PriceAmount": [{"_": roundMYR(item.unitPrice), "currencyID": "MYR"}]}],
          "TaxTotal": [{
            "TaxAmount": [{"_": 0, "currencyID": "MYR"}],
            "TaxSubtotal": [{
              "TaxableAmount": [{"_": roundMYR(Number(item.unitPrice) * Number(item.quantity)), "currencyID": "MYR"}],
              "TaxAmount": [{"_": 0, "currencyID": "MYR"}],
              "TaxCategory": [{
                "ID": [{"_": "06"}],
                "Percent": [{"_": 0}],
                "TaxExemptionReason": [{"_": "Not Subject to SST"}],
                "TaxScheme": [{"ID": [{"_": "OTH", "schemeID": "UN/ECE 5153", "schemeAgencyID": "6"}]}]
              }]
            }]
          }]
        }))
      }
    ]
  };
}

// --- Submit Single (Individual) ---
einvoice.post('/submit', async (c) => {
  try {
    const body = await c.req.json()
    const orderId = body.orderId || body.order_id
    const { posRequestId } = body
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
        totalPrice: item.line_total_rm
      }))

      buyer = {
        name: req.customer_name || 'POS Customer',
        tin: req.customer_tin || 'EI00000000010',
        id_number: req.customer_id_number || 'NA',
        id_type: req.customer_id_type || 'BRN',
        email: req.customer_email || 'noreply@customer.com',
        phone: req.customer_phone || '00-00000000',
        address: req.customer_address || 'N/A',
        postcode: '00000',
        city: 'N/A',
        state: '14',
        country: 'MYS'
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
    const lhdnJson = buildLhdnJson(merchant, config, buyer, items, orderNumber, buyer.classification_code || '022')

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
      throw new Error(`LHDN Submission Failed: ${errorMsg}`)
    }

    if (result.rejectedDocuments && result.rejectedDocuments.length > 0) {
      const rejectErr = result.rejectedDocuments[0]?.error;
      const details = rejectErr?.details?.map((d: any) => d.message).filter(Boolean).join('; ');
      const errorMsg = details || rejectErr?.message || 'Document rejected by LHDN Validation';
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
      tax_amount: 0,
      buyer_name: buyer.name,
      buyer_tin: buyer.tin,
      status: 'submitted',
      einvoice_details: lhdnJson,
      metadata: posRequestId ? { pos_request_id: posRequestId } : {}
    }, { onConflict: (orderId ? 'order_id' : 'pos_request_id') }).select().single()

    // 6.1 Insert Line Items for consistency (mirroring Edge function behavior)
    if (invoice?.id) {
       const insertLines = items.map((item: any) => ({
          document_id: invoice.id,
          description: item.description,
          quantity: Number(item.quantity),
          unit_price: Number(item.unitPrice),
          classification_code: '022',
          tax_type: 'E',
          tax_rate: 0,
          line_total_rm: Number(item.unitPrice) * Number(item.quantity)
       }));
       await supabase.from("einvoice_line_items").delete().eq("document_id", invoice.id);
       await supabase.from("einvoice_line_items").insert(insertLines);
    }

    // 7. Update Source Table
    if (sourceTable === 'orders') {
      await supabase.from('orders').update({
         einvoice_status: 'individual_issued'
      }).eq('id', sourceId)
    } else if (sourceTable === 'pos_einvoice_requests') {
      await supabase.from('pos_einvoice_requests').update({
         status: 'completed'
      }).eq('id', sourceId)
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

    // 2. Fetch staged orders (those not yet individual-einvoiced and not yet consolidated)
    const { data: staged } = await supabase
      .from('orders')
      .select('id, subtotal, order_number, delivery_fee')
      .eq('merchant_id', merchantId)
      .in('einvoice_status', ['sent_to_consolidated_batch', 'pending_buyer_request'])
      .is('consolidated_einvoice_id', null)

    if (!staged || staged.length === 0) return c.json({ success: true, message: 'No orders to consolidate' })

    // 3. Prepare LHDN Submission (Consolidated Batch)
    const token = await getLhdnToken(config)
    const { data: merchant } = await supabase.from('merchants').select('*').eq('id', merchantId).single()
    
    // Group all order amounts into one consolidated batch
    const totalAmount = staged.reduce((acc, curr) => acc + (Number(curr.subtotal) || 0) + (Number(curr.delivery_fee) || 0), 0)
    const orderNumbers = staged.map(s => s.order_number).join(', ')

    // For consolidated, we use the "General Public" buyer profile & Code 004
    const buyer = {
      name: "General Public",
      tin: "EI00000000010",
      id_number: "NA",
      id_type: "NRIC",
      email: merchant.email || "noreply@einvoice.my",
      phone: merchant.phone || "012-3456789",
      address_line1: "NA",
      postcode: "00000",
      city: "NA",
      state: "14", // Wilayah Persekutuan Kuala Lumpur default
      country: "MYS"
    }

    const items = [{
      description: "Consolidated Batch Submission",
      quantity: 1,
      unitPrice: totalAmount,
      totalPrice: totalAmount
    }]

    const batchNumber = `CON-${Date.now()}`
    const lhdnPayload = buildLhdnJson(merchant, config, buyer, items, batchNumber, "004")

    // 4. Submit to LHDN
    const submitUrl = config.env === "production" 
      ? "https://api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions" 
      : "https://preprod-api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions";

    const res = await fetch(submitUrl, {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "OnBehalfOf": (config.tin || "").trim()
      },
      body: JSON.stringify({ documents: [lhdnPayload] })
    })

    const result = await res.json() as any
    if (!res.ok) {
       const errorMsg = result?.error?.message || result?.message || `LHDN Submission Failed: ${res.status}`;
       throw new Error(errorMsg);
    }
    
    if (result.rejectedDocuments && result.rejectedDocuments.length > 0) {
       const rejectErr = result.rejectedDocuments[0]?.error;
       const errorMsg = rejectErr?.message || 'Consolidated document rejected by LHDN Validation';
       throw new Error(`LHDN Rejected: ${errorMsg}`);
    }

    const lhdnUuid = result.acceptedDocuments?.[0]?.uuid

    // 5. Create E-Invoice & Submission Record
    const { data: invoice, error: invErr } = await supabase.from('einvoices').insert({
      merchant_id: merchantId,
      invoice_type: 'consolidated',
      total_amount: totalAmount,
      orders_count: staged.length,
      status: lhdnUuid ? 'submitted' : 'staged',
      order_numbers: staged.map(s => s.order_number)
    }).select().single()

    if (invErr) throw invErr

    if (lhdnUuid) {
      await supabase.from('einvoice_submissions').insert({
        merchant_id: merchantId,
        einvoice_id: invoice.id,
        lhdn_uuid: lhdnUuid,
        status: 'Pending',
        submission_payload: lhdnPayload,
        response_payload: result
      })

      // Link orders to this consolidated invoice
      await supabase.from('orders')
        .update({ 
          consolidated_einvoice_id: invoice.id,
          einvoice_status: 'consolidated' 
        })
        .in('id', staged.map(s => s.id))
    }

    return c.json({ success: true, invoiceId: invoice.id, lhdnUuid })
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

    // Fetch all submissions still in 'submitted' state
    const { data: pending } = await supabase
      .from('einvoice_submissions')
      .select('id, merchant_id, batch_id, lhdn_uuid, invoice_type, order_ids')
      .eq('status', 'submitted')
      .lt('submitted_at', new Date(Date.now() - 2 * 60 * 1000).toISOString()) // older than 2 min
      .limit(20)

    if (!pending || pending.length === 0) return c.json({ success: true, polled: 0 })

    for (const submission of pending) {
      try {
        const { data: config } = await supabase.from('merchant_einvoice_config').select('*').eq('merchant_id', submission.merchant_id).single()
        if (!config) continue

        const token = await getLhdnToken(config)
        const lhdnResult = await getDocumentDetails(config, submission.lhdn_uuid, token) as any
        
        // Map LHDN 'Valid' to ours 'validated'
        const rawStatus = lhdnResult.status.toLowerCase()
        const newStatus = rawStatus === 'valid' ? 'validated' : (rawStatus === 'invalid' ? 'rejected' : rawStatus)

        await supabase.from('einvoice_submissions').update({
          status:        newStatus, 
          lhdn_response: lhdnResult,
          error_codes:   lhdnResult.errors?.map((e: any) => e.code) ?? [],
          validated_at:  new Date().toISOString()
        }).eq('id', submission.id)

        // Update einvoices table
        const result = lhdnResult as any
        await supabase.from('einvoices').update({
          status: newStatus,
          error_code: result.errors?.[0]?.code || null,
          error_message: result.errors?.[0]?.message || null,
          validated_at: new Date().toISOString()
        }).eq('lhdn_uuid', submission.lhdn_uuid)

        // Sync order status if validated
        if (newStatus === 'validated' && submission.order_ids?.length === 1) {
           await supabase.from('orders').update({
              einvoice_status: 'individual_issued'
           }).eq('id', submission.order_ids[0])
        }

        // --- AUTOMATION: Send Email on VALID status ---
        if (newStatus === 'validated' && submission.invoice_type === 'individual' && submission.order_ids?.length === 1) {
          const { data: order } = await supabase
            .from('orders')
            .select('*, merchants(*)')
            .eq('id', submission.order_ids[0])
            .single()

          if (order && order.customer_email) {
            const apiBase = config.env === 'production' 
              ? 'https://api.myinvois.hasil.gov.my/api/v1.0' 
              : 'https://preprod-api.myinvois.hasil.gov.my/api/v1.0';
            
            await emailService.sendInvoiceEmail(order.merchants, {
              customerEmail: order.customer_email,
              customerName:  order.customer_name || 'Valued Customer',
              orderNumber:   order.order_number,
              qrCodeUrl:     `${apiBase}/documents/${submission.lhdn_uuid}/details`,
              uuid:          submission.lhdn_uuid,
              invoiceType:   'invoice'
            }).catch(e => console.error(`Email sending failed for submission ${submission.id}`, e))
          }
        }
      } catch (e) {
        console.error(`Polling failed for ${submission.id}`, e)
      }
    }

    return c.json({ success: true, polled: pending.length })
  } catch (err: any) {
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
