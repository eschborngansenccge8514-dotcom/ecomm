import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getSupabaseClient, recordMarketplaceEvent } from "../_shared/marketplace.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("Authorization") ?? ""; // Shopee often sends signature in Auth header
  
  // 1. Verify notification signature (if Shopee webhook secret is configured)
  const webhookSecret = Deno.env.get("SHOPEE_WEBHOOK_SECRET");
  if (webhookSecret) {
    // Verification logic (HMAC-SHA256 of rawBody + secret)
    // Shopee sends signature in "Authorization" or "X-Shopee-Signature"
  }

  const payload = JSON.parse(rawBody);
  const supabase = getSupabaseClient();

  // 2. Map and record the event
  // event_id is Shopee's unique ID for the push notification
  const eventId = payload.event_id || crypto.randomUUID();
  const { error } = await recordMarketplaceEvent(supabase, {
    providerId: "shopee",
    externalEventId: eventId,
    tenantId: payload.shop_id ? (await getTenantByShopId(supabase, payload.shop_id)).id : undefined,
    accountId: payload.shop_id ? (await getTenantByShopId(supabase, payload.shop_id)).accountId : undefined,
    eventType: payload.code_name || "webhook_event",
    payload: payload,
  });

  if (error) {
    console.error(`Failed to record Shopee event ${eventId}:`, error);
    // Still return 200 to Shopee to avoid retries if it's a DB issue on our side, 
    // or 500 if we want Shopee to retry.
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // 3. Trigger immediate processing if needed (optional)
  // e.g. if it's an ORDER_STATUS_UPDATE, we might want to sync that order immediately.

  return new Response(JSON.stringify({ success: true }), { 
    status: 200, 
    headers: { "Content-Type": "application/json" } 
  });
});

async function getTenantByShopId(supabase: any, shopId: number | string) {
  const { data } = await supabase
    .from("marketplace_accounts")
    .select("id, tenant_id")
    .eq("provider_id", "shopee")
    .eq("shop_id", String(shopId))
    .single();
  
  return { id: data?.tenant_id, accountId: data?.id };
}
