import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BILLPLZ_BASE = 'https://www.billplz-sandbox.com/api' // change to billplz.com for production

async function generateChecksum(data: string, secret: string) {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(data)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: CORS })

  const ok = (data: any) => new Response(JSON.stringify(data),        { headers: { ...CORS, 'Content-Type': 'application/json' } })
  const err = (msg: string, code = 400) => new Response(JSON.stringify({ error: msg }), { status: code, headers: { ...CORS, 'Content-Type': 'application/json' } })

  try {
    const { orderId, reason, bankCode, accountName, accountNumber } = await req.json()
    if (!orderId) throw new Error('orderId is required')
    if (!bankCode || !accountName || !accountNumber) {
      throw new Error('Bank details (bankCode, accountName, accountNumber) are required for Billplz refunds')
    }

    // 1. Initialize Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 2. Validate User Auth
    const authHeader    = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Authorization header missing')
    
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authErr || !user) throw new Error('Unauthorized')

    // 3. Fetch Order + Merchant + Config
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*, merchants!orders_merchant_id_fkey(*)')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) throw new Error('Order not found')
    if (order.merchants.owner_id !== user.id) throw new Error('Unauthorized: You do not own this order')
    if (order.payment_method !== 'billplz') throw new Error('Only Billplz orders can be refunded through this endpoint')
    if (order.payment_status === 'refunded') throw new Error('Order is already refunded')

    // 3b. Fetch Merchant Billplz Config
    const { data: config } = await supabase
      .from('merchant_billplz_config')
      .select('collection_id, payment_order_collection_id, x_signature')
      .eq('merchant_id', order.merchant_id)
      .single()

    const collectionId = config?.payment_order_collection_id || 
                         Deno.env.get('BILLPLZ_PAYMENT_ORDER_COLLECTION_ID') ||
                         config?.collection_id || 
                         Deno.env.get('BILLPLZ_COLLECTION_ID')

    const xSignature   = config?.x_signature   || Deno.env.get('BILLPLZ_X_SIGNATURE') || Deno.env.get('BILLPLZ_X_SIGNATURE_KEY')

    if (!collectionId) throw new Error('Merchant Billplz Payment Order Collection ID not found. Ensure BILLPLZ_PAYMENT_ORDER_COLLECTION_ID is set in secrets or configured for the merchant.')
    if (!xSignature)  throw new Error('Merchant Billplz X-Signature not found. Ensure BILLPLZ_X_SIGNATURE_KEY is set in Supabase Secrets (Vault) or configured in the Merchant Dashboard.')

    // 4. Retrieve Billplz API Key from Secrets
    const apiKey = Deno.env.get('BILLPLZ_API_KEY')
    if (!apiKey) throw new Error('BILLPLZ_API_KEY secret is not configured')
    
    const billplzAuth = 'Basic ' + btoa(`${apiKey}:`)

    // 5. Build Billplz Payment Order Payload (V5)
    // Billplz amount for Payment Order is in cents
    const totalCents = Math.round(Number(order.total_amount) * 100)
    const epoch      = Math.floor(Date.now() / 1000)

    // Checksum data: payment_order_collection_id, bank_account_number, total, epoch
    // V5 requires direct concatenation of values WITHOUT delimiters
    const checksumStr = `${collectionId}${accountNumber}${totalCents}${epoch}`
    const checksum    = await generateChecksum(checksumStr, xSignature)

    const v5Payload = {
      payment_order_collection_id: collectionId,
      bank_code:           bankCode,
      bank_account_number: accountNumber,
      name:                accountName,
      description:         `Refund for Order ${order.order_number}`,
      total:               totalCents,
      epoch:               epoch,
      checksum:            checksum,
    }

    console.log(`[billplz-refund] Creating V5 Payment Order for order ${order.order_number}`)
    console.log(`[billplz-refund] Checksum String (Masked): ${collectionId.substring(0,4)}...${accountNumber.slice(-4)}${totalCents}${epoch}`)

    const billplzRes = await fetch(`${BILLPLZ_BASE}/v5/payment_orders`, {
      method:  'POST',
      headers: {
        'Authorization': billplzAuth,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(v5Payload)
    })

    const billplzData = await billplzRes.json()

    if (!billplzRes.ok) {
      console.error('[billplz-refund] Billplz V5 API failed:', billplzData)
      throw new Error(`Billplz Error: ${billplzData.error?.message || JSON.stringify(billplzData)}`)
    }

    // 6. Update Order in DB
    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        status:          'refunded',
        payment_status:  'refunded',
        refund_id:       billplzData.id,
        refunded_at:     new Date().toISOString(),
        is_refunded:     true,
        refunded_amount: order.total_amount
      })
      .eq('id', orderId)

    if (updateErr) throw updateErr

    // 6b. Insert into refunds ledger
    await supabase.from('refunds').insert({
      order_id:       orderId,
      merchant_id:    order.merchant_id,
      customer_id:    order.customer_id,
      amount:         order.total_amount,
      reason:         reason || 'Billplz Refund (V5 Payment Order)',
      status:         'approved',
      refund_method:  'original_payment',
      processed_at:   new Date().toISOString()
    })

    // 7. Log event
    await supabase.from('payment_events').insert({
      order_id:    orderId,
      event_type:  'refunded',
      gateway:     'billplz',
      gateway_ref: billplzData.id,
      raw_payload: billplzData,
    })

    return ok({ success: true, refundId: billplzData.id })

  } catch (err: any) {
    console.error('[billplz-refund] Error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
