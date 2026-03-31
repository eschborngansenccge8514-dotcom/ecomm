<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Continue with tiktok

Below is a **ready-to-use TikTok Shop integration guide** tailored to your stack: Next.js 16, Supabase, PostgreSQL, and Edge Functions. TikTok Shop uses OAuth 2.0-style authorization for shop access, and its webhook/event model includes order status changes, package updates, product information changes, product audit changes, cancellation, returns, invoice updates, seller deauthorization, and authorization-expiration notifications.[^1][^2][^3]

## What this integration should do

Your TikTok connector should:

- Connect a merchant’s TikTok Shop account to a tenant.
- Store shop tokens and credentials securely.
- Sync products from your canonical catalog.
- Pull and normalize orders.
- Push shipment and tracking updates.
- Push inventory changes.
- Receive and deduplicate TikTok webhooks.
- Surface audit and authorization issues in the dashboard.

TikTok Shop is more event-heavy than Shopee, so you should treat webhook ingestion and order/package state transitions as first-class workflows rather than optional extras.[^4][^3][^5]

## TikTok architecture

Use this flow:

1. Merchant clicks **Connect TikTok Shop**.
2. Next.js starts an auth state record.
3. Merchant authorizes your app in TikTok Shop.
4. Callback lands in a Supabase Edge Function.
5. The function exchanges the auth code for access tokens.
6. Tokens and shop context are encrypted and stored.
7. Webhooks are registered and verified.
8. Sync jobs pull products, orders, and diagnostics.
9. Dashboard shows status, errors, and retry actions.

This keeps tokens server-side and lets your job runner handle sync and replay safely.

## TikTok data model

Add these tables or extend your current integration schema.

### `marketplace_accounts`

```sql
create table if not exists marketplace_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider text not null default 'tiktok',
  external_account_id text not null,
  display_name text,
  region text not null,
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


### `marketplace_webhook_subscriptions`

```sql
create table if not exists marketplace_webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  marketplace_account_id uuid not null references marketplace_accounts(id) on delete cascade,
  event_type text not null,
  address text not null,
  status text not null default 'active',
  create_time timestamptz,
  last_verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, marketplace_account_id, event_type)
);
```


### `marketplace_events`

```sql
create table if not exists marketplace_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  marketplace_account_id uuid not null references marketplace_accounts(id) on delete cascade,
  provider text not null,
  event_key text not null,
  event_type text not null,
  raw_payload jsonb not null,
  parsed_payload jsonb not null default '{}'::jsonb,
  signature_valid boolean,
  processing_status text not null default 'received',
  correlation_id text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text,
  unique (provider, event_key)
);
```


### `marketplace_sync_jobs`

```sql
create table if not exists marketplace_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  marketplace_account_id uuid not null references marketplace_accounts(id) on delete cascade,
  provider text not null default 'tiktok',
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


## TikTok auth flow

TikTok Shop auth should be handled through an auth-code exchange, with app key, app secret, and service ID stored in your vault. Public integration guidance describes OAuth-based access and the need to enable specific APIs such as Shop Authorized Information, Product Basic, and Order Information.[^2][^1]

### Start auth endpoint

