import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Helper to get LHDN Bearer Token using merchant credentials
 */
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
  
  if (!res.ok) {
    const err = await res.json() as any;
    throw new Error(`LHDN Token Auth Failed: ${JSON.stringify(err)}. Please verify Client ID/Secret.`);
  }
  
  const data = await res.json() as any;
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    const { orderId, posRequestId } = payload

    console.log(`[Automation] Processing request — orderId: ${orderId}, posRequestId: ${posRequestId}`)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let merchantId: string
    let orderNumber: string
    let totalAmount: number
    let items: any[] = []
    let buyer: any = {}
    let sourceId: string = ''
    let sourceTable: string = ''

    // 1. Fetch Source Data
    if (orderId) {
      const { data: order, error: orderErr } = await supabaseAdmin.from('orders').select('*').eq('id', orderId).single()
      if (orderErr || !order) throw new Error('Order not found')
      
      merchantId = order.merchant_id
      orderNumber = order.order_number
      totalAmount = order.total_amount
      sourceTable = 'orders'
      sourceId = orderId

      const { data: orderItems } = await supabaseAdmin.from('order_items').select('*').eq('order_id', orderId)
      items = (orderItems || []).map(item => ({
        description: item.product_name,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.total_price
      }))

      const details = order.einvoice_details || {}
      buyer = {
        name: details.name || 'Individual Customer',
        tin: details.tin || 'EI00000000010',
        id_number: details.id_no || 'NA',
        email: details.email || 'noreply@customer.com'
      }
    } else if (posRequestId) {
      const { data: requestRecord, error: reqErr } = await supabaseAdmin.from('pos_einvoice_requests').select('*').eq('id', posRequestId).single()
      if (reqErr || !requestRecord) throw new Error('POS Request not found')

      const { data: txn, error: txnErr } = await supabaseAdmin.from('pos_transactions').select('*').eq('id', requestRecord.transaction_id).single()
      if (txnErr || !txn) throw new Error('POS Transaction not found')

      merchantId = txn.merchant_id
      orderNumber = txn.receipt_number
      totalAmount = txn.total_rm
      sourceTable = 'pos_einvoice_requests'
      sourceId = posRequestId

      const { data: txnItems } = await supabaseAdmin.from('pos_transaction_items').select('*').eq('transaction_id', txn.id)
      items = (txnItems || []).map(item => ({
        description: item.product_name,
        quantity: item.qty,
        unitPrice: item.unit_price_rm,
        totalPrice: item.line_total_rm
      }))

      buyer = {
        name: requestRecord.customer_name || 'POS Customer',
        tin: requestRecord.customer_tin || 'EI00000000010',
        id_number: requestRecord.customer_id_number || 'NA',
        email: requestRecord.customer_email || 'noreply@customer.com'
      }
    } else {
      throw new Error('Missing transaction identifiers')
    }

    // 2. Fetch Merchant Config
    const { data: merchantConfig, error: configErr } = await supabaseAdmin
      .from('merchant_einvoice_config')
      .select('*')
      .eq('merchant_id', merchantId)
      .single()

    if (configErr || !merchantConfig) throw new Error(`Merchant config not found for ${merchantId}`)

    // 3. Authenticate with LHDN
    const lhdnToken = await getLhdnToken(merchantConfig)

    // 4. Map to LHDN JSON (Simplified for Automation)
    const currentIsoDate = new Date().toISOString()
    const lhdnJson = {
      issuer: {
          tin: merchantConfig.tin,
          idbr: merchantConfig.registration_no,
          m_name: merchantConfig.store_name,
          m_address: merchantConfig.address,
          m_tin: merchantConfig.tin,
          m_reg: merchantConfig.registration_no,
          m_msic: merchantConfig.msic_code,
          m_business_desc: merchantConfig.business_description,
      },
      receiver: {
          nm: buyer.name,
          tin: buyer.tin,
          idbr: buyer.id_number,
          addr: "-", // Default address if missing
          cont: buyer.email || "-",
      },
      dateTimeIssued: currentIsoDate,
      dateTimeReceived: currentIsoDate,
      totalExcludingTax: totalAmount, // Assuming no tax or pre-tax same as total for simplicity in this flow
      totalIncludingTax: totalAmount,
      totalTaxAmount: 0,
      totalPayableAmount: totalAmount,
      invoiceItems: items.map(item => ({
        description: item.description,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        discount: 0,
        taxAmount: 0,
        totalPrice: item.totalPrice,
        taxType: "01",
        taxRate: 0
      })),
      orderNumber: orderNumber // Track internals
    }

    const lhdnUrl = merchantConfig.env === "production" 
      ? "https://api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions" 
      : "https://preprod-api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions";

    console.log(`[Automation] Submitting ${orderNumber} to LHDN...`)
    
    // Wrap in standard LHDN submission format
    const submissionBody = {
      documents: [lhdnJson]
    }

    const submitResponse = await fetch(lhdnUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lhdnToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(submissionBody)
    })

    const submitResult = await submitResponse.json()
    if (!submitResponse.ok) {
      throw new Error(`LHDN Submission Failed: ${JSON.stringify(submitResult)}`)
    }

    // 5. Record Results
    const submissionUid = submitResult.submissionUid
    const acceptedDoc = submitResult.acceptedDocuments?.[0]
    const lhdnUuid = acceptedDoc?.uuid

    const { error: einvoiceErr } = await supabaseAdmin.from('einvoices').insert({
      merchant_id: merchantId,
      order_id: orderId || null,
      order_number: orderNumber,
      submission_uid: submissionUid,
      lhdn_uuid: lhdnUuid,
      total_amount: totalAmount,
      status: 'submitted',
      metadata: posRequestId ? { pos_request_id: posRequestId } : {}
    })

    if (einvoiceErr) throw new Error(`Failed to create einvoice record: ${einvoiceErr.message}`)

    // 6. Update Source Status
    if (sourceTable === 'orders') {
      await supabaseAdmin.from('orders').update({ einvoice_status: 'individual_issued' }).eq('id', sourceId)
    } else if (sourceTable === 'pos_einvoice_requests') {
      await supabaseAdmin.from('pos_einvoice_requests').update({ status: 'completed' }).eq('id', sourceId)
    }

    console.log(`[Automation] Successfully processed ${sourceTable} ID: ${sourceId}`)

    return new Response(JSON.stringify({ 
      success: true, 
      submissionUid,
      lhdnUuid
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('[Automation Error]', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
