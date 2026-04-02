import { serve } from "https://deno.land/std/http/server.ts";
import { encryptJson } from "crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) return new Response("missing code/state", { status: 400 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const encryptionKey = Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!;

  // Verify state
  const stateRes = await fetch(
    `${supabaseUrl}/rest/v1/marketplace_events?event_type=eq.oauth_state&payload->>state=eq.${state}&select=*`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  );
  const states = await stateRes.json();
  if (!states?.length) return new Response("invalid state", { status: 400 });

  const { tenant_id, payload: { returnTo } } = states[0];

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      redirect_uri: `${Deno.env.get("APP_URL")}/api/integrations/google-merchant/callback`,
      grant_type: "authorization_code"
    })
  });

  if (!tokenRes.ok) return new Response(await tokenRes.text(), { status: 500 });

  const tokenData = await tokenRes.json();
  const encryptedPayload = encryptJson(tokenData, encryptionKey);

  // Here we need to find or create the marketplace account.
  // We'll use the external merchant id (which we'll fetch from the userinfo OR we can assume it's in the token for GMC).
  // Actually, Content API needs the merchantId. Let's fetch it from the user's accounts if possible.
  // For now, let's create a placeholder account and the dashboard can ask for the Merchant ID later.

  const { data: account, error: accountErr } = await fetch(`${supabaseUrl}/rest/v1/marketplace_accounts`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      tenant_id,
      provider_id: "google_merchant",
      status: "active",
      credentials_ref: encryptedPayload, // Usually we'd store encrypted tokens in a linked credentials table, but let's stick to the pattern.
      // We'll update the shop_id/name once the user provides it or we fetch it.
    })
  }).then(r => r.json());

  if (accountErr) return new Response(String(accountErr), { status: 500 });

  return Response.redirect(`${returnTo || Deno.env.get("APP_URL")}/integrations/google-merchant?connected=1`, 302);
});
