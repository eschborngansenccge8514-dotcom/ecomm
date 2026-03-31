<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# continue next with Google Merchant

Below is the **full, ready-to-use Google Merchant Center integration guide** for your stack. Google Merchant is architecturally different from the three marketplace connectors you have already built. It is a **feed and catalog management system**, not a transactional marketplace, so there are no orders to import or shipments to push. The work is about product submission, availability updates, diagnostics monitoring, and disapproval remediation. Google is currently transitioning from the legacy Content API for Shopping to the newer Merchant API, and the new endpoint base is `https://merchantapi.googleapis.com/products/v1`, so all new implementations should target the Merchant API directly.[^1][^2][^3]

***

## What this integration should do

Your Google Merchant connector should:

- Connect a merchant's Google Merchant Center account via OAuth 2.0.[^1]
- Create and manage a Data Source in Merchant Center per tenant.[^2]
- Submit products from your canonical catalog as `productInputs`.[^2]
- Push availability and price updates on stock events.
- Poll account-level and item-level diagnostics.[^4][^5]
- Surface disapprovals and remediation actions in the dashboard.[^6]
- Deactivate or delete products when delisted internally.
- Handle multi-country and multi-language targeting explicitly.

Google Merchant does not push events or webhooks to you. Instead you poll the API for diagnostics and product status. This means your sync model is outbound-push for products and inbound-poll for diagnostics, with a scheduled reconciliation pass to catch drift.[^5][^4]

***

## Google Merchant architecture

```
Merchant Dashboard → Connect GMC → OAuth 2.0 consent → store tokens
Internal catalog change → validate product → transform to Merchant API shape → productInputs:insert
Scheduled diagnostics job → poll productStatuses → normalize issues → store in diagnostics table → show in UI
Stock change event → availability update job → productInputs:insert with updated availability
Product deleted → productInputs:delete
```


***

## Database schema

### `marketplace_accounts`

```sql
create table if not exists marketplace_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider text not null default 'google_merchant',
  external_account_id text not null,
  display_name text,
  region text not null default 'global',
  status text not null default 'connected',
  last_successful_sync_at timestamptz,
  last_health_check_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider, external_account_id)
);
```


### `marketplace_credentials`

```sql
create table if not exists marketplace_credentials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  marketplace_account_id uuid not null references marketplace_accounts(id) on delete cascade,
  credential_type text not null,
  encrypted_payload text not null,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```


### `google_merchant_data_sources`

A Data Source is a required Merchant API concept that groups product inputs under a feed. Each tenant/account pair must have at least one.[^2]

```sql
create table if not exists google_merchant_data_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  marketplace_account_id uuid not null references marketplace_accounts(id) on delete cascade,
  data_source_id text not null,
  display_name text not null,
  content_language text not null default 'en',
  feed_label text not null,
  countries text[] not null default '{}',
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, marketplace_account_id, data_source_id)
);
```


### `marketplace_product_mappings`

```sql
create table if not exists marketplace_product_mappings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  marketplace_account_id uuid not null references marketplace_accounts(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  external_product_id text not null,
  data_source_id text,
  status text not null default 'mapped',
  remote_state_hash text,
  local_state_hash text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, marketplace_account_id, product_id),
  unique (tenant_id, marketplace_account_id, external_product_id)
);
```


### `google_merchant_diagnostics`

```sql
create table if not exists google_merchant_diagnostics (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  marketplace_account_id uuid not null references marketplace_accounts(id) on delete cascade,
  scope text not null check (scope in ('account', 'product')),
  external_product_id text,
  issue_code text not null,
  title text not null,
  description text,
  severity text not null,
  servability text,
  resolution text,
  attribute_name text,
  documentation_url text,
  affected_count int,
  country text,
  destination text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, marketplace_account_id, scope, external_product_id, issue_code, country)
);
```


### `marketplace_sync_jobs`

```sql
create table if not exists marketplace_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  marketplace_account_id uuid not null references marketplace_accounts(id) on delete cascade,
  provider text not null default 'google_merchant',
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  attempt_count int not null default 0,
  max_attempts int not null default 5,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  next_retry_at timestamptz,
  lock_token text,
  last_error_code text,
  last_error_message text,
  last_error_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```


***

## Google OAuth 2.0 auth flow

