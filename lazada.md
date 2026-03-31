<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# continue with the full Lazada guide next.

Below is a **full, ready-to-implement Lazada guide** for your stack. Lazada Open Platform uses OAuth 2.0-style seller authorization, requires a callback URL to receive a one-time code, supports product/order operations, and exposes push/webhook mechanisms for order, product, reverse-order, auth-expiration, and category-tree events. The authorization code is single-use and time-limited, so the callback and token exchange must be server-side and immediate.[^1][^2][^3][^4]

## What this integration should do

Your Lazada connector should:

- Connect a merchant’s Lazada seller account to a tenant.
- Store access tokens securely.
- Sync products from your canonical catalog.
- Pull and normalize orders.
- Push shipping and fulfillment updates.
- Receive Lazada push notifications.
- Handle region/site-specific behavior.
- Surface sync errors and authorization expiry warnings in the dashboard.

Lazada is more region-sensitive than Shopee, so your implementation must treat country/site as a first-class property of the account.[^5][^2]

## Lazada architecture

Use this flow:

1. Merchant clicks **Connect Lazada**.
2. Next.js starts an auth-state record.
3. Merchant authorizes your app on Lazada.
4. Lazada redirects back with a one-time code.
5. Edge Function exchanges the code for tokens.
6. Tokens are encrypted and stored in Supabase.
7. Webhook endpoint is registered and verified.
8. Sync jobs pull products, orders, and diagnostics.
9. Dashboard shows connection health and errors.

This keeps all secrets server-side and gives you a deterministic sync pipeline.

## Lazada data model

Extend your integration schema with Lazada-specific data.

### `marketplace_accounts`

```sql
create table if not exists marketplace_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider text not null default 'lazada',
  external_account_id text not null,
  display_name text,
  region text not null,
  site_code text,
  status text not null default 'connected',
  last_successful_sync_at timestamptz,
  last_health_check_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider, external_account_id, region)
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
  provider text not null default 'lazada',
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


## Lazada auth flow

Lazada uses OAuth 2.0 seller authorization and returns a code to your callback URL. The code is valid for a short window and can only be used once, so your callback must exchange it immediately.[^2][^1]

### Start auth endpoint

```ts
// supabase/functions/lazada-start/index.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  const { tenantId, region, returnTo } = await req.json();
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
      provider: "lazada",
      state,
      metadata: { region, returnTo }
    })
  });

  if (!res.ok) return new Response("failed to save state", { status: 500 });

  const clientId = Deno.env.get("LAZADA_APP_KEY")!;
  const callback = encodeURIComponent(`${Deno.env.get("APP_URL")}/api/integrations/lazada/callback`);
  const url = `https://auth.lazada.com/oauth/authorize?response_type=code&force_auth=true&redirect_uri=${callback}&client_id=${clientId}`;

  return Response.json({ authorizationUrl: url });
});
```


### Callback endpoint

```ts
// supabase/functions/lazada-callback/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { encryptJson } from "../../../packages/integrations/crypto.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) return new Response("missing code/state", { status: 400 });

  const stateRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/oauth_states?state=eq.${state}&provider=eq.lazada&select=*`, {
    headers: {
      apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`
    }
  });
  const states = await stateRes.json();
  if (!states?.length) return new Response("invalid state", { status: 400 });

  const tokenRes = await fetch("https://auth.lazada.com/rest/auth/token/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      app_key: Deno.env.get("LAZADA_APP_KEY"),
      app_secret: Deno.env.get("LAZADA_APP_SECRET")
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
      credential_type: "lazada_access_token",
      encrypted_payload: encryptedPayload,
      expires_at: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null
    })
  });

  return Response.redirect(`${Deno.env.get("APP_URL")}/integrations/lazada?connected=1`, 302);
});
```


## Lazada request signing

Lazada API calls are signed. The exact canonical string format depends on endpoint rules, but the common pattern is to sort parameters and generate an HMAC signature with the app secret. Implement the signing layer centrally and keep the request builder per endpoint.[^6][^5]

```ts
// packages/integrations/lazada/signature.ts
import { createHmac } from "node:crypto";

export function signLazadaRequest(params: Record<string, string | number>, appSecret: string) {
  const base = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}${v}`)
    .join("");

  return createHmac("sha256", appSecret).update(base).digest("hex").toUpperCase();
}
```


## Lazada API client

