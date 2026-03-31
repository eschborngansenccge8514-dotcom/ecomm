<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# I need you to write a very detailed guide with code that are ready to use for shopee

Absolutely — I’ll give you a **ready-to-use Shopee integration guide** tailored to your stack: Next.js 16, Supabase, PostgreSQL, and Edge Functions. Shopee’s Open Platform uses HMAC-SHA256 signing for API calls, a dedicated authorization process, and push mechanisms for callbacks/webhooks, so the implementation should center on signed server-side requests, token storage, webhook ingestion, and job-based sync rather than client-side API calls.[^1][^2][^3][^4]

## What you will build

You will build a Shopee connector with these capabilities:

- Connect a merchant’s Shopee shop to a tenant.
- Store Shopee credentials securely in Supabase.
- Sync products from your canonical catalog to Shopee.
- Pull and normalize Shopee orders into your internal order tables.
- Push inventory updates.
- Receive and process Shopee push notifications.
- Retry and replay failed sync operations safely.

The implementation below assumes Shopee is the **source of external truth** for orders and shipment status, while your internal catalog remains the source of truth for product data.

## Shopee architecture

Use this pipeline:

1. Merchant clicks “Connect Shopee” in the dashboard.
2. Next.js redirects to your Shopee auth flow.
3. Shopee callback lands in a Supabase Edge Function.
4. Edge Function exchanges auth data for shop credentials.
5. Credentials are encrypted and stored in `marketplace_credentials`.
6. A bootstrap job is created in `marketplace_sync_jobs`.
7. Worker jobs call Shopee APIs using signed requests.
8. Webhooks/push events are deduplicated and normalized.
9. UI displays sync state, errors, and replay actions.

This keeps all Shopee logic on the backend and avoids exposing partner keys or access tokens to the browser.

## Shopee data model

Create these tables or extend your Phase 1 schema.

### `marketplace_accounts`

Stores one connected Shopee shop per tenant.

```sql
create table if not exists marketplace_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider text not null,
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

Store encrypted Shopee secrets here.

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


### `marketplace_product_mappings`

Maps internal products to Shopee listings.

```sql
create table if not exists marketplace_product_mappings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  marketplace_account_id uuid not null references marketplace_accounts(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  external_product_id text not null,
  external_variant_id text,
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


### `marketplace_order_mappings`

Maps Shopee orders to internal orders.

```sql
create table if not exists marketplace_order_mappings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  marketplace_account_id uuid not null references marketplace_accounts(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  external_order_id text not null,
  external_status text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, marketplace_account_id, external_order_id),
  unique (tenant_id, marketplace_account_id, order_id)
);
```


### `marketplace_events`

Stores raw Shopee push notifications.

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

Queue all Shopee sync work here.

```sql
create table if not exists marketplace_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  marketplace_account_id uuid not null references marketplace_accounts(id) on delete cascade,
  provider text not null,
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


## Shopee auth flow

Shopee auth is server-side only. According to Shopee Open Platform docs, signatures are based on HMAC-SHA256 and the required base string differs by endpoint type, so all auth and request signing must happen in Edge Functions.[^2][^1]

### Flow overview

1. User clicks **Connect Shopee**.
2. Frontend creates an `oauth_state` record.
3. Frontend redirects user to Shopee authorize URL.
4. Shopee redirects back to your callback URL.
5. Callback validates `state`.
6. Callback exchanges authorization info for access credentials.
7. Credentials are encrypted and saved.
8. A bootstrap sync job is queued.

### Auth route in Next.js

Create a page/action that starts the flow:

```ts
// apps/merchant-dashboard/app/(protected)/integrations/shopee/connect/page.tsx
import { redirect } from "next/navigation";

export default function ShopeeConnectPage() {
  async function connect() {
    "use server";
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/shopee/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    const { authorizationUrl } = await res.json();
    redirect(authorizationUrl);
  }

  return (
    <form action={connect}>
      <button type="submit">Connect Shopee</button>
    </form>
  );
}
```


### Start auth Edge Function

```ts
// supabase/functions/shopee-start/index.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  const body = await req.json();
  const tenantId = body.tenantId;

  const state = crypto.randomUUID();

  const { error } = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/oauth_states`, {
    method: "POST",
    headers: {
      apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      provider: "shopee",
      state,
      created_at: new Date().toISOString()
    })
  }).then(r => r.json());

  if (error) return new Response(JSON.stringify(error), { status: 500 });

  const partnerId = Deno.env.get("SHOPEE_PARTNER_ID")!;
  const redirectUri = encodeURIComponent(`${Deno.env.get("APP_URL")}/api/integrations/shopee/callback`);
  const authUrl = `https://partner.shopeemobile.com/api/v2/shop/auth_partner?partner_id=${partnerId}&state=${state}&redirect=${redirectUri}`;

  return Response.json({ authorizationUrl: authUrl });
});
```


## Shopee signature helper

Create one reusable signer that works for Shopee API requests.

```ts
// packages/integrations/shopee/signature.ts
import { createHmac } from "node:crypto";

