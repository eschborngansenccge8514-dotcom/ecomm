import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase.ts";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * list-suppliers
 * 
 * Lists suppliers for a merchant.
 * Expected body: { limit?, merchant_id }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { limit = 50, merchant_id } = await req.json()
    if (!merchant_id) throw new Error('Missing merchant_id in request body');
    
    const supabase = getSupabaseClient()

    const { data: suppliers, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('merchant_id', merchant_id)
      .order('name', { ascending: true })
      .limit(limit)

    if (error) throw error

    return new Response(JSON.stringify({ suppliers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error(`[list-suppliers] Error: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
