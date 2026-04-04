import { Hono } from 'hono'
import { getSupabaseClient, Bindings } from '../lib/supabase'
import { hmacSha256, hmacSha512 } from '../lib/utils'
import { mapLalamoveStatus, mapLalamoveDriverInfo, buildLalamoveHeaders, getLalamoveBaseUrl } from '../lib/lalamove'

const webhooks = new Hono<{ Bindings: Bindings }>()

// --- Billplz Webhook ---
webhooks.post('/billplz', async (c) => {
  const body = await c.req.text()
  const params = new URLSearchParams(body)
  const xSignature = c.env.BILLPLZ_X_SIGNATURE_KEY

  const keysToSign = [
    'billplz[id]', 'billplz[collection_id]', 'billplz[paid]',
    'billplz[state]', 'billplz[amount]', 'billplz[paid_amount]',
    'billplz[due_at]', 'billplz[email]', 'billplz[mobile]',
    'billplz[name]', 'billplz[url]', 'billplz[reference_1]',
    'billplz[reference_2]'
  ]

  const signedString = keysToSign
    .map(k => `${k}${params.get(k) ?? ''}`)
    .join('|')

  const computedSig = await hmacSha256(xSignature, signedString)
  const receivedSig = params.get('x_signature') ?? ''

  if (computedSig !== receivedSig) {
    console.error('Billplz signature mismatch')
    return c.text('Unauthorized', 401)
  }

  const billId = params.get('billplz[id]') ?? ''
  const paid = params.get('billplz[paid]') === 'true'
  const orderId = params.get('billplz[reference_1]') ?? ''

  const supabase = getSupabaseClient(c.env)
  const eventType = paid ? 'payment_captured' : 'payment_failed'

  // Idempotency
  if (billId) {
    const { data: existing } = await supabase
      .from('payment_events')
      .select('id')
      .eq('gateway', 'billplz')
      .eq('gateway_ref', billId)
      .eq('event_type', eventType)
      .maybeSingle()

    if (existing) return c.text('OK', 200)
  }

  const payload: Record<string, string> = {}
  params.forEach((v, k) => { payload[k] = v })

  await supabase.from('payment_events').insert({
    order_id: orderId || null,
    event_type: eventType,
    gateway: 'billplz',
    gateway_ref: billId,
    raw_payload: payload,
  })

  if (paid && orderId) {
    await supabase.from('orders').update({
      status: 'paid',
      payment_status: 'paid',
      payment_reference: billId,
      paid_at: new Date().toISOString(),
    }).eq('id', orderId).eq('status', 'pending')
  }

  return c.text('OK')
})

// --- Lalamove Webhook ---
webhooks.post('/lalamove', async (c) => {
  try {
    const body = await c.req.json()
    const event = body.data ?? body
    
    const lalamoveOrderId = event.orderId ?? event.order?.id ?? body.orderId
    const lalamoveStatus = event.status ?? event.order?.status ?? body.status
    const eventType = body.eventType ?? event.eventType ?? 'status_update'

    if (!lalamoveOrderId) return c.json({ error: 'No orderId' }, 200)

    const supabase = getSupabaseClient(c.env)
    const { data: order } = await supabase
      .from('orders')
      .select('id, merchant_id, customer_id, driver_assigned_at')
      .eq('lalamove_order_id', lalamoveOrderId)
      .maybeSingle()

    if (!order) return c.json({ error: 'Order not found' }, 200)

    const eventId = c.req.header('x-lalamove-request-id') ?? event.eventId ?? body.eventId ?? `${lalamoveOrderId}_${lalamoveStatus}_${Date.now()}`
    
    // Idempotency
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('provider', 'lalamove')
      .eq('event_id', eventId)
      .maybeSingle()

    if (existingEvent) return c.json({ message: 'Duplicate' })

    await supabase.from('webhook_events').insert({ provider: 'lalamove', event_id: eventId, order_id: order.id })
    await supabase.from('delivery_events').insert({ order_id: order.id, provider: 'lalamove', event_type: eventType, raw_payload: body })

    const { updates, callLoyalty } = mapLalamoveStatus(lalamoveStatus, event)
    
    // Driver Details extraction
    const driverId = event.driverId ?? event.order?.driverId ?? body.driverId
    if (driverId && (!event.driver?.name)) {
      try {
        const env = c.env.LALAMOVE_SANDBOX === 'true' ? 'sandbox' : 'production'
        const baseUrl = getLalamoveBaseUrl(env)
        const driverPath = `/v3/orders/${lalamoveOrderId}/drivers/${driverId}`
        const headers = await buildLalamoveHeaders(c.env.LALAMOVE_API_KEY, c.env.LALAMOVE_API_SECRET, 'GET', driverPath, '', 'MY')
        const drvRes = await fetch(`${baseUrl}${driverPath}`, { headers })
        if (drvRes.ok) {
          const drvData = (await drvRes.json()) as any
          if (drvData.data) Object.assign(updates, mapLalamoveDriverInfo(drvData.data))
        }
      } catch (err) {}
    }

    if (Object.keys(updates).length > 1) {
      await supabase.from('orders').update(updates).eq('id', order.id)
    }

    // Secondary actions (Loyalty/Push) via Bridge to existing functions for now
    if (callLoyalty) {
      c.executionCtx.waitUntil(
        fetch(`${c.env.SUPABASE_URL}/functions/v1/award-loyalty-points`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${c.env.SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ orderId: order.id })
        })
      )
    }

    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 200)
  }
})

// --- Razorpay Webhook ---
webhooks.post('/razorpay', async (c) => {
  const body = await c.req.text()
  const signature = c.req.header('x-razorpay-signature') ?? ''
  const eventBody = JSON.parse(body)
  const supabase = getSupabaseClient(c.env)

  const merchantId = eventBody.payload?.payment?.entity?.notes?.merchant_id
  let secret = c.env.INTERNAL_SECRET // Default or fallback

  // Extract secret from merchant config if available
  if (merchantId) {
    const { data: config } = await supabase.from('merchant_razorpay_config').select('webhook_secret').eq('merchant_id', merchantId).single()
    if (config?.webhook_secret) secret = config.webhook_secret
  }

  const expected = await hmacSha256(secret, body)
  if (expected !== signature) return c.text('Unauthorized', 401)

  const gatewayRef = eventBody.payload?.payment?.entity?.id
  const eventType = eventBody.event
  const orderId = eventBody.payload?.payment?.entity?.notes?.hyperlocal_order_id

  // Log and Update
  await supabase.from('payment_events').insert({
    order_id: orderId || null,
    event_type: eventType,
    gateway: 'razorpay',
    gateway_ref: gatewayRef,
    raw_payload: eventBody,
  })

  if (eventType === 'payment.captured' && orderId) {
    await supabase.from('orders').update({
      status: 'paid',
      payment_status: 'paid',
      payment_reference: gatewayRef,
      paid_at: new Date().toISOString(),
    }).eq('id', orderId).eq('status', 'pending')
  }

  return c.json({ received: true })
})

export default webhooks
