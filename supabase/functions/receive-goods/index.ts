import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase.ts";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * receive-goods
 * 
 * Records a partial or full delivery of goods for a purchase order.
 * Expected body: { po_id, items: [{po_item_id, quantity}], notes?, merchant_id }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { po_id, items, notes, merchant_id } = await req.json()
    if (!po_id || !items || !merchant_id) {
       throw new Error('Missing po_id, items, or merchant_id in request body');
    }

    const supabase = getSupabaseClient()

    // 1. Create Goods Receipt record
    const { data: receipt, error: receiptError } = await supabase
      .from('goods_receipts')
      .insert({
        po_id,
        merchant_id,
        // Since this is called from the agent (edge worker), 
        // we might not have a user context in the same way as the dashboard.
        // We'll leave received_by as null or use a system placeholder if needed.
        notes: notes || `Received via AI Assistant`
      })
      .select()
      .single()

    if (receiptError) throw receiptError

    // 2. Call the database RPC to update items and stock
    const { error: rpcError } = await supabase.rpc('receive_goods', {
      p_receipt_id: receipt.id,
      p_items: items
    })

    if (rpcError) throw rpcError

    return new Response(JSON.stringify({ success: true, receipt_id: receipt.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error(`[receive-goods] Error: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
