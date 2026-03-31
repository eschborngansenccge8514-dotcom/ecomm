import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { TikTokClient } from "tiktok/client.ts";
import { mapTikTokOrderToPlatform } from "tiktok/mapOrder.ts";
import { decryptJson } from "crypto";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // 1. Get pending sync jobs for TikTok orders
    const { data: jobs, error: jobsError } = await supabase
      .from("marketplace_sync_jobs")
      .select(`
        *,
        account:marketplace_accounts(*)
      `)
      .eq("job_type", "sync_orders")
      .eq("status", "pending")
      .eq("account.provider_id", "tiktok")
      .limit(5);

    if (jobsError) throw jobsError;

    for (const job of jobs || []) {
      await supabase.from("marketplace_sync_jobs").update({ status: "processing", started_at: new Date().toISOString() }).eq("id", job.id);

      try {
        const { create_time_from, create_time_to } = job.payload;

        // 2. Get Credentials
        const { data: creds, error: credError } = await supabase
          .from("marketplace_credentials")
          .select("*")
          .eq("account_id", job.account_id)
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
          shopId: job.account.shop_id
        });

        // 4. List & Sync Orders
        const result = await client.listOrders({
          createTimeFrom: create_time_from || Math.floor(Date.now() / 1000) - 86400, // Default 1 day
          createTimeTo: create_time_to || Math.floor(Date.now() / 1000)
        });

        for (const rawOrder of result.data?.orders || []) {
          const detail = await client.getOrderDetail(rawOrder.order_id);
          const mapped = mapTikTokOrderToPlatform(detail.data);

          // 5. Upsert Platform Order
          const { data: order, error: orderError } = await supabase
            .from("orders")
            .upsert({
              tenant_id: job.tenant_id,
              status: mapped.status,
              total_amount: mapped.total_amount,
              currency: mapped.currency,
              metadata: mapped.metadata
            }, { onConflict: "external_order_id" }) // Actually orders table might need an external_id column or we use metadata
            .select()
            .single();

          if (orderError) throw orderError;

          // 6. Update Mappings
          await supabase.from("marketplace_order_mappings").upsert({
            tenant_id: job.tenant_id,
            account_id: job.account_id,
            order_id: order.id,
            external_order_id: mapped.external_order_id,
            external_order_sn: mapped.external_order_sn,
            raw_payload: detail.data
          }, { onConflict: "account_id,order_id" });
        }

        await supabase.from("marketplace_sync_jobs").update({ 
          status: "completed", 
          completed_at: new Date().toISOString() 
        }).eq("id", job.id);

      } catch (e: any) {
        console.error(`Sync Job ${job.id} failed:`, e);
        await supabase.from("marketplace_sync_jobs").update({ 
          status: "failed", 
          error_message: e.message,
          attempt_count: job.attempt_count + 1,
          next_retry_at: new Date(Date.now() + 600000).toISOString()
        }).eq("id", job.id);
      }
    }

    return new Response(JSON.stringify({ processed: jobs?.length || 0 }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
