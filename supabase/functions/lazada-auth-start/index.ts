import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getSupabaseClient } from "../_shared/marketplace.ts";

serve(async (req) => {
  // 1. Get request body
  const { tenant_id, region } = await req.json();
  if (!tenant_id) {
    return new Response(JSON.stringify({ error: "Missing tenant_id" }), { status: 400 });
  }

  const supabase = getSupabaseClient();
  const state = crypto.randomUUID();

  // 2. Store OAuth state
  const { error } = await supabase
    .from("oauth_states")
    .insert({
      tenant_id,
      provider: "lazada",
      state,
      metadata: { region },
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // 3. Build Lazada Auth URL
  const clientId = Deno.env.get("LAZADA_APP_KEY");
  const redirectUri = `${Deno.env.get("APP_URL")}/api/integrations/lazada/callback`;

  if (!clientId) {
    return new Response(JSON.stringify({ error: "Lazada app configuration missing" }), { status: 500 });
  }

  // Lazada Auth URL: https://auth.lazada.com/oauth/authorize
  const authUrl = new URL("https://auth.lazada.com/oauth/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("force_auth", "true");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  return new Response(
    JSON.stringify({ authorization_url: authUrl.toString(), state }),
    { headers: { "Content-Type": "application/json" } }
  );
});