```ts
// supabase/functions/tiktok-start/index.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  const { tenantId, returnTo } = await req.json();
  const state = crypto.randomUUID();

  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/oauth_states`, {
    method: "POST",
    headers: {
      apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      provider: "tiktok",
      state,
      metadata: { returnTo }
    })
  });

  if (!res.ok) return new Response("failed to create oauth state", { status: 500 });

  const appKey = Deno.env.get("TIKTOK_APP_KEY")!;
  const redirectUri = encodeURIComponent(`${Deno.env.get("APP_URL")}/api/integrations/tiktok/callback`);
  const scope = encodeURIComponent("shop.authorized_info product.basic order.basic");
  const url = `https://auth.tiktok-shops.com/oauth/authorize?client_key=${appKey}&redirect_uri=${redirectUri}&response_type=code&state=${state}&scope=${scope}`;

  return Response.json({ authorizationUrl: url });
});
```


### Callback endpoint

```ts
// supabase/functions/tiktok-callback/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { encryptJson } from "../../../packages/integrations/crypto.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) return new Response("missing code/state", { status: 400 });

  const stateRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/oauth_states?state=eq.${state}&provider=eq.tiktok&select=*`, {
    headers: {
      apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`
    }
  });
  const states = await stateRes.json();
  if (!states?.length) return new Response("invalid state", { status: 400 });

  const tokenRes = await fetch("https://open-api.tiktokglobalshop.com/api/v2/token/get", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_key: Deno.env.get("TIKTOK_APP_KEY"),
      app_secret: Deno.env.get("TIKTOK_APP_SECRET"),
      auth_code: code
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
      credential_type: "tiktok_access_token",
      encrypted_payload: encryptedPayload,
      expires_at: tokenData.data?.access_token_expire_in
        ? new Date(Date.now() + tokenData.data.access_token_expire_in * 1000).toISOString()
        : null
    })
  });

  return Response.redirect(`${Deno.env.get("APP_URL")}/integrations/tiktok?connected=1`, 302);
});
```


## TikTok request signing

TikTok Shop API signing rules are different from Shopee. A common pattern is to sort parameters, concatenate them, wrap them with the app secret, and generate an HMAC-SHA256 signature. Public examples show the general structure, but your final implementation must match the exact TikTok Shop endpoint rules you are using.[^6][^7]

```ts
// packages/integrations/tiktok/signature.ts
import { createHmac } from "node:crypto";

export function signTikTokRequest(input: {
  appKey: string;
  appSecret: string;
  params: Record<string, string | number | undefined>;
}) {
  const entries = Object.entries(input.params)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b));

  const base = entries.map(([k, v]) => `${k}${v}`).join("");
  const src = `${input.appSecret}${base}${input.appSecret}`;

  return createHmac("sha256", input.appSecret).update(src).digest("hex").toUpperCase();
}
```


## TikTok API client

```ts
// packages/integrations/tiktok/client.ts
import { signTikTokRequest } from "./signature";

export class TikTokClient {
  constructor(
    private config: {
      appKey: string;
      appSecret: string;
      baseUrl: string;
      accessToken: string;
      shopId: string;
    }
  ) {}