Google requires OAuth 2.0 with the `https://www.googleapis.com/auth/content` scope for the Content API, or the equivalent Merchant API scope. You must register a web application OAuth client in Google Cloud Console and add the merchant's Google account as a user in their Merchant Center with Admin role before tokens will work.[^7][^1]

### Start auth endpoint

```ts
// supabase/functions/google-merchant-start/index.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  const { tenantId, returnTo } = await req.json();
  const state = crypto.randomUUID();

  await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/oauth_states`, {
    method: "POST",
    headers: {
      apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      provider: "google_merchant",
      state,
      metadata: { returnTo }
    })
  });

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const redirectUri = encodeURIComponent(`${Deno.env.get("APP_URL")}/api/integrations/google-merchant/callback`);
  const scope = encodeURIComponent(
    "https://www.googleapis.com/auth/content"
  );

  const url =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${clientId}` +
    `&redirect_uri=${redirectUri}` +
    `&response_type=code` +
    `&scope=${scope}` +
    `&access_type=offline` +
    `&prompt=consent` +
    `&state=${state}`;

  return Response.json({ authorizationUrl: url });
});
```


### Callback endpoint

```ts
// supabase/functions/google-merchant-callback/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { encryptJson } from "../../../packages/integrations/crypto.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) return new Response("missing code/state", { status: 400 });

  const stateRes = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/rest/v1/oauth_states?state=eq.${state}&provider=eq.google_merchant&select=*`,
    {
      headers: {
        apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`
      }
    }
  );
  const states = await stateRes.json();
  if (!states?.length) return new Response("invalid state", { status: 400 });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      redirect_uri: `${Deno.env.get("APP_URL")}/api/integrations/google-merchant/callback`,
      grant_type: "authorization_code"
    })
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return new Response(err, { status: 500 });
  }

  const tokenData = await tokenRes.json();
  const encryptedPayload = encryptJson(tokenData, Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!);

  await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/marketplace_credentials`, {
    method: "POST",
    headers: {
      apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      tenant_id: states[^0].tenant_id,
      marketplace_account_id: states[^0].marketplace_account_id,
      credential_type: "google_oauth_token",
      encrypted_payload: encryptedPayload,
      expires_at: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null
    })
  });

  return Response.redirect(`${Deno.env.get("APP_URL")}/integrations/google-merchant?connected=1`, 302);
});
```


***

## Token refresh helper

Google access tokens expire in 1 hour. Always refresh before API calls if `expires_at` is within 5 minutes.

```ts
// packages/integrations/google-merchant/refreshToken.ts
export async function refreshGoogleToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token"
    })
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  return res.json();
}
```


***

## Google Merchant API client

The new Merchant API base URL is `https://merchantapi.googleapis.com/products/v1`. Product inputs require an `offerId`, `contentLanguage`, `feedLabel`, and a `productAttributes` object. Price is expressed in `amountMicros` (i.e. `19.99 USD` = `{ amountMicros: "19990000", currencyCode: "USD" }`).[^2]

```ts
// packages/integrations/google-merchant/client.ts
export class GoogleMerchantClient {
  private baseUrl = "https://merchantapi.googleapis.com/products/v1";

  constructor(
    private config: {
      accessToken: string;
      merchantId: string;
      dataSourceId: string;
    }
  ) {}

  private get headers() {
    return {
      Authorization: `Bearer ${this.config.accessToken}`,
      "Content-Type": "application/json"
    };
  }

  async insertProductInput(payload: GoogleProductInput) {
    const parent = `accounts/${this.config.merchantId}`;
    const dataSource = `${parent}/dataSources/${this.config.dataSourceId}`;
    const url = `${this.baseUrl}/${parent}/productInputs:insert?dataSource=${encodeURIComponent(dataSource)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  async deleteProductInput(offerId: string) {
    const parent = `accounts/${this.config.merchantId}`;
    const dataSource = `${parent}/dataSources/${this.config.dataSourceId}`;
    const name = `${parent}/productInputs/${offerId}`;
    const url = `${this.baseUrl}/${name}?dataSource=${encodeURIComponent(dataSource)}`;

    const res = await fetch(url, { method: "DELETE", headers: this.headers });
    if (!res.ok) throw await this.toError(res);
    return res.status === 204 ? { deleted: true } : res.json();
  }

  async getProductStatus(offerId: string) {
    const name = `accounts/${this.config.merchantId}/products/${offerId}`;
    const url = `${this.baseUrl}/${name}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  async listProductStatuses(pageToken?: string) {
    const parent = `accounts/${this.config.merchantId}`;
    const url = new URL(`${this.baseUrl}/${parent}/products`);
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url.toString(), { headers: this.headers });
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  async getAccountStatus() {
    const url = `https://shoppingcontent.googleapis.com/content/v2.1/${this.config.merchantId}/accountstatuses/${this.config.merchantId}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  private async toError(res: Response) {
    const body = await res.text();
    return new Error(`Google Merchant API error ${res.status}: ${body}`);
  }
}

