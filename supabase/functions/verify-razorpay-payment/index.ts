import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: CORS })

  const ok  = (data: any) => new Response(JSON.stringify(data), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  const err = (msg: string, code = 400) => new Response(JSON.stringify({ error: msg }), { status: code, headers: { ...CORS, 'Content-Type': 'application/json' } })

  try {
    const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = await req.json()

    // 1. Initialize Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 2. Fetch the order to find the merchant
    const { data: order } = await supabase
      .from('orders')
      .select('merchant_id')
      .eq('id', orderId)
      .single()

    if (!order) throw new Error('Order not found')

    // 3. Load merchant-specific Razorpay keys or fallback to platform keys
    const { data: config } = await supabase
      .from('merchant_razorpay_config')
      .select('key_secret')
      .eq('merchant_id', order.merchant_id)
      .single()

    // 4. Signature Verification
    // Razorpay signature = HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
    const keySecret = config?.key_secret || Deno.env.get('RAZORPAY_KEY_SECRET')!
    const payload   = `${razorpayOrderId}|${razorpayPaymentId}`
    const expected  = await hmacSha256(keySecret, payload)

    if (expected !== razorpaySignature) {
      throw new Error('Invalid payment signature — possible tampering detected')
    }

    // 5. Update order in DB

    const { error } = await supabase
      .from('orders')
      .update({
        status:              'paid',
        payment_status:      'paid',
        payment_reference:   razorpayPaymentId,
        paid_at:             new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('status', 'pending') // Idempotency guard

    if (error) throw error

    // Log payment event
    await supabase.from('payment_events').insert({
      order_id:       orderId,
      event_type:     'payment_verified',
      gateway:        'razorpay',
      gateway_ref:    razorpayPaymentId,
      raw_payload:    { razorpayOrderId, razorpayPaymentId },
    })

    return ok({ success: true })
  } catch (error: any) {
    console.error('[verify-razorpay-payment] Error:', error.message)
    return err(error.message)
  }
})
