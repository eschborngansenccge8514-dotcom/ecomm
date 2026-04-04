import { Hono } from 'hono'
import { getSupabaseClient, Bindings } from '../lib/supabase'
import { hmacSha256 } from '../lib/utils'

const razorpay = new Hono<{ Bindings: Bindings }>()

// --- Create Order ---
razorpay.post('/create-order', async (c) => {
  try {
    const { orderId } = await c.req.json()
    if (!orderId) throw new Error('orderId is required')

    const supabase = getSupabaseClient(c.env)

    const { data: order, error } = await supabase
      .from('orders')
      .select('*, profiles:customer_id(full_name, phone, email:id(email))')
      .eq('id', orderId)
      .single()

    if (error || !order) throw new Error('Order not found')
    if (order.status !== 'pending') throw new Error('Order is not in pending state')

    const { data: config } = await supabase
      .from('merchant_razorpay_config')
      .select('key_id, key_secret')
      .eq('merchant_id', order.merchant_id)
      .maybeSingle()

    const keyId     = config?.key_id     || c.env.RAZORPAY_KEY_ID
    const keySecret = config?.key_secret || c.env.RAZORPAY_KEY_SECRET
    
    if (!keyId || !keySecret) throw new Error('Razorpay credentials not configured')
    
    const authHeader = 'Basic ' + btoa(`${keyId}:${keySecret}`)
    const amountInSen = Math.round(Number(order.total_amount) * 100)

    const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount:   amountInSen,
        currency: 'MYR',
        receipt:  order.order_number,
        notes:    { hyperlocal_order_id: orderId },
      }),
    })

    if (!razorpayRes.ok) {
      const err = await razorpayRes.text()
      throw new Error(`Razorpay API error: ${err}`)
    }

    const razorpayOrder = (await razorpayRes.json()) as any

    await supabase
      .from('orders')
      .update({ payment_reference: razorpayOrder.id })
      .eq('id', orderId)

    return c.json({
      razorpayOrderId: razorpayOrder.id,
      razorpayKeyId:   keyId,
      amount:          amountInSen,
      currency:        'MYR',
      orderNumber:     order.order_number,
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

// --- Verify Payment ---
razorpay.post('/verify-payment', async (c) => {
  try {
    const params = await c.req.json()
    const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = params
    
    const supabase = getSupabaseClient(c.env)
    const { data: order } = await supabase.from('orders').select('merchant_id').eq('id', orderId).single()
    if (!order) throw new Error('Order not found')

    const { data: config } = await supabase.from('merchant_razorpay_config').select('key_secret').eq('merchant_id', order.merchant_id).maybeSingle()
    const keySecret = config?.key_secret || c.env.RAZORPAY_KEY_SECRET

    const dataToVerify = `${razorpayOrderId}|${razorpayPaymentId}`
    const generatedSignature = await hmacSha256(keySecret, dataToVerify)

    if (generatedSignature !== razorpaySignature) {
      throw new Error('Invalid payment signature')
    }

    // Update order status
    await supabase.from('orders').update({
      status: 'confirmed',
      payment_status: 'paid',
      payment_reference: razorpayPaymentId,
      paid_at: new Date().toISOString()
    }).eq('id', orderId)

    // Log payment event
    await supabase.from('payment_events').insert({
      order_id:       orderId,
      event_type:     'payment_verified',
      gateway:        'razorpay',
      gateway_ref:    razorpayPaymentId,
      raw_payload:    { razorpayOrderId, razorpayPaymentId },
    })

    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

// --- Refund ---
razorpay.post('/refund', async (c) => {
  try {
    const { orderId, amount, reason } = await c.req.json()
    if (!orderId) throw new Error('orderId is required')

    const supabase = getSupabaseClient(c.env)
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*, merchants!orders_merchant_id_fkey(*)')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) throw new Error('Order not found')
    if (order.payment_method !== 'razorpay') throw new Error('Only Razorpay orders can be refunded')
    if (!order.payment_reference) throw new Error('No payment reference found')

    const { data: config } = await supabase
      .from('merchant_razorpay_config')
      .select('*')
      .eq('merchant_id', order.merchant_id)
      .maybeSingle()

    const keyId     = config?.key_id      || c.env.RAZORPAY_KEY_ID
    const keySecret = config?.key_secret  || c.env.RAZORPAY_KEY_SECRET

    if (!keyId || !keySecret) throw new Error('Razorpay config missing')

    const authHeader = 'Basic ' + btoa(`${keyId}:${keySecret}`)
    const refundPayload: any = {
      notes: { order_id: orderId, merchant_id: order.merchant_id, reason: reason || 'Refund' }
    }
    if (amount) refundPayload.amount = Math.round(Number(amount) * 100)

    const razorpayRes = await fetch(`https://api.razorpay.com/v1/payments/${order.payment_reference}/refund`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(refundPayload)
    })

    const razorpayData = (await razorpayRes.json()) as any
    if (!razorpayRes.ok) throw new Error(`Razorpay Error: ${razorpayData.error?.description || JSON.stringify(razorpayData)}`)

    // Update Order
    await supabase.from('orders').update({
      status:          'refunded',
      payment_status:  'refunded',
      refund_id:       razorpayData.id,
      refunded_at:     new Date().toISOString(),
      is_refunded:     true,
      refunded_amount: amount || order.total_amount
    }).eq('id', orderId)

    // Insert into refunds ledger
    await supabase.from('refunds').insert({
      order_id:       orderId,
      merchant_id:    order.merchant_id,
      amount:         amount || order.total_amount,
      reason:         reason || 'Razorpay Refund',
      status:         'approved',
      processed_at:   new Date().toISOString()
    })

    return c.json({ success: true, refundId: razorpayData.id })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

export default razorpay
