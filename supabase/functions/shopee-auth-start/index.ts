import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getSupabaseClient } from "../_shared/marketplace.ts";

serve(async (req) => {
  // 1. Get request body
  const { tenant_id } = await req.json();
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
      provider: "shopee",
      state,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // 3. Build Shopee Auth URL
  const partnerId = Deno.env.get("SHOPEE_PARTNER_ID");
  const partnerKey = Deno.env.get("SHOPEE_PARTNER_KEY");
  const redirectUri = `${Deno.env.get("APP_URL")}/api/integrations/shopee/callback`;

  if (!partnerId || !partnerKey) {
    return new Response(JSON.stringify({ error: "Shopee partner configuration missing" }), { status: 500 });
  }

  // Generate signature for auth_partner (v2)
  // Shopee auth_partner doesn't require signature in search params, but some regions might.
  // Standard v2 auth: https://partner.shopeemobile.com/api/v2/shop/auth_partner?partner_id={partner_id}&timestamp={timestamp}&sign={sign}&redirect={redirect_url}
  
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
  // Important: Shopee callback will append shop_id and code to this redirect

  return new Response(
    JSON.stringify({ authorization_url: authUrl.toString(), state }),
    { headers: { "Content-Type": "application/json" } }
  );
});
