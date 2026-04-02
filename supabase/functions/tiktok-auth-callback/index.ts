import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getSupabaseClient } from "../_shared/marketplace.ts";
import { encryptJson } from "../../packages/integrations/crypto.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return new Response("Missing code or state", { 
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const supabase = getSupabaseClient();

  try {
    // 1. Verify state
    const { data: stateData, error: stateError } = await supabase
      .from("oauth_states")
      .select("*")
      .eq("state", state)
      .eq("provider", "tiktok")
      .single();

    if (stateError || !stateData) {
      throw new Error("Invalid or expired state");
    }

    // 2. Fetch Merchant TikTok Config
    const { data: config, error: configError } = await supabase
      .from("merchant_tiktok_config")
      .select("app_key, app_secret")
      .eq("merchant_id", stateData.tenant_id)
      .single();

    if (configError || !config) {
      throw new Error("TikTok configuration not found for this merchant.");
    }

    // 3. Exchange code for tokens
    const tokenRes = await fetch("https://open-api.tiktokglobalshop.com/api/v2/token/get", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_key: config.app_key,
        app_secret: config.app_secret,
        auth_code: code,
        grant_type: "authorized_code"
      })
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Token exchange failed: ${err}`);
    }

    const tokenData = await tokenRes.json();
    if (tokenData.code !== 0) {
      throw new Error(`TikTok API error: ${tokenData.message}`);
    }

    const { 
      access_token, 
      access_token_expire_in, 
      refresh_token, 
      refresh_token_expire_in,
      seller_name,
      seller_base_region
    } = tokenData.data;

    const shopId = tokenData.data.open_id; 

    // 4. Upsert Marketplace Account
    const { data: account, error: accountError } = await supabase
      .from("marketplace_accounts")
      .upsert({
        tenant_id: stateData.tenant_id,
        provider_id: "tiktok",
        shop_id: shopId,
        shop_name: seller_name,
        region: seller_base_region,
        status: "active",
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (accountError) throw accountError;

    // 5. Store Encrypted Credentials
    const encryptionKey = Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!;
    const encryptedTokens = encryptJson({
      access_token,
      refresh_token
    }, encryptionKey);

    const { error: credError } = await supabase
      .from("marketplace_credentials")
      .upsert({
        tenant_id: stateData.tenant_id,
        account_id: account.id,
        credential_type: "tiktok_tokens",
        encrypted_payload: encryptedTokens,
        expires_at: new Date(Date.now() + access_token_expire_in * 1000).toISOString(),
        is_active: true,
        updated_at: new Date().toISOString()
      });

    if (credError) throw credError;

    // 6. Cleanup state
    await supabase.from("oauth_states").delete().eq("id", stateData.id);

    // 7. Redirect back to dashboard
    const appUrl = Deno.env.get("APP_URL") || "http://localhost:3000";
    const dashboardUrl = `${appUrl}/marketplace/tiktok?success=true`;
    return Response.redirect(dashboardUrl, 302);

  } catch (error: any) {
    console.error("TikTok Callback Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
