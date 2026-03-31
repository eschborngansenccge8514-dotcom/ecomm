import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: CORS })

  try {
    const { orderId } = await req.json()
    if (!orderId) throw new Error('orderId is required')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch order to get amount + customer details
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, profiles:customer_id(full_name, phone, email:id(email))')
      .eq('id', orderId)
      .single()

    if (error || !order) throw new Error('Order not found')
    if (order.status !== 'pending') throw new Error('Order is not in pending state')

    // 2. Load merchant-specific Razorpay keys or fallback to platform keys
    const { data: config } = await supabase
      .from('merchant_razorpay_config')
      .select('key_id, key_secret')
      .eq('merchant_id', order.merchant_id)
      .single()

    const keyId     = config?.key_id     || Deno.env.get('RAZORPAY_KEY_ID')!
    const keySecret = config?.key_secret || Deno.env.get('RAZORPAY_KEY_SECRET')!
    const authHeader = 'Basic ' + btoa(`${keyId}:${keySecret}`)

    // Amount in sen (smallest unit): RM 10.00 = 1000
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

    const razorpayOrder = await razorpayRes.json()

    // Store razorpay order ID against our order for later verification
    await supabase
      .from('orders')
      .update({ payment_reference: razorpayOrder.id })
      .eq('id', orderId)

    return new Response(
      JSON.stringify({
        razorpayOrderId: razorpayOrder.id,
        razorpayKeyId:   keyId,
        amount:          amountInSen,
        currency:        'MYR',
        orderNumber:     order.order_number,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
