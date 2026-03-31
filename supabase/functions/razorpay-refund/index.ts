import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: CORS })

  const ok  = (data: any) => new Response(JSON.stringify(data),        { headers: { ...CORS, 'Content-Type': 'application/json' } })
  const err = (msg: string, code = 400) => new Response(JSON.stringify({ error: msg }), { status: code, headers: { ...CORS, 'Content-Type': 'application/json' } })

  try {
    const { orderId, amount } = await req.json()
    if (!orderId) throw new Error('orderId is required')

    // 1. Initialize Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 2. Validate User Auth
    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authErr || !user) throw new Error('Unauthorized')

    // 3. Fetch Order + Merchant + Razorpay Config
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*, merchants!orders_merchant_id_fkey(*)')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) throw new Error('Order not found')
    if (order.merchants.owner_id !== user.id) throw new Error('Unauthorized: You do not own this order')
    if (order.payment_method !== 'razorpay') throw new Error('Only Razorpay orders can be refunded through this endpoint')
    if (!order.payment_reference) throw new Error('No payment reference found for this order')
    if (order.payment_status === 'refunded') throw new Error('Order is already refunded')

    // 4. Fetch Razorpay Config for this merchant
    const { data: config, error: configErr } = await supabase
      .from('merchant_razorpay_config')
      .select('*')
      .eq('merchant_id', order.merchant_id)
      .single()

    const keyId     = config?.key_id      || Deno.env.get('RAZORPAY_KEY_ID')
    const keySecret = config?.key_secret  || Deno.env.get('RAZORPAY_KEY_SECRET')

    if (!keyId || !keySecret) throw new Error('Razorpay configuration missing for this merchant')

    const razorpayAuth = 'Basic ' + btoa(`${keyId}:${keySecret}`)

    // 5. Call Razorpay Refund API
    // POST /v1/payments/{payment_id}/refund
    const refundPayload: any = {
      notes: { order_id: orderId, merchant_id: order.merchant_id }
    }
    
    // Optional: Partial refund if amount provided
    if (amount) {
      refundPayload.amount = Math.round(Number(amount) * 100)
    }

    const razorpayRes = await fetch(`https://api.razorpay.com/v1/payments/${order.payment_reference}/refund`, {
      method: 'POST',
      headers: {
        'Authorization': razorpayAuth,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(refundPayload)
    })

    const razorpayData = await razorpayRes.json()

    if (!razorpayRes.ok) {
      throw new Error(`Razorpay Error: ${razorpayData.error?.description || JSON.stringify(razorpayData)}`)
    }

    // 6. Update Order in DB
    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        status:          'refunded',
        payment_status:  'refunded',
        refund_id:       razorpayData.id,
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
      reason:         'Razorpay Refund',
      status:         'approved',
      refund_method:  'original_payment',
      processed_at:   new Date().toISOString()
    })

    // 7. Log event
    await supabase.from('payment_events').insert({
      order_id:    orderId,
      event_type:  'refunded',
      gateway:     'razorpay',
      gateway_ref: razorpayData.id,
      raw_payload: razorpayData,
    })

    return ok({ success: true, refundId: razorpayData.id })

  } catch (err: any) {
    console.error('[razorpay-refund] Error:', err.message)
    const errorResponse = (msg: string, code = 400) => new Response(JSON.stringify({ error: msg }), { status: code, headers: { ...CORS, 'Content-Type': 'application/json' } })
    return errorResponse(err.message)
  }
})
