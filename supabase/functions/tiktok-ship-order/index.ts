import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { TikTokClient } from "tiktok/client.ts";
import { decryptJson } from "crypto";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { orderId, trackingNumber, carrierId } = await req.json();
    if (!orderId || !trackingNumber) throw new Error("Missing orderId or trackingNumber");

    // 1. Get Order Mapping to find external_order_id
    const { data: mapping, error: mappingError } = await supabase
      .from("marketplace_order_mappings")
      .select(`
        *,
        account:marketplace_accounts(*)
      `)
      .eq("order_id", orderId)
      .single();

    if (mappingError || !mapping) throw new Error("Order mapping not found for this marketplace");

    // 2. Get Credentials
    const { data: creds, error: credError } = await supabase
      .from("marketplace_credentials")
      .select("*")
      .eq("account_id", mapping.account_id)
      .eq("credential_type", "oauth_tokens")
      .eq("is_active", true)
      .single();

    if (credError) throw credError;

    const encryptionKey = Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!;
    const tokens = decryptJson<any>(creds.encrypted_payload, encryptionKey);

    // 3. Initialize TikTok Client
    const client = new TikTokClient({
      appKey: Deno.env.get("TIKTOK_APP_KEY")!,
      appSecret: Deno.env.get("TIKTOK_APP_SECRET")!,
      baseUrl: Deno.env.get("TIKTOK_BASE_URL"),
      accessToken: tokens.access_token,
      shopId: mapping.account.shop_id
    });

    // 4. Push Shipment to TikTok
    const result = await client.shipOrder({
      order_id: mapping.external_order_id,
      tracking_number: trackingNumber,
      shipping_provider: carrierId || "Standard"
    });

    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
