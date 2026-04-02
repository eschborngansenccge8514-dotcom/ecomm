import { serve } from "https://deno.land/std/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { tenantId, returnTo } = await req.json();
    const state = crypto.randomUUID();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const res = await fetch(`${supabaseUrl}/rest/v1/marketplace_events`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        provider_id: "google_merchant",
        event_type: "oauth_state",
        payload: { state, returnTo }
      })
    });

    if (!res.ok) throw new Error("Failed to store OAuth state");

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const redirectUri = encodeURIComponent(`${Deno.env.get("APP_URL")}/api/integrations/google-merchant/callback`);
    const scope = encodeURIComponent("https://www.googleapis.com/auth/content");

    const url =
      `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${clientId}` +
      `&redirect_uri=${redirectUri}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${state}`;

    return Response.json({ authorizationUrl: url }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400, headers: corsHeaders });
  }
});
