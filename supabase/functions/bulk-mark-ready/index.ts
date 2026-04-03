import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { order_ids, marketplace, merchant_id } = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let query = supabase.from('orders')
      .update({ status: 'ready_for_pickup', updated_at: new Date().toISOString() })
      .eq('merchant_id', merchant_id)
      .in('status', ['paid', 'processing'])

    if (order_ids && order_ids.length > 0) {
      query = query.in('id', order_ids)
    } else if (marketplace && marketplace !== 'all') {
      query = query.eq('marketplace', marketplace)
    }

    const { data, error, count } = await query.select('id', { count: 'exact' })

    if (error) throw error

    return new Response(JSON.stringify({ success: true, count, ids: data?.map(o => o.id) }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
