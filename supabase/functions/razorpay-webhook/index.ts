import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

async function hmacSha256(key: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const keyData = enc.encode(key)
  const msgData = enc.encode(message)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Deploy with: supabase functions deploy razorpay-webhook --no-verify-jwt
serve(async (req) => {
  const body      = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''
  const eventBody = JSON.parse(body)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 1. Identify Merchant to fetch their unique Webhook Secret
  const merchantId = eventBody.payload?.payment?.entity?.notes?.merchant_id
  let secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')

  if (merchantId) {
    const { data: config } = await supabase
      .from('merchant_razorpay_config')
      .select('webhook_secret')
      .eq('merchant_id', merchantId)
      .single()
    
    if (config?.webhook_secret) {
      secret = config.webhook_secret
    }
  }

  if (!secret) {
    console.error('RAZORPAY_WEBHOOK_SECRET not found in environment or merchant config')
    return new Response('Configuration Error', { status: 500 })
  }

  // 2. Verify webhook authenticity using the secret
  const expected = await hmacSha256(secret, body)
  if (expected !== signature) {
    console.error('Webhook signature mismatch')
    return new Response('Unauthorized', { status: 401 })
  }

  const event = eventBody

  // 3. Idempotency Check
  const gatewayRef = event.payload?.payment?.entity?.id
  const eventType  = event.event

  if (gatewayRef) {
    const { data: existing } = await supabase
      .from('payment_events')
      .select('id')
      .eq('gateway', 'razorpay')
      .eq('gateway_ref', gatewayRef)
      .eq('event_type', eventType)
      .maybeSingle()

    if (existing) {
      console.log(`Duplicate event received: ${gatewayRef} (${eventType}). Skipping.`)
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  // 4. Log every webhook for audit
  await supabase.from('payment_events').insert({
    order_id:    event.payload?.payment?.entity?.notes?.hyperlocal_order_id || null,
    event_type:  eventType,
    gateway:     'razorpay',
    gateway_ref: gatewayRef,
    raw_payload: event,
  })

  // 5. Handle events
  if (event.event === 'payment.captured') {
    const payment  = event.payload.payment.entity
    const orderId  = payment.notes?.hyperlocal_order_id
    const type     = payment.notes?.type
    const topupId  = payment.notes?.topup_id

    // Case 1: Standard Order Payment
    if (orderId && !type) {
      await supabase
        .from('orders')
        .update({
          status:            'paid',
          payment_status:    'paid',
          payment_reference: payment.id,
          paid_at:           new Date().toISOString(),
        })
        .eq('id', orderId)
        .in('status', ['pending'])
    }

    // Case 2: Wallet Top-up
    if (type === 'wallet_topup' && topupId) {
      const amount = Number(payment.amount) / 100 // Convert from sen
      const merchantId = payment.notes.merchant_id

      // Get wallet
      const { data: wallet } = await supabase
        .from('merchant_wallets')
        .select('id')
        .eq('merchant_id', merchantId)
        .single()

      if (wallet) {
        // Atomic credit
        await supabase.rpc('handle_wallet_topup_credit', {
          p_wallet_id: wallet.id,
          p_topup_id:  topupId,
          p_amount:    amount,
          p_gateway:   'razorpay',
          p_ref:       payment.id
        })
      }
    }
  }

  if (event.event === 'payment.failed') {
    const payment = event.payload.payment.entity
    const orderId = payment.notes?.hyperlocal_order_id
    if (orderId) {
      await supabase.from('payment_events').insert({
        order_id:    orderId,
        event_type:  'payment_failed',
        gateway:     'razorpay',
        gateway_ref: payment.id,
        raw_payload: payment,
      })
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
