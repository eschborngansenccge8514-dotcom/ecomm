import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { segment, limit, sort_by, merchant_id } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Segment Logic:
    // VIP: Top 10% by total_spent_rm
    // Loyal: 3+ orders
    // At-Risk: No order in 60 days
    // New: First order within 30 days
    // Lapsed: No order in 180 days

    let query = supabase
      .from('loyalty_points')
      .select('*, customers(id, name, email, phone)')
      .eq('merchant_id', merchant_id);

    if (segment === 'vip') {
        const { data: top } = await supabase.from('loyalty_points').select('total_spent_rm').eq('merchant_id', merchant_id).order('total_spent_rm', { ascending: false }).limit(10);
        const threshold = top?.[top.length - 1]?.total_spent_rm || 0;
        query = query.gte('total_spent_rm', threshold);
    } else if (segment === 'loyal') {
        // Assume total_earned tracks count or use points
        query = query.gte('total_earned', 500); // placeholder for loyalty logic
    } else if (segment === 'at_risk') {
        const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
        query = query.lt('updated_at', sixtyDaysAgo);
    } else if (segment === 'new') {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gt('created_at', thirtyDaysAgo);
    } else if (segment === 'lapsed') {
        const oneEightyDaysAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
        query = query.lt('updated_at', oneEightyDaysAgo);
    }

    if (sort_by === 'lifetime_value') query = query.order('total_spent_rm', { ascending: false });
    else if (sort_by === 'last_order_date') query = query.order('updated_at', { ascending: false });

    const { data: results, error } = await query.limit(limit || 20);
    if (error) throw error;

    return new Response(JSON.stringify(results || []), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
});
