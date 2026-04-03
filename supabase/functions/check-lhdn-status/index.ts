import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { identifiers, identifier_type, merchant_id } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    let query = supabase.from("einvoice_submissions").select("*");
    
    if (identifier_type === 'lhdn_uuid') query = query.in("lhdn_uuid", identifiers);
    else if (identifier_type === 'batch_id') query = query.in("batch_id", identifiers);
    else if (identifier_type === 'order_id') query = query.contains("order_ids", identifiers);

    const { data: results, error } = await query;
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
