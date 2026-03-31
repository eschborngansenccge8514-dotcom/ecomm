import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { 
  getSupabaseClient, 
  recordMarketplaceEvent 
} from "../_shared/marketplace.ts";
import { createHmac } from "node:crypto";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("X-Lazada-Signature") || "";
  
  // 1. Verify notification signature
  const appSecret = Deno.env.get("LAZADA_APP_SECRET");
  if (appSecret && signature) {
    const expectedSignature = createHmac("sha256", appSecret)
      .update(rawBody)
      .digest("hex")
      .toUpperCase();
    
    if (signature.toUpperCase() !== expectedSignature) {
      console.warn("Lazada webhook signature verification failed");
      // return new Response("Invalid signature", { status: 401 });
    }
  }

  const payload = JSON.parse(rawBody);
  const supabase = getSupabaseClient();

  // 2. Identify the account/tenant
  // Lazada webhooks usually include seller_id in data or metadata
  const sellerId = payload.data?.seller_id || payload.seller_id;
  const { data: account } = await supabase
    .from("marketplace_accounts")
    .select("id, tenant_id")
    .eq("provider_id", "lazada")
    .eq("shop_id", String(sellerId))
    .maybeSingle();

  // 3. Map and record the event
  const eventId = payload.msg_id || payload.notification_id || crypto.randomUUID();
  const { error } = await recordMarketplaceEvent(supabase, {
    providerId: "lazada",
    externalEventId: eventId,
    tenantId: account?.tenant_id,
    accountId: account?.id,
    eventType: payload.type || payload.notify_type || "webhook_event",
    payload: payload,
  });

  if (error && error.code !== "23505") { // Ignore duplicates
    console.error(`Failed to record Lazada event ${eventId}:`, error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // 4. Trigger immediate sync runner (optional)
  // For Phase 1, we just return 200.
  
  return new Response(JSON.stringify({ success: true }), { 
    status: 200, 
    headers: { "Content-Type": "application/json" } 
  });
});
