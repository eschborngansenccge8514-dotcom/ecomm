import { Hono } from 'hono'
import { getSupabaseClient, Bindings } from '../lib/supabase'
import { hmacSha512 } from '../lib/utils'

const billplz = new Hono<{ Bindings: Bindings }>()

const BILLPLZ_BASE = (isSandbox: boolean) => 
  isSandbox ? 'https://www.billplz-sandbox.com/api' : 'https://www.billplz.com/api'

billplz.post('/create-bill', async (c) => {
  try {
    const { orderId } = await c.req.json()
    const supabase = getSupabaseClient(c.env)

    const { data: order, error } = await supabase
      .from('orders')
      .select('*, profile:customer_id(full_name, phone)')
      .eq('id', orderId)
      .single()

    if (error || !order) {
      return c.json({ error: 'Order not found' }, 404)
    }

    const apiKey = c.env.BILLPLZ_API_KEY
    const collectionId = c.env.BILLPLZ_COLLECTION_ID
    const isSandbox = c.env.BILLPLZ_SANDBOX === 'true'
    const baseUrl = BILLPLZ_BASE(isSandbox)
    
    const authHeader = 'Basic ' + btoa(`${apiKey}:`)
    const amountInCents = Math.round(Number(order.total_amount) * 100)

    const params = new URLSearchParams({
      collection_id: collectionId,
      name: order.profile?.full_name ?? 'Customer',
      email: 'noreply@hyperlocal.app',
      mobile: order.profile?.phone ?? '',
      amount: String(amountInCents),
      description: `Order ${order.order_number}`,
      // Updated to Cloudflare Worker URL
      callback_url: `${c.env.APP_URL}/webhooks/billplz`,
      redirect_url: `${c.env.APP_URL}/webhooks/billplz-redirect`,
      reference_1_label: 'Order ID',
      reference_1: orderId,
    })

    const billplzRes = await fetch(`${baseUrl}/v3/bills`, {
      method: 'POST',
      headers: { 'Authorization': authHeader },
      body: params,
    })

    if (!billplzRes.ok) {
      const err = await billplzRes.text()
      throw new Error(`Billplz error: ${err}`)
    }

    const bill = (await billplzRes.json()) as any

    await supabase
      .from('orders')
      .update({ payment_reference: bill.id })
      .eq('id', orderId)

    return c.json({ billUrl: bill.url, billId: bill.id })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

billplz.post('/refund', async (c) => {
  try {
    const { orderId, reason, bankCode, accountName, accountNumber } = await c.req.json()
    if (!orderId || !bankCode || !accountName || !accountNumber) {
      throw new Error('orderId and bank details are required')
    }

    const supabase = getSupabaseClient(c.env)
    const { data: order } = await supabase
      .from('orders')
      .select('*, merchants!orders_merchant_id_fkey(*)')
      .eq('id', orderId)
      .single()

    if (!order) throw new Error('Order not found')
    
    // Fetch Merchant Billplz Config
    const { data: config } = await supabase
      .from('merchant_billplz_config')
      .select('collection_id, payment_order_collection_id, x_signature')
      .eq('merchant_id', order.merchant_id)
      .maybeSingle()

    const collectionId = config?.payment_order_collection_id || c.env.BILLPLZ_COLLECTION_ID
    const xSignature = config?.x_signature || c.env.BILLPLZ_X_SIGNATURE_KEY
    const isSandbox = c.env.BILLPLZ_SANDBOX === 'true'
    const baseUrl = BILLPLZ_BASE(isSandbox)
    
    const amountInCents = Math.round(Number(order.total_amount) * 100)
    const epoch = Math.floor(Date.now() / 1000)
    
    // V5 Checksum
    const checksumStr = `${collectionId}${accountNumber}${amountInCents}${epoch}`
    const checksum = await hmacSha512(xSignature, checksumStr)

    const v5Payload = {
      payment_order_collection_id: collectionId,
      bank_code: bankCode,
      bank_account_number: accountNumber,
      name: accountName,
      description: `Refund for Order ${order.order_number}`,
      total: amountInCents,
      epoch: epoch,
      checksum: checksum,
    }

    const authHeader = 'Basic ' + btoa(`${c.env.BILLPLZ_API_KEY}:`)
    const res = await fetch(`${baseUrl}/v5/payment_orders`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(v5Payload)
    })

    const data = (await res.json()) as any
    if (!res.ok) throw new Error(`Billplz V5 Error: ${JSON.stringify(data)}`)

    // Update DB
    await supabase.from('orders').update({
      status: 'refunded',
      payment_status: 'refunded',
      refund_id: data.id,
      refunded_at: new Date().toISOString(),
      is_refunded: true,
      refunded_amount: order.total_amount
    }).eq('id', orderId)

    await supabase.from('refunds').insert({
      order_id: orderId,
      merchant_id: order.merchant_id,
      amount: order.total_amount,
      reason: reason || 'Billplz Refund',
      status: 'approved',
      processed_at: new Date().toISOString()
    })

    return c.json({ success: true, refundId: data.id })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

export default billplz
