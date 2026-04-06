import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase.ts";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * send-purchase-order
 * 
 * Reuses the logic to mark a PO as sent and triggers the email.
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

    // 1. Update status
    const { data: po, error: updateError } = await supabase
      .from('purchase_orders')
      .update({ 
        status: 'sent', 
        order_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
       })
      .eq('id', po_id)
      .eq('merchant_id', merchant_id)
      .select()
      .single()

    if (updateError) throw updateError

    // 2. Trigger email
    // This is handled by another edge function
    await supabase.functions.invoke('send-po-email', {
      body: { po_id, merchant_id }
    })

    return new Response(JSON.stringify({ success: true, purchase_order: po }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error(`[send-purchase-order] Error: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
