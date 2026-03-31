import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getSupabaseClient } from "../_shared/marketplace.ts";
import { encryptJson } from "../../packages/integrations/crypto.ts";
import { signLazadaRequest } from "../../packages/integrations/lazada/signature.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return new Response("Missing required parameters", { status: 400 });
  }

  const supabase = getSupabaseClient();

  // 1. Verify OAuth state
  const { data: stateRow, error: stateError } = await supabase
    .from("oauth_states")
    .select("*")
    .eq("state", state)
    .eq("provider", "lazada")
    .single();

  if (stateError || !stateRow) {
    return new Response("Invalid or expired state", { status: 400 });
  }

  // 2. Exchange code for access token
  const appKey = Deno.env.get("LAZADA_APP_KEY")!;
  const appSecret = Deno.env.get("LAZADA_APP_SECRET")!;
  const timestamp = Date.now().toString();
  const path = "/auth/token/create";

  const params: Record<string, string> = {
    code,
    app_key: appKey,
    timestamp,
    sign_method: "sha256",
  };

  const sign = signLazadaRequest(path, params, appSecret);

  // Lazada token creation endpoint
  const tokenUrl = new URL("https://auth.lazada.com/rest/auth/token/create");
  Object.entries(params).forEach(([k, v]) => tokenUrl.searchParams.append(k, v));
  tokenUrl.searchParams.append("sign", sign);

  const tokenRes = await fetch(tokenUrl.toString(), {
    method: "POST",
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    return new Response(`Token exchange failed: ${errText}`, { status: 500 });
  }

  const tokenData = await tokenRes.json();
  if (tokenData.code !== "0") {
    return new Response(`Lazada API error: ${tokenData.message || tokenData.request_id}`, { status: 500 });
  }

  // 3. Encrypt and store credentials
  const encryptionKey = Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!;
  const encryptedPayload = encryptJson(tokenData, encryptionKey);

  // 4. Create or update marketplace account
  const { data: account, error: accountError } = await supabase
    .from("marketplace_accounts")
    .upsert({
      tenant_id: stateRow.tenant_id,
      provider_id: "lazada",
      shop_id: String(tokenData.country_user_info?.[0]?.seller_id || tokenData.account_id || tokenData.account),
      shop_name: tokenData.name || tokenData.account || "Lazada Shop",
      region: stateRow.metadata?.region || tokenData.country || "MY",
      site_code: tokenData.country || "MY",
      status: "active",
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (accountError) {
    return new Response(`Failed to save account: ${accountError.message}`, { status: 500 });
  }

  // 5. Store specific Lazada credentials
  await supabase
    .from("marketplace_credentials")
    .upsert({
      tenant_id: stateRow.tenant_id,
      account_id: account.id,
      credential_type: "lazada_tokens",
      encrypted_payload: encryptedPayload,
      expires_at: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString()
    });

  // 6. Redirect back to dashboard
  const appUrl = Deno.env.get("APP_URL") || "https://dashboard.localhost:3000";
  const dashboardUrl = `${appUrl}/marketplace/lazada?success=true`;
  return Response.redirect(dashboardUrl, 302);
});
