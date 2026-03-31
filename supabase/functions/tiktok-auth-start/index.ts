import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { tenantId, returnTo } = await req.json();
    if (!tenantId) throw new Error("Missing tenantId");

    const state = crypto.randomUUID();

    // 1. Store OAuth state for verification on callback
    const { error: stateError } = await supabase
      .from("oauth_states")
      .insert({
        tenant_id: tenantId,
        provider: "tiktok",
        state,
        metadata: { returnTo }
      });

    if (stateError) throw stateError;

    // 2. Build TikTok Auth URL
    const appKey = Deno.env.get("TIKTOK_APP_KEY")!;
    const redirectUri = encodeURIComponent(`${Deno.env.get("APP_URL")}/api/integrations/tiktok/callback`);
    
    // TikTok Shop V2 Authorize URL
    const url = `https://auth.tiktok-shops.com/oauth/authorize?app_key=${appKey}&state=${state}`;

    return new Response(JSON.stringify({ authorizationUrl: url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