```ts
// packages/integrations/lazada/client.ts
import { signLazadaRequest } from "./signature";

export class LazadaClient {
  constructor(
    private config: {
      appKey: string;
      appSecret: string;
      baseUrl: string;
      accessToken: string;
      region: string;
      country?: string;
    }
  ) {}

  private buildUrl(path: string, params: Record<string, string | number | undefined>) {
    const baseParams: Record<string, string | number> = {
      app_key: this.config.appKey,
      timestamp: Math.floor(Date.now() / 1000),
      access_token: this.config.accessToken
    };

    const allParams = { ...baseParams, ...params };
    const sign = signLazadaRequest(allParams, this.config.appSecret);

    const url = new URL(`${this.config.baseUrl}${path}`);
    for (const [k, v] of Object.entries(allParams)) url.searchParams.set(k, String(v));
    url.searchParams.set("sign", sign);
    return url.toString();
  }

  async getSellerInfo() {
    const url = this.buildUrl("/seller/get", {});
    const res = await fetch(url);
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  async listOrders(params: { createdAfter?: string; status?: string }) {
    const url = this.buildUrl("/orders/get", {
      created_after: params.createdAfter,
      status: params.status
    });
    const res = await fetch(url);
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  async getOrder(orderId: string) {
    const url = this.buildUrl("/order/get", { order_id: orderId });
    const res = await fetch(url);
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  async createOrUpdateProduct(payload: any) {
    const url = this.buildUrl("/product/create", {});
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  async updateStock(payload: any) {
    const url = this.buildUrl("/product/stock/update", {});
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  async fulfillOrder(payload: any) {
    const url = this.buildUrl("/order/fulfill/pack", {});
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
    return new Error(`Lazada API error ${res.status}: ${body}`);
  }
}
```


## Product mapping

