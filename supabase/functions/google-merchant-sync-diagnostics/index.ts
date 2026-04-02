import { serve } from "https://deno.land/std/http/server.ts";
import { decryptJson } from "crypto";
import { GoogleMerchantClient } from "google-merchant/client.ts";
import { refreshGoogleToken } from "google-merchant/refreshToken.ts";
import { normalizeAccountIssues, normalizeItemIssues } from "google-merchant/normalizeDiagnostics.ts";

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

  const accountsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/marketplace_accounts?provider_id=eq.google_merchant&status=eq.active&select=*,google_merchant_data_sources(*)`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const accounts = await accountsRes.json();

  for (const account of accounts || []) {
    try {
      const dataSource = account.google_merchant_data_sources?.find((ds: any) => ds.is_primary);
      let tokenData = decryptJson<any>(account.credentials_ref, ENCRYPTION_KEY);
      
      if (Date.now() > (new Date(account.updated_at).getTime() + 55 * 60 * 1000) && tokenData.refresh_token) {
        const refreshed = await refreshGoogleToken(tokenData.refresh_token);
        tokenData = { ...tokenData, access_token: refreshed.access_token };
      }

      const client = new GoogleMerchantClient({
        accessToken: tokenData.access_token,
        merchantId: account.shop_id,
        dataSourceId: dataSource?.data_source_id ?? ""
      });

      // Poll account status
      const accountStatus = await client.getAccountStatus();
      const accountIssues = normalizeAccountIssues(accountStatus, account);
      await upsertDiagnostics(accountIssues);

      // Poll item status with pagination
      let pageToken: string | undefined;
      do {
        const result = await client.listProductStatuses(pageToken);
        const products = result.resources ?? result.products ?? [];
        const itemIssues = normalizeItemIssues(products, account);
        await upsertDiagnostics(itemIssues);
        pageToken = result.nextPageToken;
      } while (pageToken);

      // Refresh last_sync_at
      await fetch(`${SUPABASE_URL}/rest/v1/marketplace_accounts?id=eq.${account.id}`, {
        method: "PATCH",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ last_sync_at: new Date().toISOString() })
      });
    } catch (e) {
      console.error(`Diagnostics sync failed for GMC account ${account.id}:`, e);
    }
  }

  return Response.json({ ok: true }, { headers: corsHeaders });
});

async function upsertDiagnostics(rows: any[]) {
  if (!rows.length) return;
  await fetch(`${SUPABASE_URL}/rest/v1/google_merchant_diagnostics`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify(rows)
  });
}
