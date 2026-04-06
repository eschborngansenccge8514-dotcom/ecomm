import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase.ts";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * create-purchase-order
 * 
 * Creates a new purchase order with items.
 * Expected body: { supplier_id, expected_date?, notes?, items[], merchant_id }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { supplier_id, expected_date, notes, items, merchant_id } = await req.json()
    if (!supplier_id || !items || !merchant_id) {
       throw new Error('Missing supplier_id, items, or merchant_id in request body');
    }

    const supabase = getSupabaseClient()

    // 1. Generate PO number
    const { data: po_number, error: poError } = await supabase
      .rpc('generate_po_number', { p_merchant_id: merchant_id })
    if (poError) throw poError

    // 2. Create PO
    const subtotal = items.reduce((acc: number, item: any) => acc + (item.quantity_ordered * item.unit_cost), 0)
    const total = subtotal

    const { data: po, error: createError } = await supabase
      .from('purchase_orders')
      .insert({
        merchant_id,
        po_number,
        supplier_id,
        expected_date,
        notes,
        subtotal,
        total,
        status: 'draft'
      })
      .select()
      .single()

    if (createError) throw createError

    // 3. Create items
    const itemsToInsert = items.map((item: any) => ({
      po_id: po.id,
      product_id: item.product_id,
      variant_id: item.variant_id || null,
      quantity_ordered: item.quantity_ordered,
      unit_cost: item.unit_cost,
      total: item.quantity_ordered * item.unit_cost
    }))

    const { error: itemError } = await supabase
      .from('purchase_order_items')
      .insert(itemsToInsert)

    if (itemError) throw itemError

    return new Response(JSON.stringify({ success: true, purchase_order: po }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error(`[create-purchase-order] Error: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
