import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getSupabaseClient } from "../_shared/marketplace.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { tenant_id, region } = await req.json();
    if (!tenant_id) throw new Error("Missing tenant_id");

    const supabase = getSupabaseClient();
    const state = crypto.randomUUID();

    // 1. Fetch Merchant TikTok Config
    const { data: config, error: configError } = await supabase
      .from("merchant_tiktok_config")
      .select("app_key")
      .eq("merchant_id", tenant_id)
      .single();

    if (configError || !config) {
      return new Response(JSON.stringify({ error: "TikTok app configuration not found for this merchant. Please configure it first." }), { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Store OAuth state for verification on callback
    const { error: stateError } = await supabase
      .from("oauth_states")
      .insert({
        tenant_id,
        provider: "tiktok",
        state,
        metadata: { region },
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    if (stateError) throw stateError;

    // 3. Build TikTok Auth URL
    const appKey = config.app_key;
    
    // TikTok Shop V2 Authorize URL
    const authUrl = `https://auth.tiktok-shops.com/oauth/authorize?app_key=${appKey}&state=${state}`;

    return new Response(JSON.stringify({ authorization_url: authUrl }), {
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
