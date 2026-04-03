import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { query, limit, merchant_id } = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Simple keyword search on order_number, buyer_name, or items
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('merchant_id', merchant_id)
      .or(`order_number.ilike.%${query}%,buyer_name.ilike.%${query}%`)
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