export function signShopeeRequest(input: {
  partnerId: string;
  partnerKey: string;
  path: string;
  timestamp: number;
  accessToken?: string;
  shopId?: string;
}) {
  const { partnerId, partnerKey, path, timestamp, accessToken, shopId } = input;

  let baseString = `${partnerId}${path}${timestamp}`;
  if (accessToken) baseString += accessToken;
  if (shopId) baseString += shopId;

  const sign = createHmac("sha256", partnerKey).update(baseString).digest("hex");
  return sign;
}
```


### Example usage

```ts
const sign = signShopeeRequest({
  partnerId: process.env.SHOPEE_PARTNER_ID!,
  partnerKey: process.env.SHOPEE_PARTNER_KEY!,
  path: "/api/v2/shop/get_shop_info",
  timestamp: Math.floor(Date.now() / 1000),
  accessToken,
  shopId
});
```


## Shopee API client

Create a typed client that always signs requests server-side.

```ts
// packages/integrations/shopee/client.ts
import { signShopeeRequest } from "./signature";

export class ShopeeClient {
  constructor(
    private config: {
      partnerId: string;
      partnerKey: string;
      baseUrl: string;
      accessToken: string;
      shopId: string;
    }
  ) {}

  private buildUrl(path: string, params: Record<string, string | number>) {
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = signShopeeRequest({
      partnerId: this.config.partnerId,
      partnerKey: this.config.partnerKey,
      path,
      timestamp,
      accessToken: this.config.accessToken,
      shopId: this.config.shopId
    });

    const url = new URL(`${this.config.baseUrl}${path}`);
    url.searchParams.set("partner_id", this.config.partnerId);
    url.searchParams.set("timestamp", String(timestamp));
    url.searchParams.set("access_token", this.config.accessToken);
    url.searchParams.set("shop_id", this.config.shopId);
    url.searchParams.set("sign", sign);

    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    return url.toString();
  }

  async getShopInfo() {
    const url = this.buildUrl("/api/v2/shop/get_shop_info", {});
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  async listOrders(params: { timeFrom: number; timeTo: number; orderStatus?: string }) {
    const url = this.buildUrl("/api/v2/order/get_order_list", {
      time_from: params.timeFrom,
      time_to: params.timeTo,
      order_status: params.orderStatus ?? "READY_TO_SHIP"
    });
    const res = await fetch(url);
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  async getOrderDetail(orderSn: string) {
    const url = this.buildUrl("/api/v2/order/get_order_detail", {
      order_sn: orderSn
    });
    const res = await fetch(url);
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  async updateStock(input: { itemId: string; stock: number }) {
    const url = this.buildUrl("/api/v2/product/update_stock", {});
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_id: input.itemId,
        stock: input.stock
      })
    });
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  private async toError(res: Response) {
    const body = await res.text();
    return new Error(`Shopee API error ${res.status}: ${body}`);
  }
}
```


## Credential encryption

Never store raw tokens. Encrypt them before inserting into `marketplace_credentials`.

```ts
// packages/integrations/crypto.ts
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGO = "aes-256-gcm";

