import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getSupabaseClient } from "../_shared/marketplace.ts";
import { encryptJson } from "../../packages/integrations/crypto.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const shopId = url.searchParams.get("shop_id");
  const state = url.searchParams.get("state");

  if (!code || !shopId || !state) {
    return new Response("Missing required parameters", { status: 400 });
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
    return new Response("Invalid or expired state", { status: 400 });
  }

  // 2. Exchange code for access token (v2)
  const partnerId = Deno.env.get("SHOPEE_PARTNER_ID")!;
  const partnerKey = Deno.env.get("SHOPEE_PARTNER_KEY")!;
  const path = "/api/v2/auth/token/get";
  const timestamp = Math.floor(Date.now() / 1000);

  // HMAC signing for token exchange
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
    return new Response(`Token exchange failed: ${errText}`, { status: 500 });
  }

  const tokenData = await tokenRes.json();

  // 3. Encrypt and store credentials
  const encryptionKey = Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!;
  const encryptedPayload = encryptJson(tokenData, encryptionKey);

  // 4. Create or update marketplace account
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
    return new Response(`Failed to save account: ${accountError.message}`, { status: 500 });
  }

  // 5. Store specific Shopee credentials
  await supabase
    .from("marketplace_credentials")
    .upsert({
      tenant_id: stateRow.tenant_id,
      account_id: account.id,
      credential_type: "shopee_v2_tokens",
      encrypted_payload: encryptedPayload,
      expires_at: new Date(Date.now() + (tokenData.expire_in || 3600) * 1000).toISOString()
    });

  // 6. Redirect back to dashboard
  const dashboardUrl = `${Deno.env.get("APP_URL")}/integrations/shopee?success=true`;
  return Response.redirect(dashboardUrl, 302);
});
