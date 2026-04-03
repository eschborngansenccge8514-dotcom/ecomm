import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { identifier, identifier_type, merchant_id } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    let query = supabase.from("customers").select("*, loyalty_points(*)");
    
    if (identifier_type === 'customer_id') query = query.eq("id", identifier);
    else if (identifier_type === 'email') query = query.eq("email", identifier);
    else if (identifier_type === 'phone') query = query.eq("phone", identifier);

    const { data: customer, error } = await query.eq('merchant_id', merchant_id).single();
    if (error) throw error;

    // Fetch last 5 orders
    const { data: orders } = await supabase
      .from("orders")
      .select("id, order_number, total_amount, status, created_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(5);

    return new Response(JSON.stringify({
      ...customer,
      recent_orders: orders || []
    }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
});
