import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { period, merchant_id } = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Calculate time range
    let startDate = new Date()
    if (period === 'today') startDate.setHours(0,0,0,0)
    else if (period === 'this_week') startDate.setDate(startDate.getDate() - startDate.getDay())
    else if (period === 'last_week') startDate.setDate(startDate.getDate() - startDate.getDay() - 7)
    else if (period === 'this_month') startDate.setDate(1)
    else if (period === 'last_month') { startDate.setMonth(startDate.getMonth() - 1); startDate.setDate(1) }

    const { data: orders } = await supabase
      .from('orders')
      .select('id, status, delivery_status, delivery_provider, delivery_fee')
      .eq('merchant_id', merchant_id)
      .gte('created_at', startDate.toISOString())

    if (!orders) return new Response(JSON.stringify({ summary: 'No orders found' }), { headers: CORS })

    const summary = {
      total_shipped: orders.filter(o => o.status === 'shipped' || o.status === 'completed').length,
      pending_fulfillment: orders.filter(o => o.status === 'paid' || o.status === 'processing').length,
      provider_breakdown: orders.reduce((acc: any, o) => {
        const p = o.delivery_provider || 'other'
        acc[p] = (acc[p] || 0) + 1
        return acc
      }, {}),
      total_delivery_fees: orders.reduce((acc, o) => acc + (Number(o.delivery_fee) || 0), 0)
    }

    return new Response(JSON.stringify(summary), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
