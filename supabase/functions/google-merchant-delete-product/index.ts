import { serve } from "https://deno.land/std/http/server.ts";
import { decryptJson } from "crypto";
import { GoogleMerchantClient } from "google-merchant/client.ts";
import { refreshGoogleToken } from "google-merchant/refreshToken.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENCRYPTION_KEY = Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const jobsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/marketplace_sync_jobs?status=eq.pending&job_type=eq.delete_product&select=*,marketplace_accounts(*,google_merchant_data_sources(*))`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const jobs = await jobsRes.json();

  for (const job of jobs || []) {
    try {
      await updateJobStatus(job.id, "processing");
      await processDeleteJob(job);
      await updateJobStatus(job.id, "completed");
    } catch (e) {
      await updateJobStatus(job.id, "failed", String(e));
    }
  }

  return Response.json({ ok: true }, { headers: corsHeaders });
});

async function processDeleteJob(job: any) {
  const account = job.marketplace_accounts;
  const dataSource = account.google_merchant_data_sources?.find((ds: any) => ds.is_primary);
  if (!dataSource) throw new Error("No primary data source found for GMC account");

  const mappingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/marketplace_product_mappings?product_id=eq.${job.payload.product_id}&account_id=eq.${account.id}&select=*`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const mapping = (await mappingRes.json())[0];
  if (!mapping) return; // mapping already deleted, ignore.

  let tokenData = decryptJson<any>(account.credentials_ref, ENCRYPTION_KEY);
  if (Date.now() > (new Date(account.updated_at).getTime() + 55 * 60 * 1000) && tokenData.refresh_token) {
    const refreshed = await refreshGoogleToken(tokenData.refresh_token);
    tokenData = { ...tokenData, access_token: refreshed.access_token };
  }

  const client = new GoogleMerchantClient({
    accessToken: tokenData.access_token,
    merchantId: account.shop_id,
    dataSourceId: dataSource.data_source_id
  });

  await client.deleteProductInput(mapping.external_product_id);

  // Soft-delete the mapping
  await fetch(`${SUPABASE_URL}/rest/v1/marketplace_product_mappings?id=eq.${mapping.id}`, {
    method: "PATCH",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "deleted", last_synced_at: new Date().toISOString() })
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
