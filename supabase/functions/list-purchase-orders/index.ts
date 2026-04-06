import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase.ts";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * list-purchase-orders
 * 
 * Fetches purchase orders for the merchant with optional filters.
 * Expected body: { status?, date_from?, date_to?, limit?, merchant_id }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { status, date_from, date_to, limit = 10, merchant_id } = await req.json()
    if (!merchant_id) throw new Error('Missing merchant_id in request body');
    
    const supabase = getSupabaseClient()

    let query = supabase
      .from('purchase_orders')
      .select('*, suppliers(name)')
      .eq('merchant_id', merchant_id)

    if (status) query = query.eq('status', status)
    if (date_from) query = query.gte('order_date', date_from)
    if (date_to) query = query.lte('order_date', date_to)

    const { data: pos, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return new Response(JSON.stringify({ purchase_orders: pos }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error(`[list-purchase-orders] Error: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
