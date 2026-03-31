import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { routeTikTokEvent } from "tiktok/events.ts";
import { recordMarketplaceEvent } from "shared/marketplace.ts";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const raw = await req.text();
    const payload = JSON.parse(raw);
    
    // 1. Basic Validation
    const eventType = payload.type || payload.event_type || "unknown";
    const eventId = payload.id || payload.event_id || crypto.randomUUID();
    const shopId = payload.shop_id || payload.seller_id;

    // 2. Find matching account by shop_id
    const { data: account } = await supabase
      .from("marketplace_accounts")
      .select("*")
      .eq("provider_id", "tiktok")
      .eq("shop_id", shopId)
      .single();

    // 3. Record Event
    await recordMarketplaceEvent(supabase, {
      providerId: "tiktok",
      externalEventId: eventId,
      tenantId: account?.tenant_id,
      accountId: account?.id,
      eventType,
      payload
    });

    // 4. Enqueue Sync Job if applicable
    const route = routeTikTokEvent(payload);
    if (route && account) {
      await supabase.from("marketplace_sync_jobs").insert({
        tenant_id: account.tenant_id,
        account_id: account.id,
        job_type: route.jobType,
        payload: route.payload,
        status: "pending"
      });
    }

    return new Response("ok", { status: 200 });

  } catch (error: any) {
    console.error("TikTok Webhook Error:", error);
    return new Response(`Error: ${error.message}`, { status: 400 });
  }
});
