import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase.ts";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * get-purchase-order
 * 
 * Fetches single purchase order with items and supplier info.
 * Expected body: { po_id: string, merchant_id: string }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { po_id, merchant_id } = await req.json()
    if (!po_id || !merchant_id) {
       throw new Error('Missing po_id or merchant_id in request body');
    }

    const supabase = getSupabaseClient()

    const { data: po, error } = await supabase
      .from('purchase_orders')
      .select('*, suppliers(*), purchase_order_items(*, products(name))')
      .eq('id', po_id)
      .eq('merchant_id', merchant_id)
      .single()

    if (error) throw error

    return new Response(JSON.stringify({ purchase_order: po }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error(`[get-purchase-order] Error: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