  private buildUrl(path: string, params: Record<string, string | number | undefined>) {
    const timestamp = Date.now();
    const allParams = {
      app_key: this.config.appKey,
      timestamp,
      access_token: this.config.accessToken,
      shop_id: this.config.shopId,
      sign_method: "HmacSHA256",
      ...params
    };

    const sign = signTikTokRequest({
      appKey: this.config.appKey,
      appSecret: this.config.appSecret,
      params: allParams
    });

    const url = new URL(`${this.config.baseUrl}${path}`);
    for (const [k, v] of Object.entries(allParams)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    url.searchParams.set("sign", sign);
    return url.toString();
  }

  async getShopInfo() {
    const url = this.buildUrl("/api/shop/get_shop_info", {});
    const res = await fetch(url);
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  async listOrders(params: { createTimeFrom: number; createTimeTo: number }) {
    const url = this.buildUrl("/api/order/search", {
      create_time_from: params.createTimeFrom,
      create_time_to: params.createTimeTo
    });
    const res = await fetch(url);
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  async getOrderDetail(orderId: string) {
    const url = this.buildUrl("/api/order/detail", { order_id: orderId });
    const res = await fetch(url);
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  async createOrUpdateProduct(payload: any) {
    const url = this.buildUrl("/api/product/save", {});
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  async updateInventory(payload: any) {
    const url = this.buildUrl("/api/inventory/update", {});
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  async shipOrder(payload: any) {
    const url = this.buildUrl("/api/order/ship", {});
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  private async toError(res: Response) {
    const body = await res.text();
    return new Error(`TikTok Shop API error ${res.status}: ${body}`);
  }
}
```


## Product mapping

Use a strict validator before publishing.

```ts
// packages/integrations/tiktok/mapProduct.ts
export function mapProductToTikTok(product: any) {
  return {
    title: product.title,
    description: product.description,
    main_images: product.images.map((img: any) => img.url),
    skus: product.variants.map((variant: any) => ({
      seller_sku: variant.sku,
      price: variant.price,
      stock_qty: variant.stock_on_hand,
      attributes: variant.options
    })),
    category_id: product.provider_meta?.tiktok?.category_id,
    brand: product.brand
  };
}

export function validateTikTokProduct(product: any) {
  const errors: string[] = [];

  if (!product.title?.trim()) errors.push("title is required");
  if (!product.description?.trim()) errors.push("description is required");
  if (!product.images?.length) errors.push("at least one image is required");
  if (!product.variants?.length) errors.push("at least one variant is required");

  for (const v of product.variants || []) {
    if (!v.sku) errors.push("variant sku is required");
    if (v.price == null) errors.push(`variant ${v.sku} price is required`);
    if (v.stock_on_hand == null) errors.push(`variant ${v.sku} stock is required`);
  }

  return errors;
}
```


## Product sync job

```ts
// supabase/functions/tiktok-sync-products/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { decryptJson } from "../../../packages/integrations/crypto.ts";
import { TikTokClient } from "../../../packages/integrations/tiktok/client.ts";
import { mapProductToTikTok, validateTikTokProduct } from "../../../packages/integrations/tiktok/mapProduct.ts";

serve(async () => {
  const jobs = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/marketplace_sync_jobs?status=eq.queued&job_type=eq.sync_products&provider=eq.tiktok&limit=10`, {
    headers: {
      apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`
    }
  }).then(r => r.json());

  for (const job of jobs) {
    try {
      const product = await getProduct(job.payload.product_id);
      const validationErrors = validateTikTokProduct(product);
      if (validationErrors.length) throw new Error(validationErrors.join(", "));

      const account = await getAccount(job.marketplace_account_id);
      const creds = await getActiveCreds(account.id);
      const token = decryptJson<any>(creds.encrypted_payload, Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!);

      const client = new TikTokClient({
        appKey: Deno.env.get("TIKTOK_APP_KEY")!,
        appSecret: Deno.env.get("TIKTOK_APP_SECRET")!,
        baseUrl: Deno.env.get("TIKTOK_BASE_URL")!,
        accessToken: token.access_token,
        shopId: account.external_account_id
      });

      const payload = mapProductToTikTok(product);
      const result = await client.createOrUpdateProduct(payload);

      await saveProductMapping(job.tenant_id, account.id, product.id, result.data?.product_id);
      await markJobSucceeded(job.id, result);
    } catch (e) {
      await markJobFailed(job.id, String(e));
    }
  }

  return Response.json({ ok: true });
});
```


## Order sync job

TikTok’s webhook reference shows several order and package-related event types, so you should support both polling and push processing.[^3]

```ts
// packages/integrations/tiktok/mapOrder.ts
export function mapTikTokOrder(raw: any) {
  return {
    external_order_id: raw.order_id,
    status: raw.order_status,
    currency: raw.currency,
    total_amount: raw.payment?.total_amount,
    buyer_name: raw.buyer?.username,
    items: (raw.items || []).map((item: any) => ({
      external_item_id: item.item_id,
      sku: item.seller_sku,
      quantity: item.quantity,
      price: item.sale_price
    }))
  };
}
```

```ts
// supabase/functions/tiktok-sync-orders/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { decryptJson } from "../../../packages/integrations/crypto.ts";
import { TikTokClient } from "../../../packages/integrations/tiktok/client.ts";
import { mapTikTokOrder } from "../../../packages/integrations/tiktok/mapOrder.ts";

serve(async () => {
  const jobs = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/marketplace_sync_jobs?status=eq.queued&job_type=eq.sync_orders&provider=eq.tiktok&limit=10`, {
    headers: {
      apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`
    }
  }).then(r => r.json());

  for (const job of jobs) {
    const account = await getAccount(job.marketplace_account_id);
    const creds = await getActiveCreds(account.id);
    const token = decryptJson<any>(creds.encrypted_payload, Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!);

    const client = new TikTokClient({
      appKey: Deno.env.get("TIKTOK_APP_KEY")!,
      appSecret: Deno.env.get("TIKTOK_APP_SECRET")!,
      baseUrl: Deno.env.get("TIKTOK_BASE_URL")!,
      accessToken: token.access_token,
      shopId: account.external_account_id
    });

    const res = await client.listOrders({
      createTimeFrom: job.payload.create_time_from,
      createTimeTo: job.payload.create_time_to
    });

    for (const row of res.data?.orders || []) {
      const detail = await client.getOrderDetail(row.order_id);
      const mapped = mapTikTokOrder(detail.data);
      await upsertCanonicalOrder(job.tenant_id, mapped);
      await upsertOrderMapping(job.tenant_id, account.id, mapped.external_order_id);
    }

    await markJobSucceeded(job.id, res);
  }

  return Response.json({ ok: true });
});
```


## Shipment flow

```ts
// supabase/functions/tiktok-ship-order/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { decryptJson } from "../../../packages/integrations/crypto.ts";
import { TikTokClient } from "../../../packages/integrations/tiktok/client.ts";

serve(async (req) => {
  const { jobId, orderId, trackingNumber, carrier } = await req.json();
  const job = await getJob(jobId);
  const account = await getAccount(job.marketplace_account_id);
  const creds = await getActiveCreds(account.id);
  const token = decryptJson<any>(creds.encrypted_payload, Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!);

  const client = new TikTokClient({
    appKey: Deno.env.get("TIKTOK_APP_KEY")!,
    appSecret: Deno.env.get("TIKTOK_APP_SECRET")!,
    baseUrl: Deno.env.get("TIKTOK_BASE_URL")!,
    accessToken: token.access_token,
    shopId: account.external_account_id
  });

  const result = await client.shipOrder({
    order_id: orderId,
    tracking_number: trackingNumber,
    shipping_provider: carrier
  });

  await markFulfillmentShipped(orderId, trackingNumber, carrier);
  return Response.json({ ok: true, result });
});
```


## Webhook handler

TikTok’s event model includes order status changes, package updates, product status changes, cancellation status changes, return status changes, deauthorization, and auth expiration.[^3]

```ts
// supabase/functions/tiktok-webhook/index.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  const raw = await req.text();
  const payload = JSON.parse(raw);
  const eventType = payload.event_type ?? payload.type ?? "unknown";
  const eventKey = payload.event_id ?? payload.id ?? crypto.randomUUID();

