import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getSupabaseClient } from "../_shared/marketplace.ts";
import { encryptJson } from "../../packages/integrations/crypto.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const shopId = url.searchParams.get("shop_id");
  const state = url.searchParams.get("state");

  if (!code || !shopId || !state) {
    return new Response("Missing required parameters", { 
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const supabase = getSupabaseClient();

  // 1. Verify OAuth state
  const { data: stateRow, error: stateError } = await supabase
    .from("oauth_states")
    .select("*")
    .eq("state", state)
    .eq("provider", "shopee")
    .single();

  if (stateError || !stateRow) {
    return new Response("Invalid or expired state", { 
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // 2. Fetch Merchant Shopee Config
  const { data: config, error: configError } = await supabase
    .from("merchant_shopee_config")
    .select("partner_id, partner_key")
    .eq("merchant_id", stateRow.tenant_id)
    .single();

  if (configError || !config) {
    return new Response("Shopee configuration not found for this merchant.", { 
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // 3. Exchange code for access token (v2)
  const partnerId = config.partner_id;
  const partnerKey = config.partner_key;
  const path = "/api/v2/auth/token/get";
  const timestamp = Math.floor(Date.now() / 1000);

  // HMAC signing for token exchange (partner_id + path + timestamp)
  const baseString = `${partnerId}${path}${timestamp}`;
  const keyBuf = new TextEncoder().encode(partnerKey);
  const dataBuf = new TextEncoder().encode(baseString);
  const key = await crypto.subtle.importKey("raw", keyBuf, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, dataBuf);
  const sign = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");

  const tokenRes = await fetch(`https://partner.shopeemobile.com${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-PARTNER-ID": partnerId,
      "X-TIMESTAMP": String(timestamp),
      "X-SIGN": sign
    },
    body: JSON.stringify({
      code,
      partner_id: parseInt(partnerId),
      shop_id: parseInt(shopId)
    })
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    return new Response(`Token exchange failed: ${errText}`, { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const tokenData = await tokenRes.json();

  // 4. Encrypt and store credentials
  const encryptionKey = Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!;
  const encryptedPayload = encryptJson(tokenData, encryptionKey);

  // 5. Create or update marketplace account
  const { data: account, error: accountError } = await supabase
    .from("marketplace_accounts")
    .upsert({
      tenant_id: stateRow.tenant_id,
      provider_id: "shopee",
      shop_id: shopId,
      status: "active",
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (accountError) {
    return new Response(`Failed to save account: ${accountError.message}`, { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // 6. Store specific Shopee credentials
  await supabase
    .from("marketplace_credentials")
    .upsert({
      tenant_id: stateRow.tenant_id,
      account_id: account.id,
      credential_type: "shopee_v2_tokens",
      encrypted_payload: encryptedPayload,
      expires_at: new Date(Date.now() + (tokenData.expire_in || 3600) * 1000).toISOString()
    });

  // 7. Redirect back to dashboard
  const appUrl = Deno.env.get("APP_URL") || "http://localhost:3000";
  const dashboardUrl = `${appUrl}/marketplace/shopee?success=true`;
  return Response.redirect(dashboardUrl, 302);
});