export function encryptJson(payload: unknown, keyBase64: string) {
  const key = Buffer.from(keyBase64, "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);

  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptJson<T>(encrypted: string, keyBase64: string): T {
  const key = Buffer.from(keyBase64, "base64");
  const raw = Buffer.from(encrypted, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}
```


## Shopee callback handler

Handle the callback in an Edge Function.

```ts
// supabase/functions/shopee-callback/index.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");

  if (!state || !code) {
    return new Response("Missing state or code", { status: 400 });
  }

  const stateRow = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/oauth_states?state=eq.${state}&provider=eq.shopee&select=*`, {
    headers: {
      apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`
    }
  }).then(r => r.json());

  if (!stateRow?.length) return new Response("Invalid state", { status: 400 });

  const partnerId = Deno.env.get("SHOPEE_PARTNER_ID")!;
  const partnerKey = Deno.env.get("SHOPEE_PARTNER_KEY")!;
  const path = "/api/v2/auth/token/get";
  const timestamp = Math.floor(Date.now() / 1000);

  const sign = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(partnerKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  ).then(async key => {
    const data = new TextEncoder().encode(`${partnerId}${path}${timestamp}`);
    const sig = await crypto.subtle.sign("HMAC", key, data);
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  });

  const tokenRes = await fetch(`https://partner.shopeemobile.com${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-PARTNER-ID": partnerId,
      "X-TIMESTAMP": String(timestamp),
      "X-SIGN": sign
    },
    body: JSON.stringify({ code })
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return new Response(err, { status: 500 });
  }

  const tokenData = await tokenRes.json();

  const encryptedPayload = await encryptJson(tokenData, Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!);

  await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/marketplace_credentials`, {
    method: "POST",
    headers: {
      apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      tenant_id: stateRow[^0].tenant_id,
      marketplace_account_id: stateRow[^0].marketplace_account_id,
      credential_type: "shopee_access_token",
      encrypted_payload: encryptedPayload,
      expires_at: tokenData.expire_in ? new Date(Date.now() + tokenData.expire_in * 1000).toISOString() : null
    })
  });

  return Response.redirect(`${Deno.env.get("APP_URL")}/integrations/shopee?connected=1`, 302);
});
```


## Product sync

Use one canonical product-to-Shopee transform.

```ts
// packages/integrations/shopee/mapProduct.ts
export function mapProductToShopee(product: any) {
  return {
    name: product.title,
    description: product.description,
    category_id: product.provider_meta?.shopee?.category_id,
    brand: product.brand,
    images: product.images.map((img: any) => img.url),
    items: product.variants.map((variant: any) => ({
      sku: variant.sku,
      price: variant.price,
      stock: variant.stock_on_hand,
      option_list: variant.options
    }))
  };
}
```


## Publish product job

```ts
// supabase/functions/shopee-sync-products/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { ShopeeClient } from "../../../packages/integrations/shopee/client.ts";
import { decryptJson } from "../../../packages/integrations/crypto.ts";

serve(async () => {
  const jobs = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/marketplace_sync_jobs?status=eq.queued&job_type=eq.sync_products&provider=eq.shopee&limit=10`, {
    headers: {
      apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`
    }
  }).then(r => r.json());

  for (const job of jobs) {
    try {
      await processJob(job);
    } catch (e) {
      await markJobFailed(job.id, String(e));
    }
  }

  return Response.json({ ok: true });
});

async function processJob(job: any) {
  const account = await getAccount(job.marketplace_account_id);
  const creds = await getActiveCreds(account.id);
  const token = decryptJson<any>(creds.encrypted_payload, Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!);

  const client = new ShopeeClient({
    partnerId: Deno.env.get("SHOPEE_PARTNER_ID")!,
    partnerKey: Deno.env.get("SHOPEE_PARTNER_KEY")!,
    baseUrl: Deno.env.get("SHOPEE_BASE_URL")!,
    accessToken: token.access_token,
    shopId: account.external_account_id
  });

  const product = await getProduct(job.payload.product_id);
  const payload = mapProductToShopee(product);

  const result = await client.createOrUpdateProduct(payload);

  await saveMapping(job.payload.product_id, result.item_id);
  await markJobSucceeded(job.id, result);
}
```

Add the missing client method:

```ts
async createOrUpdateProduct(payload: any) {
  const url = this.buildUrl("/api/v2/product/add_item", {});
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw await this.toError(res);
  return res.json();
}
```


## Order sync

Implement a pull job first, then supplement with push notifications.

```ts
// packages/integrations/shopee/mapOrder.ts
export function mapShopeeOrderToCanonical(raw: any) {
  return {
    external_order_id: raw.order_sn,
    status: raw.order_status,
    currency: raw.currency,
    total_amount: raw.total_amount,
    buyer_name: raw.buyer_username,
    items: raw.items.map((item: any) => ({
      external_item_id: item.item_id,
      sku: item.model_sku,
      quantity: item.model_quantity_purchased,
      price: item.model_discounted_price
    }))
  };
}
```

```ts
// supabase/functions/shopee-sync-orders/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { ShopeeClient } from "../../../packages/integrations/shopee/client.ts";
import { decryptJson } from "../../../packages/integrations/crypto.ts";
import { mapShopeeOrderToCanonical } from "../../../packages/integrations/shopee/mapOrder.ts";

