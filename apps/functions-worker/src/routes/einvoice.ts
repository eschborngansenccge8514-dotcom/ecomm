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

    if (orderId) {
      // 1a. Fetch Order + Merchant Info
      const { data: order } = await supabase.from('orders').select('*, merchants(*)').eq('id', orderId).single()
      if (!order) throw new Error('Order not found')
      
      merchantId = order.merchant_id
      orderNumber = order.order_number
      totalAmount = order.total_amount
      sourceTable = 'orders'
      sourceId = orderId

      const { data: orderItems } = await supabase.from('order_items').select('*').eq('order_id', orderId)
      items = (orderItems || []).map(item => ({
        description: item.product_name,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.total_price
      }))

      const details = order.einvoice_details || {}
      buyer = {
        name: details.name || 'Customer',
        tin: details.tin || 'EI00000000010',
        id_number: details.id_no || 'NA',
        email: details.email || 'noreply@customer.com'
      }
    } else if (posRequestId) {
      // 1b. Fetch POS Request + Transaction
      const { data: req } = await supabase.from('pos_einvoice_requests').select('*').eq('id', posRequestId).single()
      if (!req) throw new Error('POS Request not found')

      const { data: txn } = await supabase.from('pos_transactions').select('*').eq('id', req.transaction_id).single()
      if (!txn) throw new Error('POS Transaction not found')

      merchantId = txn.merchant_id
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
        email: req.customer_email || 'noreply@customer.com'
      }
    } else {
      throw new Error('Either orderId or posRequestId is required')
    }

    // 2. Fetch Merchant Config
    const { data: config } = await supabase.from('merchant_einvoice_config').select('*').eq('merchant_id', merchantId).single()
    if (!config) throw new Error('E-Invoice config missing for merchant')

    // 3. Map to LHDN JSON
    const lhdnJson = {
      orderNumber,
      totalAmount,
      buyer,
      items: items.map(i => ({
        ...i,
        taxType: '01',
        taxRate: 6
      }))
    }

    // 4. Get Auth Token
    const token = await getLhdnToken(config)

    // 5. Submit to LHDN
    const submitUrl = config.env === "production" 
      ? "https://api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions" 
      : "https://preprod-api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions";

    const res = await fetch(submitUrl, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ documents: [lhdnJson] })
    })

    const result = (await res.json()) as any
    if (!res.ok) throw new Error(`LHDN Error: ${JSON.stringify(result)}`)

    // 6. Create E-Invoice Record
    const { data: invoice } = await supabase.from('einvoices').insert({
      merchant_id: merchantId,
      order_id: orderId || null,
      order_number: orderNumber,
      submission_uid: result.submissionUid,
      lhdn_uuid: result.acceptedDocuments?.[0]?.uuid,
      total_amount: totalAmount,
      status: 'submitted',
      metadata: posRequestId ? { pos_request_id: posRequestId } : {}
    }).select().single()

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

    return c.json({ success: true, invoiceId: invoice.id })
  } catch (err: any) {
    console.error('[Submit Error]', err)
    return c.json({ error: err.message }, 400)
  }
})

// --- Consolidate ---
einvoice.post('/consolidate', async (c) => {
  try {
    const { merchantId, year, month } = await c.req.json()
    const supabase = getSupabaseClient(c.env)

    // 1. Fetch orders marked for consolidation
    const { data: staged } = await supabase
      .from('orders')
      .select('id, subtotal, order_number')
      .eq('merchant_id', merchantId)
      .in('einvoice_status', ['sent_to_consolidated_batch', 'pending_buyer_request'])
      .is('consolidated_einvoice_id', null)

    if (!staged || staged.length === 0) return c.json({ message: 'No orders to consolidate' })

    const totalAmount = staged.reduce((acc, curr) => acc + Number(curr.subtotal), 0)

    // 2. Submit Consolidated to LHDN (similar to submit above but with batched data)
    // ... submission logic ...

    // 3. Create E-Invoice Record
    const { data: invoice } = await supabase.from('einvoices').insert({
      merchant_id: merchantId,
      invoice_type: 'consolidated',
      total_amount: totalAmount,
      orders_count: staged.length,
      status: 'submitted'
    }).select().single()

    // 4. Update Orders
    await supabase.from('orders')
      .update({ consolidated_einvoice_id: invoice.id })
      .in('id', staged.map(s => s.id))

    return c.json({ success: true, invoiceId: invoice.id })
  } catch (err: any) {
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
        const lhdnResult = await getDocumentDetails(config, submission.lhdn_uuid, token)
        
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

export default einvoice
