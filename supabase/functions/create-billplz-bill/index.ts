import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BILLPLZ_BASE = 'https://www.billplz-sandbox.com/api' // change to billplz.com for production

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { orderId } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: order, error } = await supabase
      .from('orders')
      .select('*, profile:customer_id(full_name, phone)')
      .eq('id', orderId)
      .single()

    if (error || !order) throw new Error('Order not found')

    const apiKey        = Deno.env.get('BILLPLZ_API_KEY')!
    const collectionId  = Deno.env.get('BILLPLZ_COLLECTION_ID')!
    const supabaseUrl   = Deno.env.get('SUPABASE_URL')!
    const authHeader    = 'Basic ' + btoa(`${apiKey}:`)

    // Billplz amount is in cents: RM 10.00 = 1000
    const amountInCents = Math.round(Number(order.total_amount) * 100)

    const params = new URLSearchParams({
      collection_id:     collectionId,
      name:              order.profile?.full_name ?? 'Customer',
      email:             'noreply@hyperlocal.app', // use real email if available
      mobile:            order.profile?.phone ?? '',
      amount:            String(amountInCents),
      description:       `Order ${order.order_number}`,
      callback_url:      `${supabaseUrl}/functions/v1/billplz-webhook`,
      redirect_url:      `${supabaseUrl}/functions/v1/billplz-redirect`,
      reference_1_label: 'Order ID',
      reference_1:       orderId,
    })

    const billplzRes = await fetch(`${BILLPLZ_BASE}/v3/bills`, {
      method:  'POST',
      headers: { 'Authorization': authHeader },
      body:    params,
    })

    if (!billplzRes.ok) {
      const err = await billplzRes.text()
      throw new Error(`Billplz error: ${err}`)
    }

    const bill = await billplzRes.json()

    // Store bill ID for later verification
    await supabase
      .from('orders')
      .update({ payment_reference: bill.id })
      .eq('id', orderId)

    return new Response(
      JSON.stringify({ billUrl: bill.url, billId: bill.id }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