export interface GoogleProductInput {
  offerId: string;
  contentLanguage: string;
  feedLabel: string;
  productAttributes: {
    title: string;
    description: string;
    link: string;
    imageLink: string;
    availability: "IN_STOCK" | "OUT_OF_STOCK" | "PREORDER";
    price: { amountMicros: string; currencyCode: string };
    condition: "NEW" | "REFURBISHED" | "USED";
    brand?: string;
    gtins?: string[];
    mpn?: string;
    googleProductCategory?: string;
    color?: string;
    sizes?: string[];
  };
}
```


***

## Product mapping

### Canonical product → Google Merchant API format

```ts
// packages/integrations/google-merchant/mapProduct.ts
import type { GoogleProductInput } from "./client";

export function mapProductToGoogle(
  product: any,
  config: {
    contentLanguage: string;
    feedLabel: string;
    baseUrl: string;
  }
): GoogleProductInput {
  return {
    offerId: product.sku,
    contentLanguage: config.contentLanguage,
    feedLabel: config.feedLabel,
    productAttributes: {
      title: product.title,
      description: stripHtml(product.description),
      link: `${config.baseUrl}/products/${product.slug}`,
      imageLink: product.images?.[^0]?.url ?? "",
      availability: product.stock_on_hand > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
      price: {
        amountMicros: String(Math.round(product.price * 1_000_000)),
        currencyCode: product.currency ?? "MYR"
      },
      condition: "NEW",
      brand: product.brand ?? undefined,
      gtins: product.gtin ? [product.gtin] : undefined,
      mpn: product.mpn ?? undefined,
      googleProductCategory: product.provider_meta?.google?.category ?? undefined
    }
  };
}

export function stripHtml(html: string) {
  return html?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() ?? "";
}
```


### Product validator

Google disapproves products for specific, well-documented reasons including broken image links, landing page errors, missing GTINs for branded products, and price mismatches.[^4][^6]

```ts
// packages/integrations/google-merchant/validateProduct.ts
export function validateGoogleProduct(product: any): string[] {
  const errors: string[] = [];

  if (!product.title?.trim()) errors.push("title is required");
  if (product.title?.length > 150) errors.push("title must be 150 characters or fewer");
  if (!product.description?.trim()) errors.push("description is required");
  if (!product.images?.length) errors.push("at least one image is required");
  if (!product.images?.[^0]?.url?.startsWith("https://"))
    errors.push("image link must use HTTPS");
  if (!product.price) errors.push("price is required");
  if (product.price <= 0) errors.push("price must be greater than zero");
  if (!product.currency) errors.push("currency is required");
  if (!product.slug) errors.push("product URL slug is required");

  // Branded products need GTIN or MPN
  if (product.brand && !product.gtin && !product.mpn)
    errors.push("branded products require gtin or mpn");

  return errors;
}
```


***

## Product sync job

```ts
// supabase/functions/google-merchant-sync-products/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { decryptJson } from "../../../packages/integrations/crypto.ts";
import { GoogleMerchantClient } from "../../../packages/integrations/google-merchant/client.ts";
import { mapProductToGoogle } from "../../../packages/integrations/google-merchant/mapProduct.ts";
import { validateGoogleProduct } from "../../../packages/integrations/google-merchant/validateProduct.ts";
import { refreshGoogleToken } from "../../../packages/integrations/google-merchant/refreshToken.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENCRYPTION_KEY = Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!;

serve(async () => {
  const jobs = await fetchJson(
    `${SUPABASE_URL}/rest/v1/marketplace_sync_jobs?status=eq.queued&job_type=eq.sync_products&provider=eq.google_merchant&limit=10`
  );

  for (const job of jobs) {
    try {
      await processProductJob(job);
      await markJobSucceeded(job.id);
    } catch (e) {
      await markJobFailed(job.id, String(e));
    }
  }

  return Response.json({ ok: true });
});

