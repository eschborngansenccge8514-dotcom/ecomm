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
    const { tenant_id } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "Missing tenant_id" }), { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = getSupabaseClient();
    const state = crypto.randomUUID();

    // 2. Fetch Merchant Shopee Config
    const { data: config, error: configError } = await supabase
      .from("merchant_shopee_config")
      .select("partner_id, partner_key")
      .eq("merchant_id", tenant_id)
      .single();

    if (configError || !config) {
      return new Response(JSON.stringify({ error: "Shopee partner configuration not found for this merchant. Please configure it first." }), { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. Store OAuth state
    const { error: stateError } = await supabase
      .from("oauth_states")
      .insert({
        tenant_id,
        provider: "shopee",
        state,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    if (stateError) {
      return new Response(JSON.stringify({ error: stateError.message }), { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 4. Build Shopee Auth URL
    const partnerId = config.partner_id;
    const partnerKey = config.partner_key;
    const appUrl = Deno.env.get("APP_URL") || "http://localhost:3000";
    const redirectUri = `${appUrl}/api/integrations/shopee/callback`;

    const timestamp = Math.floor(Date.now() / 1000);
    const path = "/api/v2/shop/auth_partner";
    
    // Signature for auth = hash_hmac("sha256", partner_id + path + timestamp, partner_key)
    const baseString = `${partnerId}${path}${timestamp}`;
    const keyBuf = new TextEncoder().encode(partnerKey);
    const dataBuf = new TextEncoder().encode(baseString);
    const key = await crypto.subtle.importKey("raw", keyBuf, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, dataBuf);
    const sign = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");

    const authUrl = new URL("https://partner.shopeemobile.com/api/v2/shop/auth_partner");
    authUrl.searchParams.set("partner_id", partnerId);
    authUrl.searchParams.set("timestamp", String(timestamp));
    authUrl.searchParams.set("sign", sign);
    authUrl.searchParams.set("redirect", redirectUri);

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