```ts
// packages/integrations/lazada/mapProduct.ts
export function mapProductToLazada(product: any) {
  return {
    PrimaryCategory: product.provider_meta?.lazada?.category_id,
    SPUId: product.sku,
    Attributes: [
      { Name: "name", Value: product.title },
      { Name: "description", Value: product.description }
    ],
    Skus: product.variants.map((variant: any) => ({
      SellerSku: variant.sku,
      quantity: variant.stock_on_hand,
      price: variant.price
    })),
    Images: product.images.map((img: any) => img.url)
  };
}

export function validateLazadaProduct(product: any) {
  const errors: string[] = [];

  if (!product.title?.trim()) errors.push("title is required");
  if (!product.description?.trim()) errors.push("description is required");
  if (!product.images?.length) errors.push("at least one image is required");
  if (!product.variants?.length) errors.push("at least one variant is required");
  if (!product.provider_meta?.lazada?.category_id) errors.push("lazada category is required");

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
// supabase/functions/lazada-sync-products/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { decryptJson } from "../../../packages/integrations/crypto.ts";
import { LazadaClient } from "../../../packages/integrations/lazada/client.ts";
import { mapProductToLazada, validateLazadaProduct } from "../../../packages/integrations/lazada/mapProduct.ts";

serve(async () => {
  const jobs = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/marketplace_sync_jobs?status=eq.queued&job_type=eq.sync_products&provider=eq.lazada&limit=10`, {
    headers: {
      apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`
    }
  }).then(r => r.json());

  for (const job of jobs) {
    try {
      const product = await getProduct(job.payload.product_id);
      const validationErrors = validateLazadaProduct(product);
      if (validationErrors.length) throw new Error(validationErrors.join(", "));

      const account = await getAccount(job.marketplace_account_id);
      const creds = await getActiveCreds(account.id);
      const token = decryptJson<any>(creds.encrypted_payload, Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!);

      const client = new LazadaClient({
        appKey: Deno.env.get("LAZADA_APP_KEY")!,
        appSecret: Deno.env.get("LAZADA_APP_SECRET")!,
        baseUrl: Deno.env.get("LAZADA_BASE_URL")!,
        accessToken: token.access_token,
        region: account.region,
        country: account.metadata?.country
      });

      const payload = mapProductToLazada(product);
      const result = await client.createOrUpdateProduct(payload);

      await saveProductMapping(job.tenant_id, account.id, product.id, result.data?.item_id ?? result.ItemId);
      await markJobSucceeded(job.id, result);
    } catch (e) {
      await markJobFailed(job.id, String(e));
    }
  }

  return Response.json({ ok: true });
});
```


## Order sync job

Lazada’s open platform documents order operations and reverse-order flows, so your order sync should support normal order fetching plus fulfill/reverse-order workflows.[^7][^8][^4]

```ts
// packages/integrations/lazada/mapOrder.ts
export function mapLazadaOrder(raw: any) {
  return {
    external_order_id: raw.order_id,
    status: raw.status,
    currency: raw.currency,
    total_amount: raw.price,
    buyer_name: raw.customer_first_name || raw.buyer_name,
    items: (raw.order_items || []).map((item: any) => ({
      external_item_id: item.order_item_id,
      sku: item.sku,
      quantity: item.quantity,
      price: item.item_price
    }))
  };
}
```

```ts
// supabase/functions/lazada-sync-orders/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { decryptJson } from "../../../packages/integrations/crypto.ts";
import { LazadaClient } from "../../../packages/integrations/lazada/client.ts";
import { mapLazadaOrder } from "../../../packages/integrations/lazada/mapOrder.ts";

serve(async () => {
  const jobs = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/marketplace_sync_jobs?status=eq.queued&job_type=eq.sync_orders&provider=eq.lazada&limit=10`, {
    headers: {
      apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`
    }
  }).then(r => r.json());

  for (const job of jobs) {
    const account = await getAccount(job.marketplace_account_id);
    const creds = await getActiveCreds(account.id);
    const token = decryptJson<any>(creds.encrypted_payload, Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!);

    const client = new LazadaClient({
      appKey: Deno.env.get("LAZADA_APP_KEY")!,
      appSecret: Deno.env.get("LAZADA_APP_SECRET")!,
      baseUrl: Deno.env.get("LAZADA_BASE_URL")!,
      accessToken: token.access_token,
      region: account.region,
      country: account.metadata?.country
    });

    const res = await client.listOrders({
      createdAfter: job.payload.created_after,
      status: job.payload.status
    });

    for (const row of res.data?.orders || []) {
      const detail = await client.getOrder(row.order_id);
      const mapped = mapLazadaOrder(detail.data);
      await upsertCanonicalOrder(job.tenant_id, mapped);
      await upsertOrderMapping(job.tenant_id, account.id, mapped.external_order_id);
    }

    await markJobSucceeded(job.id, res);
  }

  return Response.json({ ok: true });
});
```


## Fulfillment flow

```ts
// supabase/functions/lazada-fulfill-order/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { decryptJson } from "../../../packages/integrations/crypto.ts";
import { LazadaClient } from "../../../packages/integrations/lazada/client.ts";

serve(async (req) => {
  const { jobId, orderId, trackingNumber, carrier } = await req.json();
  const job = await getJob(jobId);
  const account = await getAccount(job.marketplace_account_id);
  const creds = await getActiveCreds(account.id);
  const token = decryptJson<any>(creds.encrypted_payload, Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!);

  const client = new LazadaClient({
    appKey: Deno.env.get("LAZADA_APP_KEY")!,
    appSecret: Deno.env.get("LAZADA_APP_SECRET")!,
    baseUrl: Deno.env.get("LAZADA_BASE_URL")!,
    accessToken: token.access_token,
    region: account.region,
    country: account.metadata?.country
  });

  const result = await client.fulfillOrder({
    order_id: orderId,
    tracking_number: trackingNumber,
    shipping_provider: carrier
  });

  await markFulfillmentShipped(orderId, trackingNumber, carrier);
  return Response.json({ ok: true, result });
});
```


## Webhook handler

Lazada documents push/webhook mechanisms for order status, product QC, product create/edit/delete, low stock, auth alerts, reverse-order status, and category-tree updates.[^9][^3][^4]

```ts
// supabase/functions/lazada-webhook/index.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  const raw = await req.text();
  const payload = JSON.parse(raw);
  const eventType = payload.notify_type ?? payload.type ?? "unknown";
  const eventKey = payload.notification_id ?? payload.msg_id ?? crypto.randomUUID();

  const stored = await insertDedupIfNew({
    provider: "lazada",
    eventKey,
    eventType,
    rawPayload: payload
  });

  if (!stored) return new Response("duplicate", { status: 200 });

  await enqueueLazadaEvent(payload);
  return new Response("ok", { status: 200 });
});
```


## Event routing

```ts
// packages/integrations/lazada/events.ts
export function routeLazadaEvent(event: any) {
  switch (event.notify_type) {
    case "Order Status Change":
      return { jobType: "sync_orders", payload: { reason: "order_status_change" } };
    case "Product creation notification":
    case "Product edit notification":
    case "Product delete notification":
    case "Product QC status change":
      return { jobType: "sync_products", payload: { reason: event.notify_type } };
    case "Low stock notification":
      return { jobType: "sync_inventory", payload: { reason: "low_stock" } };
    case "Auth alert Notification":
      return { jobType: "refresh_credentials", payload: { reason: "auth_expiring" } };
    case "Reverse order status":
      return { jobType: "sync_orders", payload: { reason: "reverse_order" } };
    case "Category Tree notification":
      return { jobType: "sync_diagnostics", payload: { reason: "category_tree_updated" } };
    default:
      return { jobType: "sync_diagnostics", payload: { reason: "unhandled_event" } };
  }
}
```


## Dashboard screens

Build these pages:

### Lazada account page

Show:

- Region.
- Site code.
- Token expiry.
- Last sync time.
- Webhook health.
- Authorization expiry warnings.


### Lazada product page

Show:

- Category mapping.
- QC status.
- Publish errors.
- Reupload actions.


### Lazada order page

Show:

- Order status.
- Reverse-order status.
- Fulfillment actions.
- Shipment tracking.


### Lazada webhook inbox

Show:

- Event type.
- Raw payload.
- Dedup status.
- Processing result.
- Replay action.


### Lazada diagnostics page

Show:

- Category tree changes.
- Low stock notifications.
- Auth alert notifications.
- Recent failures.


## Environment variables

```env
LAZADA_APP_KEY=
LAZADA_APP_SECRET=
LAZADA_BASE_URL=https://api.lazada.com/rest
APP_ENCRYPTION_KEY_BASE64=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
APP_URL=
```


## File structure

```txt
packages/
  integrations/
    lazada/
      client.ts
      signature.ts
      mapProduct.ts
      mapOrder.ts
      events.ts
      types.ts
      errors.ts
apps/
  merchant-dashboard/
    app/(protected)/integrations/lazada/
      page.tsx
      connect/page.tsx
      [accountId]/page.tsx
      validator/page.tsx
      webhooks/page.tsx
supabase/
  functions/
    lazada-start/
    lazada-callback/
    lazada-sync-products/
    lazada-sync-orders/
    lazada-fulfill-order/
    lazada-webhook/
```


## Implementation sequence

1. Create Lazada tables and RLS.
2. Add auth start and callback functions.
3. Encrypt and store credentials.
4. Implement signing and client.
5. Implement product validator.
6. Implement product sync.
7. Implement order sync.
8. Implement fulfillment push.
9. Implement webhook receiver and routing.
10. Build dashboard pages.
11. Add diagnostics and auth-expiry handling.
12. Add tests, replay, and reconciliation.

## Definition of done

Lazada is ready when:

- A merchant can connect a Lazada account.
- The code exchange completes in the callback.
- Products can be validated and published.
- Orders can be imported and updated.
- Shipment info can be pushed.
- Webhooks are deduplicated and replayable.
- Region/site behavior is explicit in the UI.

I can continue next with **Google Merchant**, or I can turn Lazada into a **copy-paste code bundle** with exact migrations, Edge Functions, and Next.js pages.
<span style="display:none">[^10][^11][^12][^13][^14][^15]</span>

<div align="center">⁂</div>

[^1]: https://open.lazada.com/apps/doc/doc?nodeId=10777\&docId=108260

[^2]: https://open.lazada.com/apps/doc/doc?nodeId=10434\&docId=108056

[^3]: https://open.lazada.com/apps/doc/doc?nodeId=29537\&docId=120211

[^4]: https://developer.alibaba.com/docs/doc.htm?treeId=499\&articleId=120248\&docType=1

[^5]: https://open.lazada.com/apps/doc/api

[^6]: https://open.alitrip.com/docs/doc.htm?treeId=499\&articleId=118115\&docType=1

[^7]: https://open.fliggy.com/docs/doc.htm?treeId=499\&articleId=120167\&docType=1

[^8]: https://open.alitrip.com/docs/doc.htm?treeId=499\&articleId=120248\&docType=1

[^9]: https://github.com/laraditz/lazada/blob/master/README.md

[^10]: https://open.lazada.com

[^11]: https://open.alitrip.com/docs/doc.htm?treeId=499\&articleId=108260\&docType=1

[^12]: https://www.youtube.com/watch?v=mbMqFjjBkRI

[^13]: https://publicapi.dev/lazada-api

[^14]: https://github.com/laraditz/lazada

[^15]: https://open.lazada.com/apps/doc/doc?nodeId=38138\&docId=121098

