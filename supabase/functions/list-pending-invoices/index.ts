import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { merchant_id, date_from, date_to, marketplace, invoice_type } = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Query orders that:
    // 1. Belong to merchant
    // 2. Are 'completed' or 'delivered'
    // 3. Do not have a 'valid' e-invoice already
    
    let query = supabase
      .from('orders')
      .select(`
        id, 
        order_number, 
        marketplace, 
        subtotal, 
        customer_name, 
        created_at,
        einvoices!left(status)
      `)
      .eq('merchant_id', merchant_id)
      .in('status', ['completed', 'delivered'])

    if (date_from) query = query.gte('created_at', date_from)
    if (date_to) query = query.lte('created_at', date_to)
    if (marketplace && marketplace !== 'all') query = query.eq('marketplace', marketplace)

    const { data: orders, error } = await query

    if (error) throw error

    // Filter out orders that already have a successful e-invoice
    const pending = (orders || []).filter(o => 
      !o.einvoices || o.einvoices.every((e: any) => e.status !== 'valid')
    ).map(o => ({
      ...o,
      einvoice_status: o.einvoices?.[0]?.status || 'not_started'
    }))

    // Further filter by invoice type if requested
    // B2B = needs individual (has buyer TIN or amount > 500)
    // B2C = can be consolidated (usually amount < 200)
    let filtered = pending
    if (invoice_type === 'individual') {
        filtered = pending.filter(o => Number(o.subtotal) > 500)
    } else if (invoice_type === 'consolidated') {
        filtered = pending.filter(o => Number(o.subtotal) <= 200)
    }

    return new Response(JSON.stringify(filtered), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
