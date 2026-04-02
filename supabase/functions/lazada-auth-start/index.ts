import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getSupabaseClient } from "../_shared/marketplace.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Get request body
    const { tenant_id, region } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "Missing tenant_id" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const supabase = getSupabaseClient();
    const state = crypto.randomUUID();

    // 2. Fetch Merchant Lazada Config
    const { data: config, error: configError } = await supabase
      .from("merchant_lazada_config")
      .select("app_key")
      .eq("merchant_id", tenant_id)
      .single();

    if (configError || !config) {
      return new Response(JSON.stringify({ error: "Lazada app configuration not found for this merchant. Please configure it first." }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 3. Store OAuth state
    const { error: stateError } = await supabase
      .from("oauth_states")
      .insert({
        tenant_id,
        provider: "lazada",
        state,
        metadata: { region },
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    if (stateError) {
      return new Response(JSON.stringify({ error: stateError.message }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 4. Build Lazada Auth URL
    const clientId = config.app_key;
    const appUrl = Deno.env.get("APP_URL") || "http://localhost:3000";
    const redirectUri = `${appUrl}/api/integrations/lazada/callback`;

    // Lazada Auth URL: https://auth.lazada.com/oauth/authorize
    const authUrl = new URL("https://auth.lazada.com/oauth/authorize");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("force_auth", "true");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    return new Response(
      JSON.stringify({ authorization_url: authUrl.toString(), state }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