serve(async () => {
  const jobs = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/marketplace_sync_jobs?status=eq.queued&job_type=eq.sync_orders&provider=eq.shopee&limit=10`, {
    headers: {
      apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`
    }
  }).then(r => r.json());

  for (const job of jobs) await processOrderJob(job);

  return Response.json({ ok: true });
});

async function processOrderJob(job: any) {
  const account = await getAccount(job.marketplace_account_id);
  const creds = await getActiveCreds(account.id);
  const token = decryptJson<any>(creds.encrypted_payload, Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!);

  const client = new ShopeeClient({
    partnerId: Deno.env.get("SHOPEE_PARTNER_ID")!,
    partnerKey: Deno.env.get("SHOPEE_PARTNER_KEY")!,
    baseUrl: Deno.env.get("SHOPEE_BASE_URL")!,
    accessToken: token.access_token,
    shopId: account.external_account_id
  });

  const list = await client.listOrders({
    timeFrom: job.payload.time_from,
    timeTo: job.payload.time_to,
    orderStatus: job.payload.order_status
  });

  for (const row of list.response.order_list || []) {
    const detail = await client.getOrderDetail(row.order_sn);
    const mapped = mapShopeeOrderToCanonical(detail.response);
    await upsertCanonicalOrder(job.tenant_id, mapped);
    await upsertOrderMapping(job.tenant_id, account.id, mapped.external_order_id);
  }

  await markJobSucceeded(job.id, list);
}
```


## Inventory sync

Inventory updates should be event-driven from your internal stock tables.

```ts
// packages/integrations/shopee/mapInventory.ts
export function mapInventoryUpdate(input: {
  externalItemId: string;
  stock: number;
}) {
  return {
    item_id: input.externalItemId,
    stock: input.stock
  };
}
```

```ts
// supabase/functions/shopee-sync-inventory/index.ts
async function pushInventory(job: any) {
  const account = await getAccount(job.marketplace_account_id);
  const creds = await getActiveCreds(account.id);
  const token = decryptJson<any>(creds.encrypted_payload, Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!);

  const client = new ShopeeClient({
    partnerId: Deno.env.get("SHOPEE_PARTNER_ID")!,
    partnerKey: Deno.env.get("SHOPEE_PARTNER_KEY")!,
    baseUrl: Deno.env.get("SHOPEE_BASE_URL")!,
    accessToken: token.access_token,
    shopId: account.external_account_id
  });

  const mappings = await getVariantMappings(job.payload.product_id);

  for (const mapping of mappings) {
    const stock = await getInternalStock(mapping.variant_id);
    const result = await client.updateStock({
      itemId: mapping.external_variant_id,
      stock
    });
    await logInventoryResult(mapping.id, result);
  }
}
```


## Push notifications / webhooks

Shopee provides push mechanism setup in the Open Platform console, where you register and verify a callback URL.[^3][^5]

### Webhook handler

```ts
// supabase/functions/shopee-webhook/index.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  const raw = await req.text();
  const signature = req.headers.get("x-signature") ?? "";
  const eventKey = req.headers.get("x-event-id") ?? crypto.randomUUID();

  const parsed = JSON.parse(raw);

  const dedup = await insertDedupIfNew({
    provider: "shopee",
    eventKey
  });

  if (!dedup) return new Response("duplicate", { status: 200 });

  await saveMarketplaceEvent({
    provider: "shopee",
    eventKey,
    eventType: parsed.event_type,
    rawPayload: parsed,
    signatureValid: true
  });

  await enqueueJobFromWebhook(parsed);

  return new Response("ok", { status: 200 });
});
```


### Dedup helper

```ts
async function insertDedupIfNew(input: { provider: string; eventKey: string }) {
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/marketplace_event_dedup`, {
    method: "POST",
    headers: {
      apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates"
    },
    body: JSON.stringify({
      provider: input.provider,
      event_key: input.eventKey
    })
  });
  return res.status === 201 || res.status === 200;
}
```


## Dashboard screens

Build these pages in Next.js:

### Integration list

Shows connected Shopee accounts, sync state, and last run.

### Connection detail

Shows:

- Shop ID.
- Region.
- Credential expiry.
- Recent jobs.
- Recent events.
- Error count.


### Product mapping screen

Lets merchants:

- Search products.
- See Shopee mapping status.
- Remap external listing IDs.
- Trigger publish/republish.


### Order sync screen

Shows:

- Imported orders.
- External order IDs.
- Sync source.
- Fulfillment status.
- Retry actions.


### Event inbox

Shows:

- Raw webhook payloads.
- Dedup status.
- Parsing result.
- Replay button.


## Useful environment variables

```env
SHOPEE_PARTNER_ID=
SHOPEE_PARTNER_KEY=
SHOPEE_BASE_URL=https://partner.shopeemobile.com
SHOPEE_WEBHOOK_SECRET=
APP_ENCRYPTION_KEY_BASE64=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
APP_URL=
```


## Recommended file structure

```txt
packages/
  integrations/
    shopee/
      client.ts
      signature.ts
      mapProduct.ts
      mapOrder.ts
      mapInventory.ts
      types.ts
      errors.ts
      webhook.ts
apps/
  merchant-dashboard/
    app/(protected)/integrations/shopee/
      page.tsx
      connect/page.tsx
      callback/page.tsx
      [accountId]/page.tsx
supabase/
  functions/
    shopee-start/
    shopee-callback/
    shopee-sync-products/
    shopee-sync-orders/
    shopee-sync-inventory/
    shopee-webhook/
```


## Practical implementation sequence

1. Create the Shopee tables and RLS policies.
2. Add encryption helpers.
3. Add Shopee signer and API client.
4. Implement connect/start callback flow.
5. Store credentials securely.
6. Implement product publish job.
7. Implement order sync job.
8. Implement inventory sync job.
9. Implement webhook receiver and dedup.
10. Build dashboard screens.
11. Add retries, dead-letter handling, and reconciliation.
12. Test end to end with a Shopee sandbox account.

## Important caveats

Shopee API paths, required signatures, and token exchange details vary by endpoint category, so you should always match the exact endpoint documentation when implementing a specific call. The pattern above is the correct architectural shape, but you should wire each request against the endpoint’s required signature base string and parameters exactly as Shopee specifies.[^1][^2]

I can continue by writing the **full Shopee-specific codebase scaffold** next, including:

- exact Postgres migrations,
- full Edge Functions,
- typed TypeScript interfaces,
- Next.js pages,
- and production-ready retry/reconciliation logic.
<span style="display:none">[^10][^11][^12][^13][^14][^15][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://open.shopee.com/developer-guide/20

[^2]: https://open.shopee.com/developer-guide/16

[^3]: https://open.shopee.com/developer-guide/18

[^4]: https://open.shopee.com

[^5]: https://github.com/congminh1254/shopee-sdk/blob/main/docs/managers/push.md

[^6]: https://stackoverflow.com/questions/64328380/how-to-generate-signature-in-shopee-2-0-api-request-authentication

[^7]: https://github.com/congminh1254/shopee-sdk/blob/main/docs/guides/authentication.md

[^8]: https://community.zapier.com/general-discussion-13/shopee-integration-return-field-named-access-token-not-found-in-oauth2-results-18956

[^9]: https://publicapi.dev/shopee-api

[^10]: https://www.scribd.com/document/807484756/api-call-shopee

[^11]: https://api2cart.com/news/shopee-api-documentation/

[^12]: https://api2cart.com/api-technology/shopee-api/

[^13]: https://github.com/douglara/shopee-api/blob/main/README.md

[^14]: https://www.postman.com/tmapitop/tmapi-e-commerce-apis/documentation/fljsvdh/shopee-api

[^15]: https://qxguide.oopy.io/a9e02433-98c3-48bd-ae7b-e645de5987c6

