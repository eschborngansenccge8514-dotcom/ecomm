import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptJson } from "crypto";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return new Response("Missing code or state", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

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

    // 2. Exchange code for tokens
    const tokenRes = await fetch("https://open-api.tiktokglobalshop.com/api/v2/token/get", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_key: Deno.env.get("TIKTOK_APP_KEY"),
        app_secret: Deno.env.get("TIKTOK_APP_SECRET"),
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

    const shopId = tokenData.data.open_id; // Or specific shop ID if available in this flow

    // 3. Upsert Marketplace Account
    const { data: account, error: accountError } = await supabase
      .from("marketplace_accounts")
      .upsert({
        tenant_id: stateData.tenant_id,
        provider_id: "tiktok",
        shop_id: shopId,
        shop_name: seller_name,
        region: seller_base_region,
        status: "active"
      }, { onConflict: "tenant_id,provider_id,shop_id" })
      .select()
      .single();

    if (accountError) throw accountError;

    // 4. Store Encrypted Credentials
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
        credential_type: "oauth_tokens",
        encrypted_payload: encryptedTokens,
        expires_at: new Date(Date.now() + access_token_expire_in * 1000).toISOString(),
        is_active: true
      }, { onConflict: "account_id,credential_type" });

    if (credError) throw credError;

    // 5. Cleanup state
    await supabase.from("oauth_states").delete().eq("id", stateData.id);

    // 6. Redirect to dashboard
    const returnTo = stateData.metadata?.returnTo || "/integrations/tiktok";
    return Response.redirect(`${Deno.env.get("APP_URL")}${returnTo}?success=true`, 302);

  } catch (error: any) {
    console.error("TikTok Callback Error:", error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});
