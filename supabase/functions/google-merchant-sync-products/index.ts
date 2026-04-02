import { serve } from "https://deno.land/std/http/server.ts";
import { decryptJson, encryptJson } from "crypto";
import { GoogleMerchantClient } from "google-merchant/client.ts";
import { mapProductToGoogle } from "google-merchant/mapProduct.ts";
import { validateGoogleProduct } from "google-merchant/validateProduct.ts";
import { refreshGoogleToken } from "google-merchant/refreshToken.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENCRYPTION_KEY = Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const jobsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/marketplace_sync_jobs?status=eq.pending&job_type=eq.sync_products&select=*,marketplace_accounts(*,google_merchant_data_sources(*))`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const jobs = await jobsRes.json();

  for (const job of jobs || []) {
    try {
      await updateJobStatus(job.id, "processing");
      await processProductJob(job);
      await updateJobStatus(job.id, "completed");
    } catch (e) {
      await updateJobStatus(job.id, "failed", String(e));
    }
  }

  return Response.json({ ok: true }, { headers: corsHeaders });
});

async function processProductJob(job: any) {
  const account = job.marketplace_accounts;
  const dataSource = account.google_merchant_data_sources?.find((ds: any) => ds.is_primary);
  if (!dataSource) throw new Error("No primary data source found for GMC account");

  const productRes = await fetch(
    `${SUPABASE_URL}/rest/v1/products?id=eq.${job.payload.product_id}&select=*`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const product = (await productRes.json())[0];
  if (!product) throw new Error("Product not found");

  const validationErrors = validateGoogleProduct(product);
  if (validationErrors.length) throw new Error(`Validation failed: ${validationErrors.join("; ")}`);

  let tokenData = decryptJson<any>(account.credentials_ref, ENCRYPTION_KEY);

  // GMC tokens expire in 1h, checking if we need a refresh (using 55min as buffer)
  const isExpired = Date.now() > (new Date(account.updated_at).getTime() + 55 * 60 * 1000);
  if (isExpired && tokenData.refresh_token) {
    const refreshed = await refreshGoogleToken(tokenData.refresh_token);
    tokenData = { ...tokenData, access_token: refreshed.access_token };
    await updateAccountToken(account.id, tokenData);
  }

  const client = new GoogleMerchantClient({
    accessToken: tokenData.access_token,
    merchantId: account.shop_id, // external account id stored in shop_id field
    dataSourceId: dataSource.data_source_id
  });

  const googlePayload = mapProductToGoogle(product, {
    contentLanguage: dataSource.content_language,
    feedLabel: dataSource.feed_label,
    baseUrl: Deno.env.get("APP_URL")!
  });

  await client.insertProductInput(googlePayload);

  // Upsert mapping record
  await fetch(`${SUPABASE_URL}/rest/v1/marketplace_product_mappings`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify({
      tenant_id: job.tenant_id,
      account_id: account.id,
      product_id: product.id,
      external_product_id: googlePayload.offerId,
      status: "synced",
      last_synced_at: new Date().toISOString()
    })
  });
}

async function updateJobStatus(jobId: string, status: string, error?: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/marketplace_sync_jobs?id=eq.${jobId}`, {
    method: "PATCH",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      status,
      error_message: error,
      started_at: status === "processing" ? new Date().toISOString() : undefined,
      completed_at: status === "completed" || status === "failed" ? new Date().toISOString() : undefined
    })
  });
}

async function updateAccountToken(accountId: string, tokenData: any) {
  const encrypted = encryptJson(tokenData, ENCRYPTION_KEY);
  await fetch(`${SUPABASE_URL}/rest/v1/marketplace_accounts?id=eq.${accountId}`, {
    method: "PATCH",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ credentials_ref: encrypted, updated_at: new Date().toISOString() })
  });
}
