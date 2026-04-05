import { Hono } from 'hono'
import { getSupabaseClient, Bindings } from '../lib/supabase'
import { hmacSha256 } from '../lib/utils'

const razorpay = new Hono<{ Bindings: Bindings }>()

// --- Create Order ---
razorpay.post('/create-order', async (c) => {
  try {
    const { orderId } = await c.req.json()
    console.log(`[Razorpay] Creating order for Hyperlocal Order: ${orderId}`)
    
    if (!orderId) throw new Error('orderId is required')

    const supabase = getSupabaseClient(c.env)

    // Simplified query - we just need the order details
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (error || !order) {
      console.error(`[Razorpay] Order query failed for ${orderId}:`, error)
      throw new Error(`Order not found: ${error?.message || 'unknown'}`)
    }
    
    if (order.status !== 'pending') {
      console.warn(`[Razorpay] Order ${orderId} is NOT pending (status: ${order.status})`)
      throw new Error(`Order is not in pending state (status: ${order.status})`)
    }

    const { data: config } = await supabase
      .from('merchant_razorpay_config')
      .select('key_id, key_secret, use_global_key')
      .eq('merchant_id', order.merchant_id)
      .maybeSingle()

    const useGlobal = config?.use_global_key ?? true
    const keyId     = useGlobal ? c.env.RAZORPAY_KEY_ID     : (config?.key_id     || c.env.RAZORPAY_KEY_ID)
    const keySecret = useGlobal ? c.env.RAZORPAY_KEY_SECRET : (config?.key_secret || c.env.RAZORPAY_KEY_SECRET)
    
    if (!keyId || !keySecret) {
      console.error(`[Razorpay] Credentials missing for merchant ${order.merchant_id}. Global: ${useGlobal}`)
      throw new Error('Razorpay credentials not configured')
    }
    
    const authHeader = 'Basic ' + btoa(`${keyId}:${keySecret}`)
    const amountInSen = Math.round(Number(order.total_amount) * 100)

    console.log(`[Razorpay] Requesting Razorpay Order for ${order.order_number} (Amount: ${amountInSen})`)

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
        notes:    { hyperlocal_order_id: orderId, merchant_id: order.merchant_id },
      }),
    })

    if (!razorpayRes.ok) {
      const err = await razorpayRes.text()
      console.error(`[Razorpay] Razorpay API Error:`, err)
      throw new Error(`Razorpay API error: ${err}`)
    }

    const razorpayOrder = (await razorpayRes.json()) as any
    console.log(`[Razorpay] Razorpay Order Created: ${razorpayOrder.id}`)

    const { error: updateError } = await supabase
      .from('orders')
      .update({ payment_reference: razorpayOrder.id })
      .eq('id', orderId)

    if (updateError) {
      console.error(`[Razorpay] Failed to update order reference:`, updateError)
      throw new Error(`Failed to update order reference: ${updateError.message}`)
    }

    return c.json({
      razorpayOrderId: razorpayOrder.id,
      razorpayKeyId:   keyId,
      amount:          amountInSen,
      currency:        'MYR',
      orderNumber:     order.order_number,
    })
  } catch (err: any) {
    console.error(`[Razorpay] Create Order Exception:`, err)
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

    const { data: config } = await supabase.from('merchant_razorpay_config').select('key_secret, use_global_key').eq('merchant_id', order.merchant_id).maybeSingle()
    const useGlobal = config?.use_global_key ?? true
    const keySecret = useGlobal ? c.env.RAZORPAY_KEY_SECRET : (config?.key_secret || c.env.RAZORPAY_KEY_SECRET)

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

// --- Handle Redirect (for redirect:true mode) ---
razorpay.post('/redirect', async (c) => {
  try {
    const body = await c.req.parseBody()
    const razorpayPaymentId = body['razorpay_payment_id'] as string
    const razorpayOrderId   = body['razorpay_order_id']   as string
    const razorpaySignature = body['razorpay_signature']  as string

    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return c.redirect('hyperlocal://payment-return?error=missing_params', 302)
    }

    const supabase = getSupabaseClient(c.env)
    
    // Look up order by payment_reference (which stores razorpayOrderId)
    const { data: order } = await supabase
      .from('orders')
      .select('id, status, merchant_id')
      .eq('payment_reference', razorpayOrderId)
      .maybeSingle()

    if (!order) {
      return c.redirect(`hyperlocal://payment-return?error=order_not_found&rzpOrderId=${razorpayOrderId}`, 302)
    }

    // Get Merchant Config
    const { data: config } = await supabase
      .from('merchant_razorpay_config')
      .select('key_secret, use_global_key')
      .eq('merchant_id', order.merchant_id)
      .maybeSingle()

    const useGlobal = config?.use_global_key ?? true
    const keySecret = useGlobal ? c.env.RAZORPAY_KEY_SECRET : (config?.key_secret || c.env.RAZORPAY_KEY_SECRET)
    const dataToVerify = `${razorpayOrderId}|${razorpayPaymentId}`
    const generatedSignature = await hmacSha256(keySecret, dataToVerify)

    if (generatedSignature !== razorpaySignature) {
      return c.redirect(`hyperlocal://payment-return?error=invalid_signature&orderId=${order.id}`, 302)
    }

    // Update order status if still pending
    if (order.status === 'pending') {
      await supabase.from('orders').update({
        status: 'confirmed',
        payment_status: 'paid',
        payment_reference: razorpayPaymentId,
        paid_at: new Date().toISOString()
      }).eq('id', order.id)

      // Log payment event
      await supabase.from('payment_events').insert({
        order_id:       order.id,
        event_type:     'payment_verified',
        gateway:        'razorpay',
        gateway_ref:    razorpayPaymentId,
        raw_payload:    { razorpayOrderId, razorpayPaymentId },
      })
    }

    return c.redirect(`hyperlocal://payment-return?verified=true&orderId=${order.id}`, 302)
  } catch (err: any) {
    return c.redirect(`hyperlocal://payment-return?error=${encodeURIComponent(err.message)}`, 302)
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
      .select('key_id, key_secret, use_global_key')
      .eq('merchant_id', order.merchant_id)
      .maybeSingle()

    const useGlobal = config?.use_global_key ?? true
    const keyId     = useGlobal ? c.env.RAZORPAY_KEY_ID      : (config?.key_id      || c.env.RAZORPAY_KEY_ID)
    const keySecret = useGlobal ? c.env.RAZORPAY_KEY_SECRET  : (config?.key_secret  || c.env.RAZORPAY_KEY_SECRET)

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