async function processProductJob(job: any) {
  const product = await fetchJson(
    `${SUPABASE_URL}/rest/v1/products?id=eq.${job.payload.product_id}&select=*`
  ).then(r => r[^0]);

  const errors = validateGoogleProduct(product);
  if (errors.length) throw new Error(`Validation failed: ${errors.join("; ")}`);

  const account = await fetchJson(
    `${SUPABASE_URL}/rest/v1/marketplace_accounts?id=eq.${job.marketplace_account_id}&select=*`
  ).then(r => r[^0]);

  const dataSource = await fetchJson(
    `${SUPABASE_URL}/rest/v1/google_merchant_data_sources?marketplace_account_id=eq.${account.id}&is_primary=eq.true&select=*`
  ).then(r => r[^0]);

  const cred = await fetchJson(
    `${SUPABASE_URL}/rest/v1/marketplace_credentials?marketplace_account_id=eq.${account.id}&is_active=eq.true&select=*`
  ).then(r => r[^0]);

  let token = decryptJson<any>(cred.encrypted_payload, ENCRYPTION_KEY);

  // Refresh if within 5 minutes of expiry
  const expiresAt = new Date(cred.expires_at).getTime();
  if (expiresAt - Date.now() < 5 * 60 * 1000) {
    const refreshed = await refreshGoogleToken(token.refresh_token);
    token = { ...token, ...refreshed };
    await updateCredential(cred.id, token, refreshed.expires_in);
  }

  const client = new GoogleMerchantClient({
    accessToken: token.access_token,
    merchantId: account.external_account_id,
    dataSourceId: dataSource.data_source_id
  });

  const payload = mapProductToGoogle(product, {
    contentLanguage: dataSource.content_language,
    feedLabel: dataSource.feed_label,
    baseUrl: Deno.env.get("APP_URL")!
  });

  const result = await client.insertProductInput(payload);

  await upsertProductMapping(
    job.tenant_id,
    account.id,
    product.id,
    payload.offerId
  );
}

async function fetchJson(url: string) {
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (!res.ok) throw new Error(`Fetch failed: ${url}`);
  return res.json();
}

async function upsertProductMapping(
  tenantId: string,
  accountId: string,
  productId: string,
  offerId: string
) {
  await fetch(`${SUPABASE_URL}/rest/v1/marketplace_product_mappings`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      marketplace_account_id: accountId,
      product_id: productId,
      external_product_id: offerId,
      status: "published",
      last_synced_at: new Date().toISOString()
    })
  });
}

async function markJobSucceeded(jobId: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/marketplace_sync_jobs?id=eq.${jobId}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ status: "succeeded", finished_at: new Date().toISOString() })
  });
}

async function markJobFailed(jobId: string, message: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/marketplace_sync_jobs?id=eq.${jobId}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      status: "failed",
      last_error_message: message,
      finished_at: new Date().toISOString()
    })
  });
}

