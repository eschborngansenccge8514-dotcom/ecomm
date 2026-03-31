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

// Deploy with: supabase functions deploy billplz-webhook --no-verify-jwt
serve(async (req) => {
  const body        = await req.text()
  const params      = new URLSearchParams(body)
  const xSignature  = Deno.env.get('BILLPLZ_X_SIGNATURE_KEY')!

  // ── Billplz X-Signature verification ────────────────────────────────────────
  // Signature = HMAC-SHA256 of pipe-delimited sorted param values (excluding x_signature)
  const keysToSign = ['billplz[id]', 'billplz[collection_id]', 'billplz[paid]',
                      'billplz[state]', 'billplz[amount]', 'billplz[paid_amount]',
                      'billplz[due_at]', 'billplz[email]', 'billplz[mobile]',
                      'billplz[name]', 'billplz[url]', 'billplz[reference_1]',
                      'billplz[reference_2]']

  const signedString = keysToSign
    .map(k => `${k}${params.get(k) ?? ''}`)
    .join('|')

  const computedSig = await hmacSha256(xSignature, signedString)
  const receivedSig = params.get('x_signature') ?? ''

  if (computedSig !== receivedSig) {
    console.error('Billplz signature mismatch')
    return new Response('Unauthorized', { status: 401 })
  }

  const billId  = params.get('billplz[id]') ?? ''
  const paid    = params.get('billplz[paid]') === 'true'
  const orderId = params.get('billplz[reference_1]') ?? ''

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // ─── Idempotency Check ───────────────────────────────────────────────────────
  const eventType = paid ? 'payment_captured' : 'payment_failed'

  if (billId) {
    const { data: existing } = await supabase
      .from('payment_events')
      .select('id')
      .eq('gateway', 'billplz')
      .eq('gateway_ref', billId)
      .eq('event_type', eventType)
      .maybeSingle()

    if (existing) {
      console.log(`Duplicate event received: ${billId} (${eventType}). Skipping.`)
      return new Response('OK', { status: 200 })
    }
  }

  // Log event
  await supabase.from('payment_events').insert({
    order_id:    orderId || null,
    event_type:  eventType,
    gateway:     'billplz',
    gateway_ref: billId,
    raw_payload: Object.fromEntries(params.entries()),
  })


  if (paid && orderId) {
    await supabase
      .from('orders')
      .update({
        status:            'paid',
        payment_status:    'paid',
        payment_reference: billId,
        paid_at:           new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('status', 'pending')
  }

  return new Response('OK', { status: 200 })
})
