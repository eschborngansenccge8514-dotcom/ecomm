import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getSupabaseClient, recordMarketplaceEvent } from "../_shared/marketplace.ts";
import { createHmac } from "node:crypto";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("Authorization") || req.headers.get("X-Shopee-Signature") || "";
  
  const payload = JSON.parse(rawBody);
  const supabase = getSupabaseClient();

  // 1. Identify the account/tenant
  const shopId = payload.shop_id;
  if (!shopId) {
    console.error("Missing shop_id in Shopee webhook payload");
    return new Response("Missing shop_id", { status: 400 });
  }

  const { data: account, error: accountError } = await supabase
    .from("marketplace_accounts")
    .select("id, tenant_id")
    .eq("provider_id", "shopee")
    .eq("shop_id", String(shopId))
    .maybeSingle();

  if (accountError || !account) {
    console.error(`Shopee account not found for shop_id: ${shopId}`);
    return new Response("Account not found", { status: 404 });
  }

  // 2. Verify notification signature if Shopee partner key is configured
  const { data: config } = await supabase
    .from("merchant_shopee_config")
    .select("partner_key")
    .eq("merchant_id", account.tenant_id)
    .single();

  const partnerKey = config?.partner_key || Deno.env.get("SHOPEE_PARTNER_KEY");
  if (partnerKey && signature) {
    // Shopee v2 signature for webhooks: HMAC-SHA256(url + rawBody, partner_key)
    const url = Deno.env.get("APP_URL") + "/api/integrations/shopee/webhook"; // This should match configured URL
    const baseString = url + rawBody;
    const expectedSignature = createHmac("sha256", partnerKey)
      .update(baseString)
      .digest("hex");
    
    if (signature !== expectedSignature) {
      console.warn(`Shopee webhook signature verification failed for merchant ${account.tenant_id}`);
      // return new Response("Invalid signature", { status: 401 });
    }
  }

  // 3. Map and record the event
  const eventId = payload.event_id || crypto.randomUUID();
  const { error } = await recordMarketplaceEvent(supabase, {
    providerId: "shopee",
    externalEventId: eventId,
    tenantId: account.tenant_id,
    accountId: account.id,
    eventType: payload.code_name || "webhook_event",
    payload: payload,
  });

  if (error && error.code !== "23505") {
    console.error(`Failed to record Shopee event ${eventId}:`, error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), { 
    status: 200, 
    headers: { "Content-Type": "application/json" } 
  });
});
