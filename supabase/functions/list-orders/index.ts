import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { status, marketplace, period, limit, merchant_id } = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let query = supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('merchant_id', merchant_id)

    if (status) query = query.eq('status', status)
    if (marketplace) query = query.eq('marketplace', marketplace)

    if (period) {
      const now = new Date()
      let startDate = new Date()
      switch(period) {
        case 'today':
          startDate.setHours(0,0,0,0)
          break
        case 'yesterday':
          startDate.setDate(now.getDate() - 1)
          startDate.setHours(0,0,0,0)
          const endDate = new Date(startDate)
          endDate.setHours(23,59,59,999)
          query = query.lte('created_at', endDate.toISOString())
          break
        case 'this_week':
          startDate.setDate(now.getDate() - now.getDay())
          startDate.setHours(0,0,0,0)
          break
        case 'this_month':
          startDate.setDate(1)
          startDate.setHours(0,0,0,0)
          break
      }
      query = query.gte('created_at', startDate.toISOString())
    }

    const { data: orders, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit || 10)

    if (error) throw error

    return new Response(JSON.stringify({ orders }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
