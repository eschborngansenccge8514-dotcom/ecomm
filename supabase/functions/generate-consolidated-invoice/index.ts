import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { merchant_id, period_from, period_to, marketplace, max_amount } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // 1. Fetch Orders for consolidation
    let query = supabase
      .from("orders")
      .select("id, order_number, subtotal, tax_amount, total_amount, created_at, delivery_fee")
      .eq("merchant_id", merchant_id)
      .in("status", ["completed", "delivered"])
      .gte("created_at", period_from)
      .lte("created_at", period_to)
      .lte("subtotal", max_amount || 200);

    if (marketplace && marketplace !== 'all') query = query.eq('marketplace', marketplace);

    const { data: orders, error } = await query;
    if (error) throw error;

    if (!orders || orders.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, message: "No orders found for consolidation criteria." }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    // 2. Build Submission Record
    const batchId = `CON-${Date.now()}`;
    const { data: submission } = await supabase
      .from("einvoice_submissions")
      .insert({
        merchant_id,
        batch_id: batchId,
        order_ids: orders.map(o => o.id),
        invoice_type: "consolidated",
        status: "pending",
        submitted_at: new Date().toISOString()
      })
      .select()
      .single();

    // 3. Simulate LHDN Submission (using the uuid as internal ref for now)
    const mockLhdnUuid = `LHDN-CON-${crypto.randomUUID()}`;
    
    await supabase
      .from("einvoice_submissions")
      .update({
        status:    'submitted',
        lhdn_uuid: mockLhdnUuid
      })
      .eq('id', submission.id);

    // Update orders as processed
    await supabase
      .from("orders")
      .update({ einvoice_status: "consolidated" })
      .in("id", orders.map(o => o.id));

    return new Response(JSON.stringify({ 
      success: true, 
      batch_id: batchId,
      lhdn_uuid: mockLhdnUuid,
      count: orders.length 
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
});