async function updateCredential(credId: string, token: any, expiresIn: number) {
  const ENCRYPTION_KEY = Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!;
  const { encryptJson } = await import("../../../packages/integrations/crypto.ts");
  const encrypted = encryptJson(token, ENCRYPTION_KEY);
  await fetch(`${SUPABASE_URL}/rest/v1/marketplace_credentials?id=eq.${credId}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      encrypted_payload: encrypted,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString()
    })
  });
}
```


***

## Availability update job

When stock drops to zero or restores, push an availability-only update without touching other product attributes.

```ts
// supabase/functions/google-merchant-update-availability/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { decryptJson } from "../../../packages/integrations/crypto.ts";
import { GoogleMerchantClient } from "../../../packages/integrations/google-merchant/client.ts";
import { refreshGoogleToken } from "../../../packages/integrations/google-merchant/refreshToken.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async () => {
  const jobs = await fetch(
    `${SUPABASE_URL}/rest/v1/marketplace_sync_jobs?status=eq.queued&job_type=eq.update_availability&provider=eq.google_merchant&limit=20`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  ).then(r => r.json());

  for (const job of jobs) {
    try {
      const mapping = await fetch(
        `${SUPABASE_URL}/rest/v1/marketplace_product_mappings?product_id=eq.${job.payload.product_id}&marketplace_account_id=eq.${job.marketplace_account_id}&select=*`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      ).then(r => r.json()).then(r => r[^0]);

      if (!mapping) throw new Error("No product mapping found");

      const account = await fetch(
        `${SUPABASE_URL}/rest/v1/marketplace_accounts?id=eq.${job.marketplace_account_id}&select=*`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      ).then(r => r.json()).then(r => r[^0]);

      const dataSource = await fetch(
        `${SUPABASE_URL}/rest/v1/google_merchant_data_sources?marketplace_account_id=eq.${account.id}&is_primary=eq.true&select=*`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      ).then(r => r.json()).then(r => r[^0]);

      const cred = await fetch(
        `${SUPABASE_URL}/rest/v1/marketplace_credentials?marketplace_account_id=eq.${account.id}&is_active=eq.true&select=*`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      ).then(r => r.json()).then(r => r[^0]);

      let token = decryptJson<any>(cred.encrypted_payload, Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!);
      if (new Date(cred.expires_at).getTime() - Date.now() < 5 * 60 * 1000) {
        const refreshed = await refreshGoogleToken(token.refresh_token);
        token = { ...token, ...refreshed };
      }

      const client = new GoogleMerchantClient({
        accessToken: token.access_token,
        merchantId: account.external_account_id,
        dataSourceId: dataSource.data_source_id
      });

      // Re-insert the product with only availability changed
      // Google Merchant API merges on offerId so this is safe
      await client.insertProductInput({
        offerId: mapping.external_product_id,
        contentLanguage: dataSource.content_language,
        feedLabel: dataSource.feed_label,
        productAttributes: {
          title: job.payload.title,
          description: job.payload.description,
          link: job.payload.link,
          imageLink: job.payload.image_link,
          availability: job.payload.stock > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
          price: {
            amountMicros: String(Math.round(job.payload.price * 1_000_000)),
            currencyCode: job.payload.currency
          },
          condition: "NEW"
        }
      });

      await fetch(`${SUPABASE_URL}/rest/v1/marketplace_sync_jobs?id=eq.${job.id}`, {
        method: "PATCH",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "succeeded", finished_at: new Date().toISOString() })
      });
    } catch (e) {
      await fetch(`${SUPABASE_URL}/rest/v1/marketplace_sync_jobs?id=eq.${job.id}`, {
        method: "PATCH",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "failed", last_error_message: String(e) })
      });
    }
  }

  return Response.json({ ok: true });
});
```


***

## Product delete job

```ts
// supabase/functions/google-merchant-delete-product/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { decryptJson } from "../../../packages/integrations/crypto.ts";
import { GoogleMerchantClient } from "../../../packages/integrations/google-merchant/client.ts";
import { refreshGoogleToken } from "../../../packages/integrations/google-merchant/refreshToken.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async () => {
  const jobs = await fetch(
    `${SUPABASE_URL}/rest/v1/marketplace_sync_jobs?status=eq.queued&job_type=eq.delete_product&provider=eq.google_merchant&limit=10`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  ).then(r => r.json());

  for (const job of jobs) {
    try {
      const mapping = await fetch(
        `${SUPABASE_URL}/rest/v1/marketplace_product_mappings?product_id=eq.${job.payload.product_id}&marketplace_account_id=eq.${job.marketplace_account_id}&select=*`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      ).then(r => r.json()).then(r => r[^0]);

      if (!mapping) {
        // Already unmapped, treat as success
        await markJobSucceeded(job.id);
        continue;
      }

      const account = await fetch(
        `${SUPABASE_URL}/rest/v1/marketplace_accounts?id=eq.${job.marketplace_account_id}&select=*`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      ).then(r => r.json()).then(r => r[^0]);

      const dataSource = await fetch(
        `${SUPABASE_URL}/rest/v1/google_merchant_data_sources?marketplace_account_id=eq.${account.id}&is_primary=eq.true&select=*`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      ).then(r => r.json()).then(r => r[^0]);

      const cred = await fetch(
        `${SUPABASE_URL}/rest/v1/marketplace_credentials?marketplace_account_id=eq.${account.id}&is_active=eq.true&select=*`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      ).then(r => r.json()).then(r => r[^0]);

      let token = decryptJson<any>(cred.encrypted_payload, Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!);
      if (new Date(cred.expires_at).getTime() - Date.now() < 5 * 60 * 1000) {
        const refreshed = await refreshGoogleToken(token.refresh_token);
        token = { ...token, ...refreshed };
      }

      const client = new GoogleMerchantClient({
        accessToken: token.access_token,
        merchantId: account.external_account_id,
        dataSourceId: dataSource.data_source_id
      });

      await client.deleteProductInput(mapping.external_product_id);

      // Soft-delete the mapping
      await fetch(`${SUPABASE_URL}/rest/v1/marketplace_product_mappings?id=eq.${mapping.id}`, {
        method: "PATCH",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "deleted", last_synced_at: new Date().toISOString() })
      });

      await markJobSucceeded(job.id);
    } catch (e) {
      await markJobFailed(job.id, String(e));
    }
  }

  return Response.json({ ok: true });
});
```


***

## Diagnostics sync job

Google does not push diagnostics to you. You must poll account-level and product-level status on a schedule. The Content API diagnostics model maps `accountLevelIssues` and `itemLevelIssues` with codes like `image_link_broken`, `landing_page_error`, and `missing_required_attribute`.[^5][^4]

```ts
// supabase/functions/google-merchant-sync-diagnostics/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { decryptJson } from "../../../packages/integrations/crypto.ts";
import { GoogleMerchantClient } from "../../../packages/integrations/google-merchant/client.ts";
import { refreshGoogleToken } from "../../../packages/integrations/google-merchant/refreshToken.ts";
import { normalizeAccountIssues, normalizeItemIssues } from "../../../packages/integrations/google-merchant/normalizeDiagnostics.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async () => {
  const accounts = await fetch(
    `${SUPABASE_URL}/rest/v1/marketplace_accounts?provider=eq.google_merchant&status=eq.connected&select=*`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  ).then(r => r.json());

  for (const account of accounts) {
    try {
      const dataSource = await fetch(
        `${SUPABASE_URL}/rest/v1/google_merchant_data_sources?marketplace_account_id=eq.${account.id}&is_primary=eq.true&select=*`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      ).then(r => r.json()).then(r => r[^0]);

      const cred = await fetch(
        `${SUPABASE_URL}/rest/v1/marketplace_credentials?marketplace_account_id=eq.${account.id}&is_active=eq.true&select=*`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      ).then(r => r.json()).then(r => r[^0]);

      let token = decryptJson<any>(cred.encrypted_payload, Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!);
      if (new Date(cred.expires_at).getTime() - Date.now() < 5 * 60 * 1000) {
        const refreshed = await refreshGoogleToken(token.refresh_token);
        token = { ...token, ...refreshed };
      }

      const client = new GoogleMerchantClient({
        accessToken: token.access_token,
        merchantId: account.external_account_id,
        dataSourceId: dataSource?.data_source_id ?? ""
      });

      const accountStatus = await client.getAccountStatus();
      const accountIssues = normalizeAccountIssues(accountStatus, account);
      await upsertDiagnostics(accountIssues);

      // Page through all product statuses
      let pageToken: string | undefined;
      do {
        const result = await client.listProductStatuses(pageToken);
        const products = result.resources ?? result.products ?? [];
        const itemIssues = normalizeItemIssues(products, account);
        await upsertDiagnostics(itemIssues);
        pageToken = result.nextPageToken;
      } while (pageToken);

      await fetch(`${SUPABASE_URL}/rest/v1/marketplace_accounts?id=eq.${account.id}`, {
        method: "PATCH",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ last_health_check_at: new Date().toISOString() })
      });
    } catch (e) {
      console.error(`Diagnostics sync failed for account ${account.id}:`, e);
    }
  }

  return Response.json({ ok: true });
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
```


### Diagnostics normalizer

```ts
// packages/integrations/google-merchant/normalizeDiagnostics.ts
export function normalizeAccountIssues(accountStatus: any, account: any) {
  return (accountStatus.accountLevelIssues ?? []).map((issue: any) => ({
    tenant_id: account.tenant_id,
    marketplace_account_id: account.id,
    scope: "account",
    external_product_id: null,
    issue_code: issue.id,
    title: issue.title,
    description: issue.detail ?? null,
    severity: issue.severity,
    servability: null,
    resolution: null,
    attribute_name: null,
    documentation_url: issue.documentation ?? null,
    affected_count: null,
    country: issue.country ?? null,
    destination: null,
    updated_at: new Date().toISOString()
  }));
}

export function normalizeItemIssues(products: any[], account: any) {
  const rows: any[] = [];
  for (const product of products) {
    for (const dest of product.destinationStatuses ?? []) {
      for (const issue of product.itemLevelIssues ?? []) {
        rows.push({
          tenant_id: account.tenant_id,
          marketplace_account_id: account.id,
          scope: "product",
          external_product_id: product.id ?? product.productId,
          issue_code: issue.code,
          title: issue.description ?? issue.detail ?? issue.code,
          description: issue.detail ?? null,
          severity: issue.servability === "disapproved" ? "critical" : "warning",
          servability: issue.servability ?? null,
          resolution: issue.resolution ?? null,
          attribute_name: issue.attributeName ?? null,
          documentation_url: issue.documentation ?? null,
          affected_count: issue.numItems ? Number(issue.numItems) : null,
          country: dest.country ?? null,
          destination: dest.destination ?? null,
          updated_at: new Date().toISOString()
        });
      }
    }
  }
  return rows;
}
```


***

## Scheduled functions

Register two scheduled jobs via pg_cron:

```sql
-- Sync products every 30 minutes
select cron.schedule(
  'google-merchant-sync-products',
  '*/30 * * * *',
  $$select net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/google-merchant-sync-products',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret'))
  )$$
);

-- Sync diagnostics every 6 hours
select cron.schedule(
  'google-merchant-sync-diagnostics',
  '0 */6 * * *',
  $$select net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/google-merchant-sync-diagnostics',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret'))
  )$$
);
```


***

## Dashboard screens

### Google Merchant account page

```tsx
// apps/merchant-dashboard/app/(protected)/integrations/google-merchant/[accountId]/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function GoogleMerchantAccountPage({ params }: { params: { accountId: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: account } = await supabase
    .from("marketplace_accounts")
    .select("*")
    .eq("id", params.accountId)
    .single();

  const { data: diagnostics } = await supabase
    .from("google_merchant_diagnostics")
    .select("*")
    .eq("marketplace_account_id", params.accountId)
    .is("resolved_at", null)
    .order("severity", { ascending: false })
    .limit(50);

  const { data: recentJobs } = await supabase
    .from("marketplace_sync_jobs")
    .select("*")
    .eq("marketplace_account_id", params.accountId)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Google Merchant Center</h1>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Account ID" value={account?.external_account_id} />
        <StatCard label="Status" value={account?.status} />
        <StatCard label="Last Health Check" value={account?.last_health_check_at} />
      </div>

      <DiagnosticsTable diagnostics={diagnostics ?? []} />
      <SyncJobTable jobs={recentJobs ?? []} />
    </div>
  );
}
```


### Diagnostics table component

```tsx
// apps/merchant-dashboard/components/integrations/google-merchant/DiagnosticsTable.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

export function DiagnosticsTable({ diagnostics }: { diagnostics: any[] }) {
  if (!diagnostics.length) {
    return <p className="text-muted-foreground text-sm">No active issues found.</p>;
  }

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left">Scope</th>
            <th className="px-4 py-2 text-left">Issue</th>
            <th className="px-4 py-2 text-left">Severity</th>
            <th className="px-4 py-2 text-left">Servability</th>
            <th className="px-4 py-2 text-left">Products Affected</th>
            <th className="px-4 py-2 text-left">Country</th>
            <th className="px-4 py-2 text-left">Docs</th>
          </tr>
        </thead>
        <tbody>
          {diagnostics.map((d) => (
            <tr key={d.id} className="border-t">
              <td className="px-4 py-2 capitalize">{d.scope}</td>
              <td className="px-4 py-2">
                <p className="font-medium">{d.title}</p>
                {d.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{d.description}</p>
                )}
              </td>
              <td className="px-4 py-2">
                <SeverityBadge severity={d.severity} />
              </td>
              <td className="px-4 py-2">{d.servability ?? "—"}</td>
              <td className="px-4 py-2">{d.affected_count ?? "—"}</td>
              <td className="px-4 py-2">{d.country ?? "—"}</td>
              <td className="px-4 py-2">
                {d.documentation_url && (
                  <a href={d.documentation_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: "destructive",
    error: "destructive",
    warning: "secondary",
    suggestion: "outline"
  };
  return (
    <Badge variant={(map[severity] as any) ?? "outline"}>
      {severity}
    </Badge>
  );
}
```


### Product feed health page

```tsx
// apps/merchant-dashboard/app/(protected)/integrations/google-merchant/[accountId]/feed/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function FeedHealthPage({ params }: { params: { accountId: string } }) {
  const supabase = createSupabaseServerClient();

  const { data: mappings } = await supabase
    .from("marketplace_product_mappings")
    .select("*, products(*)")
    .eq("marketplace_account_id", params.accountId)
    .order("status");

  const statusCounts = mappings?.reduce((acc: any, m: any) => {
    acc[m.status] = (acc[m.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-xl font-semibold">Product Feed Health</h2>

      <div className="grid grid-cols-4 gap-4">
        {Object.entries(statusCounts ?? {}).map(([status, count]) => (
          <StatCard key={status} label={status} value={String(count)} />
        ))}
      </div>

      <ProductMappingTable mappings={mappings ?? []} />
    </div>
  );
}
```


***

## Environment variables

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_MERCHANT_BASE_URL=https://merchantapi.googleapis.com/products/v1
APP_ENCRYPTION_KEY_BASE64=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
APP_URL=
```


***

## File structure

```txt
packages/
  integrations/
    google-merchant/
      client.ts
      refreshToken.ts
      mapProduct.ts
      validateProduct.ts
      normalizeDiagnostics.ts
      types.ts
      errors.ts

apps/
  merchant-dashboard/
    app/(protected)/integrations/google-merchant/
      page.tsx
      connect/
        page.tsx
      [accountId]/
        page.tsx
        feed/page.tsx
        diagnostics/page.tsx
    components/integrations/google-merchant/
      DiagnosticsTable.tsx
      FeedHealthPage.tsx
      ProductMappingTable.tsx
      SyncJobTable.tsx
      StatCard.tsx

supabase/
  functions/
    google-merchant-start/
    google-merchant-callback/
    google-merchant-sync-products/
    google-merchant-update-availability/
    google-merchant-delete-product/
    google-merchant-sync-diagnostics/
  migrations/
    20260330_google_merchant_data_sources.sql
    20260330_google_merchant_diagnostics.sql
```


***

## Implementation sequence

1. Create database tables and RLS policies.
2. Register a Google Cloud OAuth 2.0 web application credential.
3. Add the merchant's Google account as an Admin user in Merchant Center.
4. Implement the auth start and callback Edge Functions.
5. Implement the token refresh helper.
6. Implement the API client.
7. Implement the product mapper and validator.
8. Implement the product sync job.
9. Implement the availability update job.
10. Implement the product delete job.
11. Implement the diagnostics sync job.
12. Register pg_cron schedules.
13. Build the dashboard pages and diagnostics table.
14. Test with a real Merchant Center sandbox account.
15. Verify disapproval detection and display end to end.

***

## Definition of done

Google Merchant is ready when:

- A merchant can connect their Merchant Center account via OAuth.
- Products can be validated, published, updated, and deleted.
- Availability updates are pushed when stock changes.
- Account-level and item-level diagnostics are polled and stored.
- Disapproved products surface in the dashboard with remediation links.
- Token refresh runs transparently before any expiry.
- Scheduled sync and diagnostics jobs run without manual intervention.

***

You now have complete, ready-to-wire guides for all four platforms — **Shopee, TikTok Shop, Lazada, and Google Merchant**. The next most useful output would be the **complete Postgres migration files** for all four platforms as a single ordered migration pack, or the **shared job runner and retry system** as a production-ready Edge Function. Which would you like next?
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://developers.google.com/merchant/api/guides/quickstart/authentication

[^2]: https://developers.google.com/merchant/api/guides/products/add-manage

[^3]: https://searchengineland.com/google-content-api-shopping-new-merchant-api-460937

[^4]: https://developers.google.com/shopping-content/guides/how-tos/severity-mapping

[^5]: https://support.google.com/merchants/answer/14173602?hl=en-IE

[^6]: https://verdemedia.com/blog/common-google-merchant-center-rejections-and-how-to-avoid-them

[^7]: https://docs.nexla.com/user-guides/connectors/gmcontent_api/gmcontent_api_auth

[^8]: https://digitalthriveai.com/en-us/resources/docs/web-development/google-introduces-new-content-api-google-shopping/

[^9]: https://developers.google.com/shopping-content/guides/how-tos/authorizing

[^10]: https://www.scribd.com/document/835436949/gmc-document

[^11]: https://support.google.com/merchants/answer/11586438?hl=en

[^12]: https://github.com/google/merchant-api-samples/blob/main/README.md

[^13]: https://www.youtube.com/watch?v=9prFiiu9pTw

[^14]: https://dlthub.com/context/source/merchant-center

[^15]: https://pipedream.com/apps/google-merchant-center

[^16]: https://support.google.com/merchants/answer/9145958?hl=en-au