  const stored = await insertDedupIfNew({
    provider: "tiktok",
    eventKey,
    eventType,
    rawPayload: payload
  });

  if (!stored) return new Response("duplicate", { status: 200 });

  await enqueueTikTokEvent(payload);

  return new Response("ok", { status: 200 });
});
```


## Event routing

Route each event into a specific handler.

```ts
// packages/integrations/tiktok/events.ts
export function routeTikTokEvent(event: any) {
  switch (event.event_type) {
    case "ORDER_STATUS_CHANGE":
      return { jobType: "sync_orders", payload: { reason: "order_status_change" } };
    case "PACKAGE_UPDATE":
      return { jobType: "sync_orders", payload: { reason: "package_update" } };
    case "PRODUCT_INFORMATION_CHANGE":
    case "PRODUCT_STATUS_CHANGE":
    case "PRODUCT_AUDIT_STATUS_CHANGE":
      return { jobType: "sync_products", payload: { reason: event.event_type } };
    case "CANCELLATION_STATUS_CHANGE":
    case "RETURN_STATUS_CHANGE":
    case "REVERSE_STATUS_UPDATE":
      return { jobType: "sync_orders", payload: { reason: event.event_type } };
    case "SELLER_DEAUTHORIZATION":
      return { jobType: "deauthorize_account", payload: {} };
    case "UPCOMING_AUTHORIZATION_EXPIRATION":
      return { jobType: "refresh_credentials", payload: {} };
    default:
      return { jobType: "sync_diagnostics", payload: { reason: "unhandled_event" } };
  }
}
```


## Dashboard screens

Build these UI surfaces in Next.js.

### TikTok account page

Show:

- Shop ID.
- Region.
- Credential expiry.
- Webhook health.
- Audit status.
- Last sync time.


### TikTok product validator

Show validation errors before publishing:

- Missing title.
- Missing image.
- Missing SKU.
- Invalid category.
- Audit risk fields.


### TikTok order console

Show:

- Imported orders.
- Status changes.
- Package updates.
- Return and cancellation states.
- Replay actions.


### TikTok webhook inbox

Show:

- Event type.
- Raw payload.
- Parsed payload.
- Dedup status.
- Replay button.


### TikTok diagnostics page

Show:

- Authorization warnings.
- Upcoming expiration events.
- Deauthorization events.
- Product audit errors.


## Environment variables

```env
TIKTOK_APP_KEY=
TIKTOK_APP_SECRET=
TIKTOK_BASE_URL=https://open-api.tiktokglobalshop.com
APP_ENCRYPTION_KEY_BASE64=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
APP_URL=
```


## File structure

```txt
packages/
  integrations/
    tiktok/
      client.ts
      signature.ts
      mapProduct.ts
      mapOrder.ts
      events.ts
      types.ts
      errors.ts
