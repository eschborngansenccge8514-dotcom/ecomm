import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { TikTokClient } from "tiktok/client.ts";
import { mapProductToTikTok, validateTikTokProduct } from "tiktok/mapProduct.ts";
import { decryptJson } from "crypto";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // 1. Get pending sync jobs for TikTok products
    const { data: jobs, error: jobsError } = await supabase
      .from("marketplace_sync_jobs")
      .select(`
        *,
        account:marketplace_accounts(*)
      `)
      .eq("job_type", "sync_products")
      .eq("status", "pending")
      .eq("account.provider_id", "tiktok")
      .limit(5);

    if (jobsError) throw jobsError;

    for (const job of jobs || []) {
      await supabase.from("marketplace_sync_jobs").update({ status: "processing", started_at: new Date().toISOString() }).eq("id", job.id);

      try {
        const { product_id } = job.payload;
        if (!product_id) throw new Error("Missing product_id in job payload");

        // 2. Fetch full product data
        const { data: product, error: productError } = await supabase
          .from("products")
          .select("*, variants(*)")
          .eq("id", product_id)
          .single();

        if (productError) throw productError;

        // 3. Get Credentials (tokens)
        const { data: creds, error: credError } = await supabase
          .from("marketplace_credentials")
          .select("*")
          .eq("account_id", job.account_id)
          .eq("credential_type", "tiktok_tokens")
          .eq("is_active", true)
          .single();

        if (credError) throw credError;

        const encryptionKey = Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!;
        const tokens = decryptJson<any>(creds.encrypted_payload, encryptionKey);

        // 4. Get Merchant Config (App Key/Secret)
        const { data: config } = await supabase
          .from("merchant_tiktok_config")
          .select("app_key, app_secret")
          .eq("merchant_id", job.tenant_id)
          .single();

        const appKey = config?.app_key || Deno.env.get("TIKTOK_APP_KEY");
        const appSecret = config?.app_secret || Deno.env.get("TIKTOK_APP_SECRET");

        if (!appKey || !appSecret) throw new Error("TikTok app configuration missing for this merchant");

        // 5. Initialize TikTok Client
        const client = new TikTokClient({
          appKey: appKey,
          appSecret: appSecret,
          baseUrl: Deno.env.get("TIKTOK_BASE_URL"),
          accessToken: tokens.access_token,
          shopId: job.account.shop_id
        });

        // 5. Map & Validate
        const validationErrors = validateTikTokProduct(product);
        if (validationErrors.length > 0) {
          throw new Error(`Validation failed: ${validationErrors.join(", ")}`);
        }

        const tiktokPayload = mapProductToTikTok(product);

        // 6. Push to TikTok
        const result = await client.createOrUpdateProduct(tiktokPayload);

        // 7. Update Mappings
        await supabase.from("marketplace_product_mappings").upsert({
          tenant_id: job.tenant_id,
          account_id: job.account_id,
          product_id: product_id,
          external_product_id: result.data?.product_id,
          last_synced_at: new Date().toISOString()
        }, { onConflict: "account_id,product_id" });

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
          next_retry_at: new Date(Date.now() + 600000).toISOString() // Retry in 10 mins
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