apps/
  merchant-dashboard/
    app/(protected)/integrations/tiktok/
      page.tsx
      connect/page.tsx
      [accountId]/page.tsx
      validator/page.tsx
      webhooks/page.tsx
supabase/
  functions/
    tiktok-start/
    tiktok-callback/
    tiktok-sync-products/
    tiktok-sync-orders/
    tiktok-ship-order/
    tiktok-webhook/
```


## Implementation sequence

1. Create TikTok tables and RLS.
2. Add OAuth start and callback functions.
3. Store encrypted credentials.
4. Implement signature helper and client.
5. Implement product validator.
6. Implement product sync.
7. Implement order sync.
8. Implement shipment push.
9. Implement webhook receiver and event routing.
10. Build dashboard screens.
11. Add diagnostics and deauthorization handling.
12. Add tests and replay tooling.

## Definition of done

TikTok is ready when:

- A merchant can connect an account.
- Products can be validated and pushed.
- Orders can be imported and updated.
- Shipping confirmation can be sent.
- Webhooks are ingested idempotently.
- Product audit and auth-expiration warnings appear in the dashboard.

I can continue with the **full Lazada guide** next, or I can turn TikTok into a **copy-paste implementation pack** with exact migrations, helpers, and Edge Function files.
<span style="display:none">[^10][^11][^12][^13][^14][^15][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://www.echotik.live/blog/tiktok-shop-details-api-documentation-endpoints-features-guide/

[^2]: https://developers.apideck.com/connectors/tiktok/docs/application_owner+oauth_credentials

[^3]: https://docs.datavirtuality.com/connectors/tiktok-shop-api-reference

[^4]: https://www.echotik.live/blog/tiktok-shop-details-api-documentation-ecommerce-integration-guide/

[^5]: https://www.esellerhub.com/tiktok-shop-api-integration/

[^6]: https://www.echotik.live/blog/tiktok-shop-data-api-access-endpoints-metrics-and-analytics-2026/

[^7]: https://github.com/tiktok/tiktok-business-api-sdk/blob/main/java_sdk/docs/AuthenticationApi.md

[^8]: https://www.youtube.com/watch?v=XLWU1uiPhLA

[^9]: https://www.getphyllo.com/post/introduction-to-tiktok-api

[^10]: https://www.apideck.com/integrations/tiktok/products

[^11]: https://github.com/EcomPHP/tiktokshop-php

[^12]: https://help.sellercloud.com/omnichannel-ecommerce/tiktok-shop-account-integration/

[^13]: https://developers.tiktok.com

[^14]: https://github.com/ipfans/tiktok

[^15]: https://docs.celigo.com/hc/en-us/articles/18704697472667-Available-TikTok-Shop-APIs

