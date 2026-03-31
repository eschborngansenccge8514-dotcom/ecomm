<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Continue

Here are both: the **complete ordered Postgres migration pack** for all four platforms, followed by the **production-ready shared job runner** and all supporting shared utilities. Shared utilities between Edge Functions should live in `supabase/functions/_shared` and be imported via relative paths — this is the recommended Supabase pattern.[^1]

***

# Part 1 — Complete Postgres Migration Pack

Run these migrations in the exact order shown. Each file is numbered and idempotent.

***

## Migration 001 — Extensions

```sql
-- supabase/migrations/20260330_001_extensions.sql

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";
create extension if not exists "pg_net";
```


***

## Migration 002 — Enums

```sql
-- supabase/migrations/20260330_002_enums.sql

create type marketplace_provider as enum (
  'shopee',
  'tiktok',
  'lazada',
  'google_merchant'
);

create type account_status as enum (
  'pending',
  'connected',
  'disconnected',
  'expired',
  'error'
);

create type sync_job_status as enum (
  'queued',
  'processing',
  'succeeded',
  'failed',
  'dead'
);

create type sync_job_type as enum (
  'connect_account',
  'refresh_credentials',
  'validate_catalog',
  'sync_products',
  'sync_orders',
  'sync_inventory',
  'sync_fulfillment',
  'sync_diagnostics',
  'update_availability',
  'delete_product',
  'reconcile_state',
  'replay_event',
  'deauthorize_account'
);

create type event_processing_status as enum (
  'received',
  'processing',
  'succeeded',
  'failed',
  'duplicate'
);

create type product_mapping_status as enum (
  'pending',
  'mapped',
  'published',
  'failed',
  'needs_attention',
  'deleted'
);

create type order_status as enum (
  'pending',
  'paid',
  'processing',
  'ready_to_ship',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
  'returned',
  'failed'
);

create type diagnostic_severity as enum (
  'critical',
  'error',
  'warning',
  'suggestion'
);

create type diagnostic_scope as enum (
  'account',
  'product'
);
```


***

## Migration 003 — Tenancy and access

```sql
-- supabase/migrations/20260330_003_tenancy.sql

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active',
  billing_status text not null default 'trial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  invited_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists oauth_states (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider text not null,
  state text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default now() + interval '15 minutes',
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_oauth_states_state on oauth_states(state);
create index if not exists idx_oauth_states_tenant on oauth_states(tenant_id);
```


***

## Migration 004 — Core commerce

```sql
-- supabase/migrations/20260330_004_commerce.sql

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  sku text not null,
  title text not null,
  description text,
  brand text,
  gtin text,
  mpn text,
  slug text,
  price numeric(12, 4) not null default 0,
  currency text not null default 'MYR',
  stock_on_hand int not null default 0,
  status text not null default 'draft',
  images jsonb not null default '[]'::jsonb,
  variants jsonb not null default '[]'::jsonb,
  provider_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, sku)
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  order_number text,
  status order_status not null default 'pending',
  currency text not null default 'MYR',
  subtotal numeric(12, 4) not null default 0,
  shipping_fee numeric(12, 4) not null default 0,
  platform_fee numeric(12, 4) not null default 0,
  tax numeric(12, 4) not null default 0,
  discount numeric(12, 4) not null default 0,
  total_amount numeric(12, 4) not null default 0,
  buyer_name text,
  buyer_email text,
  shipping_address jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id),
  sku text not null,
  title text not null,
  quantity int not null default 1,
  unit_price numeric(12, 4) not null default 0,
  total_price numeric(12, 4) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists order_status_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  from_status order_status,
  to_status order_status not null,
  reason text,
  source text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists fulfillments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  carrier text,
  tracking_number text,
  status text not null default 'pending',
  shipped_at timestamptz,
  delivered_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_tenant on products(tenant_id);
create index if not exists idx_orders_tenant on orders(tenant_id);
create index if not exists idx_order_items_order on order_items(order_id);
create index if not exists idx_fulfillments_order on fulfillments(order_id);
```


***

## Migration 005 — Marketplace accounts and credentials

```sql
-- supabase/migrations/20260330_005_marketplace_accounts.sql

create table if not exists marketplace_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider marketplace_provider not null,
  external_account_id text not null,
  display_name text,
  region text not null default 'global',
  site_code text,
  status account_status not null default 'connected',
  last_successful_sync_at timestamptz,
  last_health_check_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider, external_account_id)
);

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

create table if not exists marketplace_webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  marketplace_account_id uuid not null references marketplace_accounts(id) on delete cascade,
  event_type text not null,
  address text not null,
  status text not null default 'active',
  last_verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, marketplace_account_id, event_type)
);

create index if not exists idx_marketplace_accounts_tenant on marketplace_accounts(tenant_id);
create index if not exists idx_marketplace_accounts_provider on marketplace_accounts(provider);
create index if not exists idx_marketplace_credentials_account on marketplace_credentials(marketplace_account_id);
create index if not exists idx_marketplace_credentials_active on marketplace_credentials(marketplace_account_id, is_active);
```


***

## Migration 006 — Product and order mappings

```sql
-- supabase/migrations/20260330_006_mappings.sql

create table if not exists marketplace_product_mappings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  marketplace_account_id uuid not null references marketplace_accounts(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  external_product_id text not null,
  data_source_id text,
  status product_mapping_status not null default 'mapped',
  remote_state_hash text,
  local_state_hash text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, marketplace_account_id, product_id),
  unique (tenant_id, marketplace_account_id, external_product_id)
);

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

create index if not exists idx_product_mappings_tenant_account on marketplace_product_mappings(tenant_id, marketplace_account_id);
create index if not exists idx_product_mappings_product on marketplace_product_mappings(product_id);
create index if not exists idx_order_mappings_tenant_account on marketplace_order_mappings(tenant_id, marketplace_account_id);
create index if not exists idx_order_mappings_order on marketplace_order_mappings(order_id);
```


***

## Migration 007 — Sync job queue

```sql
-- supabase/migrations/20260330_007_sync_jobs.sql

create table if not exists marketplace_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  marketplace_account_id uuid not null references marketplace_accounts(id) on delete cascade,
  provider marketplace_provider not null,
  job_type sync_job_type not null,
  payload jsonb not null default '{}'::jsonb,
  status sync_job_status not null default 'queued',
  priority int not null default 5,
  attempt_count int not null default 0,
  max_attempts int not null default 5,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  next_retry_at timestamptz,
  lock_token text,
  locked_at timestamptz,
  last_error_code text,
  last_error_message text,
  last_error_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sync_jobs_pickup
  on marketplace_sync_jobs(status, scheduled_at, priority)
  where status = 'queued';

create index if not exists idx_sync_jobs_tenant_provider
  on marketplace_sync_jobs(tenant_id, provider, status);

create index if not exists idx_sync_jobs_account
  on marketplace_sync_jobs(marketplace_account_id, status);
```


***

## Migration 008 — Webhook events and dedup

```sql
-- supabase/migrations/20260330_008_events.sql

create table if not exists marketplace_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete set null,
  marketplace_account_id uuid references marketplace_accounts(id) on delete set null,
  provider marketplace_provider not null,
  event_key text not null,
  event_type text not null,
  raw_payload jsonb not null,
  parsed_payload jsonb not null default '{}'::jsonb,
  signature_valid boolean,
  processing_status event_processing_status not null default 'received',
  correlation_id text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text,
  unique (provider, event_key)
);

create table if not exists marketplace_event_dedup (
  provider text not null,
  event_key text not null,
  created_at timestamptz not null default now(),
  primary key (provider, event_key)
);

create index if not exists idx_marketplace_events_provider_type
  on marketplace_events(provider, event_type, received_at desc);

create index if not exists idx_marketplace_events_tenant
  on marketplace_events(tenant_id, received_at desc);
```


***

## Migration 009 — Error logs

```sql
-- supabase/migrations/20260330_009_error_logs.sql

create table if not exists marketplace_error_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete set null,
  marketplace_account_id uuid references marketplace_accounts(id) on delete set null,
  provider marketplace_provider,
  job_id uuid references marketplace_sync_jobs(id) on delete set null,
  event_id uuid references marketplace_events(id) on delete set null,
  error_code text,
  error_message text not null,
  error_payload jsonb,
  severity diagnostic_severity not null default 'error',
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_error_logs_tenant
  on marketplace_error_logs(tenant_id, created_at desc);

create index if not exists idx_error_logs_unresolved
  on marketplace_error_logs(tenant_id, provider)
  where resolved_at is null;
```


***

## Migration 010 — Google Merchant specific tables

```sql
-- supabase/migrations/20260330_010_google_merchant.sql

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

create table if not exists google_merchant_diagnostics (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  marketplace_account_id uuid not null references marketplace_accounts(id) on delete cascade,
  scope diagnostic_scope not null,
  external_product_id text,
  issue_code text not null,
  title text not null,
  description text,
  severity diagnostic_severity not null,
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
  unique (tenant_id, marketplace_account_id, scope, coalesce(external_product_id, ''), issue_code, coalesce(country, ''))
);

create index if not exists idx_gmc_diagnostics_unresolved
  on google_merchant_diagnostics(tenant_id, marketplace_account_id)
  where resolved_at is null;
```


***

## Migration 011 — RLS enablement and helper functions

```sql
-- supabase/migrations/20260330_011_rls.sql

-- Helper functions
create or replace function current_user_id()
returns uuid language sql stable
as $ select auth.uid() $;

create or replace function current_tenant_id()
returns uuid language plpgsql stable
as $$
declare
  tid uuid;
begin
  select tm.tenant_id into tid
  from tenant_memberships tm
  where tm.user_id = auth.uid()
    and tm.accepted_at is not null
  order by tm.created_at
  limit 1;
  return tid;
exception when others then return null;
end;
$$;

create or replace function user_has_tenant_access(p_tenant_id uuid)
returns boolean language sql stable
as $$
  select exists (
    select 1 from tenant_memberships
    where user_id = auth.uid()
      and tenant_id = p_tenant_id
      and accepted_at is not null
  )
$$;

create or replace function user_has_role(p_tenant_id uuid, p_role text)
returns boolean language sql stable
as $$
  select exists (
    select 1 from tenant_memberships
    where user_id = auth.uid()
      and tenant_id = p_tenant_id
      and role = p_role
      and accepted_at is not null
  )
$$;

-- Enable RLS
alter table tenants enable row level security;
alter table tenant_memberships enable row level security;
alter table oauth_states enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_status_history enable row level security;
alter table fulfillments enable row level security;
alter table marketplace_accounts enable row level security;
alter table marketplace_credentials enable row level security;
alter table marketplace_webhook_subscriptions enable row level security;
alter table marketplace_product_mappings enable row level security;
alter table marketplace_order_mappings enable row level security;
alter table marketplace_sync_jobs enable row level security;
alter table marketplace_events enable row level security;
alter table marketplace_event_dedup enable row level security;
alter table marketplace_error_logs enable row level security;
alter table google_merchant_data_sources enable row level security;
alter table google_merchant_diagnostics enable row level security;

-- Tenants
create policy "tenants_select" on tenants for select
  using (user_has_tenant_access(id));

-- Memberships
create policy "memberships_select" on tenant_memberships for select
  using (user_has_tenant_access(tenant_id));

-- Products
create policy "products_select" on products for select
  using (user_has_tenant_access(tenant_id));
create policy "products_insert" on products for insert
  with check (user_has_tenant_access(tenant_id));
create policy "products_update" on products for update
  using (user_has_tenant_access(tenant_id));
create policy "products_delete" on products for delete
  using (user_has_role(tenant_id, 'admin'));

-- Orders
create policy "orders_select" on orders for select
  using (user_has_tenant_access(tenant_id));
create policy "orders_insert" on orders for insert
  with check (user_has_tenant_access(tenant_id));
create policy "orders_update" on orders for update
  using (user_has_tenant_access(tenant_id));

-- Order items
create policy "order_items_select" on order_items for select
  using (user_has_tenant_access(tenant_id));

-- Fulfillments
create policy "fulfillments_select" on fulfillments for select
  using (user_has_tenant_access(tenant_id));

-- Marketplace accounts
create policy "marketplace_accounts_select" on marketplace_accounts for select
  using (user_has_tenant_access(tenant_id));
create policy "marketplace_accounts_insert" on marketplace_accounts for insert
  with check (user_has_tenant_access(tenant_id));
create policy "marketplace_accounts_update" on marketplace_accounts for update
  using (user_has_tenant_access(tenant_id));
create policy "marketplace_accounts_delete" on marketplace_accounts for delete
  using (user_has_role(tenant_id, 'admin'));

-- Credentials are never readable by client — service role only
create policy "marketplace_credentials_none" on marketplace_credentials
  using (false);

-- Product mappings
create policy "product_mappings_select" on marketplace_product_mappings for select
  using (user_has_tenant_access(tenant_id));

-- Order mappings
create policy "order_mappings_select" on marketplace_order_mappings for select
  using (user_has_tenant_access(tenant_id));

-- Sync jobs
create policy "sync_jobs_select" on marketplace_sync_jobs for select
  using (user_has_tenant_access(tenant_id));

-- Events
create policy "events_select" on marketplace_events for select
  using (user_has_tenant_access(tenant_id));

-- Error logs
create policy "error_logs_select" on marketplace_error_logs for select
  using (user_has_tenant_access(tenant_id));

-- GMC diagnostics
create policy "gmc_diagnostics_select" on google_merchant_diagnostics for select
  using (user_has_tenant_access(tenant_id));

-- GMC data sources
create policy "gmc_data_sources_select" on google_merchant_data_sources for select
  using (user_has_tenant_access(tenant_id));
```


***

## Migration 012 — pg_cron schedules

```sql
-- supabase/migrations/20260330_012_cron.sql

-- Store secrets in Vault first
select vault.create_secret(
  'https://<your-ref>.supabase.co',
  'supabase_project_url'
);
select vault.create_secret(
  '<your-service-role-key>',
  'supabase_service_role_key'
);

-- Shopee: pull orders every 5 minutes
select cron.schedule(
  'shopee-sync-orders',
  '*/5 * * * *',
  $$select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_project_url') || '/functions/v1/job-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_service_role_key')
    ),
    body := '{"provider":"shopee","job_type":"sync_orders"}'::jsonb
  )$$
);

-- TikTok: pull orders every 5 minutes
select cron.schedule(
  'tiktok-sync-orders',
  '*/5 * * * *',
  $$select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_project_url') || '/functions/v1/job-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_service_role_key')
    ),
    body := '{"provider":"tiktok","job_type":"sync_orders"}'::jsonb
  )$$
);

-- Lazada: pull orders every 5 minutes
select cron.schedule(
  'lazada-sync-orders',
  '*/5 * * * *',
  $$select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_project_url') || '/functions/v1/job-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_service_role_key')
    ),
    body := '{"provider":"lazada","job_type":"sync_orders"}'::jsonb
  )$$
);

-- Google Merchant: sync products every 30 minutes
select cron.schedule(
  'google-merchant-sync-products',
  '*/30 * * * *',
  $$select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_project_url') || '/functions/v1/job-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_service_role_key')
    ),
    body := '{"provider":"google_merchant","job_type":"sync_products"}'::jsonb
  )$$
);

-- Google Merchant: sync diagnostics every 6 hours
select cron.schedule(
  'google-merchant-sync-diagnostics',
  '0 */6 * * *',
  $$select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_project_url') || '/functions/v1/job-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_service_role_key')
    ),
    body := '{"provider":"google_merchant","job_type":"sync_diagnostics"}'::jsonb
  )$$
);

-- Dead-letter sweep: every hour
select cron.schedule(
  'dead-letter-sweep',
  '0 * * * *',
  $$select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_project_url') || '/functions/v1/job-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_service_role_key')
    ),
    body := '{"action":"sweep_dead_letters"}'::jsonb
  )$$
);
```


***

# Part 2 — Shared Utilities

All shared code lives in `supabase/functions/_shared` so every Edge Function can import it without duplication.[^1]

***

## Shared: Supabase admin client

```ts
// supabase/functions/_shared/supabase.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function getAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
}
```


***

## Shared: Encryption utilities

```ts
// supabase/functions/_shared/crypto.ts

export async function encryptJson(payload: unknown, keyBase64: string): Promise<string> {
  const key = await importKey(keyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(payload));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  const combined = new Uint8Array(iv.byteLength + cipherBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuffer), iv.byteLength);

  return btoa(String.fromCharCode(...combined));
}

export async function decryptJson<T>(encrypted: string, keyBase64: string): Promise<T> {
  const key = await importKey(keyBase64);
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return JSON.parse(new TextDecoder().decode(plainBuffer)) as T;
}

async function importKey(keyBase64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
```


***

## Shared: Credential loader

```ts
// supabase/functions/_shared/credentials.ts
import { getAdminClient } from "./supabase.ts";
import { decryptJson } from "./crypto.ts";

export interface DecodedCredential {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  [key: string]: unknown;
}

export async function loadActiveCredential(
  accountId: string
): Promise<{ credId: string; token: DecodedCredential; expiresAt: Date | null }> {
  const supabase = getAdminClient();

  const { data: cred, error } = await supabase
    .from("marketplace_credentials")
    .select("*")
    .eq("marketplace_account_id", accountId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !cred) throw new Error(`No active credential found for account ${accountId}`);

  const token = await decryptJson<DecodedCredential>(
    cred.encrypted_payload,
    Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!
  );

  return {
    credId: cred.id,
    token,
    expiresAt: cred.expires_at ? new Date(cred.expires_at) : null
  };
}

export async function updateCredential(
  credId: string,
  token: DecodedCredential,
  expiresIn: number
): Promise<void> {
  const supabase = getAdminClient();
  const { encryptJson } = await import("./crypto.ts");

  const encrypted = await encryptJson(token, Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!);

  await supabase.from("marketplace_credentials").update({
    encrypted_payload: encrypted,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    updated_at: new Date().toISOString()
  }).eq("id", credId);
}
```


***

## Shared: Job queue helpers

```ts
// supabase/functions/_shared/jobs.ts
import { getAdminClient } from "./supabase.ts";

const BATCH_SIZE = 10;
const LOCK_TTL_MINUTES = 5;

export async function claimJobs(provider: string, jobType: string): Promise<any[]> {
  const supabase = getAdminClient();
  const lockToken = crypto.randomUUID();
  const now = new Date().toISOString();
  const lockExpiry = new Date(Date.now() - LOCK_TTL_MINUTES * 60 * 1000).toISOString();

  // Claim jobs atomically — pick queued jobs or stale locked jobs
  const { data: jobs } = await supabase
    .from("marketplace_sync_jobs")
    .select("*")
    .eq("provider", provider)
    .eq("job_type", jobType)
    .in("status", ["queued"])
    .or(`locked_at.is.null,locked_at.lt.${lockExpiry}`)
    .lte("scheduled_at", now)
    .order("priority", { ascending: true })
    .order("scheduled_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (!jobs?.length) return [];

  const ids = jobs.map(j => j.id);
  await supabase
    .from("marketplace_sync_jobs")
    .update({
      status: "processing",
      lock_token: lockToken,
      locked_at: now,
      started_at: now,
      attempt_count: supabase.rpc("increment_attempt", {}),
      updated_at: now
    })
    .in("id", ids);

  return jobs;
}

export async function markSucceeded(jobId: string, resultPayload?: unknown): Promise<void> {
  const supabase = getAdminClient();
  await supabase.from("marketplace_sync_jobs").update({
    status: "succeeded",
    lock_token: null,
    locked_at: null,
    finished_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq("id", jobId);
}

export async function markFailed(
  jobId: string,
  errorMessage: string,
  errorCode?: string,
  errorPayload?: unknown
): Promise<void> {
  const supabase = getAdminClient();

  const { data: job } = await supabase
    .from("marketplace_sync_jobs")
    .select("attempt_count, max_attempts")
    .eq("id", jobId)
    .single();

  const isDead = job && job.attempt_count >= job.max_attempts;
  const backoffMs = computeBackoff(job?.attempt_count ?? 1);

  await supabase.from("marketplace_sync_jobs").update({
    status: isDead ? "dead" : "queued",
    lock_token: null,
    locked_at: null,
    finished_at: new Date().toISOString(),
    next_retry_at: isDead ? null : new Date(Date.now() + backoffMs).toISOString(),
    scheduled_at: isDead ? undefined : new Date(Date.now() + backoffMs).toISOString(),
    last_error_message: errorMessage,
    last_error_code: errorCode ?? null,
    last_error_payload: errorPayload ? JSON.stringify(errorPayload) : null,
    updated_at: new Date().toISOString()
  }).eq("id", jobId);

  // Log error
  if (job) {
    await supabase.from("marketplace_error_logs").insert({
      job_id: jobId,
      error_message: errorMessage,
      error_code: errorCode ?? null,
      error_payload: errorPayload ?? null,
      severity: isDead ? "critical" : "error"
    });
  }
}

export async function enqueueJob(input: {
  tenantId: string;
  accountId: string;
  provider: string;
  jobType: string;
  payload?: Record<string, unknown>;
  priority?: number;
  scheduledAt?: Date;
}): Promise<void> {
  const supabase = getAdminClient();
  await supabase.from("marketplace_sync_jobs").insert({
    tenant_id: input.tenantId,
    marketplace_account_id: input.accountId,
    provider: input.provider,
    job_type: input.jobType,
    payload: input.payload ?? {},
    priority: input.priority ?? 5,
    scheduled_at: (input.scheduledAt ?? new Date()).toISOString()
  });
}

function computeBackoff(attempt: number): number {
  const base = 30_000; // 30 seconds
  const jitter = Math.random() * 10_000;
  return Math.min(base * Math.pow(2, attempt - 1) + jitter, 3_600_000); // cap at 1 hour
}
```


***

## Shared: Webhook dedup

```ts
// supabase/functions/_shared/dedup.ts
import { getAdminClient } from "./supabase.ts";

export async function insertDedupIfNew(input: {
  provider: string;
  eventKey: string;
}): Promise<boolean> {
  const supabase = getAdminClient();

  const { error } = await supabase
    .from("marketplace_event_dedup")
    .insert({ provider: input.provider, event_key: input.eventKey });

  // Unique violation means duplicate
  if (error?.code === "23505") return false;
  if (error) throw error;
  return true;
}
```


***

## Shared: Error logger

```ts
// supabase/functions/_shared/logger.ts
import { getAdminClient } from "./supabase.ts";

export async function logError(input: {
  tenantId?: string;
  accountId?: string;
  provider?: string;
  jobId?: string;
  eventId?: string;
  errorCode?: string;
  errorMessage: string;
  errorPayload?: unknown;
  severity?: "critical" | "error" | "warning";
}): Promise<void> {
  const supabase = getAdminClient();
  await supabase.from("marketplace_error_logs").insert({
    tenant_id: input.tenantId ?? null,
    marketplace_account_id: input.accountId ?? null,
    provider: input.provider ?? null,
    job_id: input.jobId ?? null,
    event_id: input.eventId ?? null,
    error_code: input.errorCode ?? null,
    error_message: input.errorMessage,
    error_payload: input.errorPayload ?? null,
    severity: input.severity ?? "error"
  });
}
```


***

# Part 3 — The Central Job Runner

A single `job-runner` Edge Function receives the pg_cron trigger and dispatches to the correct provider handler. This is the only function that cron needs to call.[^2][^3]

```ts
// supabase/functions/job-runner/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { claimJobs, markSucceeded, markFailed } from "../_shared/jobs.ts";
import { logError } from "../_shared/logger.ts";

// Provider handlers
import { handleShopeeJob } from "../_shared/handlers/shopee.ts";
import { handleTikTokJob } from "../_shared/handlers/tiktok.ts";
import { handleLazadaJob } from "../_shared/handlers/lazada.ts";
import { handleGoogleMerchantJob } from "../_shared/handlers/google-merchant.ts";

const HANDLER_MAP: Record<string, (job: any) => Promise<void>> = {
  shopee: handleShopeeJob,
  tiktok: handleTikTokJob,
  lazada: handleLazadaJob,
  google_merchant: handleGoogleMerchantJob
};

serve(async (req) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const expectedToken = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!authHeader.includes(expectedToken)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { provider, job_type, action } = await req.json();

  // Dead letter sweep
  if (action === "sweep_dead_letters") {
    await sweepDeadLetters();
    return Response.json({ ok: true, action: "sweep_dead_letters" });
  }

  if (!provider || !job_type) {
    return new Response("Missing provider or job_type", { status: 400 });
  }

  const handler = HANDLER_MAP[provider];
  if (!handler) return new Response(`Unknown provider: ${provider}`, { status: 400 });

  const jobs = await claimJobs(provider, job_type);

  const results = await Promise.allSettled(
    jobs.map(async (job) => {
      try {
        await handler(job);
        await markSucceeded(job.id);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await markFailed(job.id, message);
        await logError({
          tenantId: job.tenant_id,
          accountId: job.marketplace_account_id,
          provider: job.provider,
          jobId: job.id,
          errorMessage: message
        });
      }
    })
  );

  const succeeded = results.filter(r => r.status === "fulfilled").length;
  const failed = results.filter(r => r.status === "rejected").length;

  return Response.json({ ok: true, provider, job_type, succeeded, failed });
});

async function sweepDeadLetters() {
  const { getAdminClient } = await import("../_shared/supabase.ts");
  const supabase = getAdminClient();

  // Move stale processing jobs back to queued if lock TTL exceeded
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  await supabase
    .from("marketplace_sync_jobs")
    .update({ status: "queued", lock_token: null, locked_at: null })
    .eq("status", "processing")
    .lt("locked_at", staleThreshold);
}
```


***

## Shared provider handler — Shopee

```ts
// supabase/functions/_shared/handlers/shopee.ts
import { loadActiveCredential } from "../credentials.ts";
import { getAdminClient } from "../supabase.ts";

export async function handleShopeeJob(job: any): Promise<void> {
  const { credId, token, expiresAt } = await loadActiveCredential(job.marketplace_account_id);

  const account = await getAdminClient()
    .from("marketplace_accounts")
    .select("*")
    .eq("id", job.marketplace_account_id)
    .single()
    .then(r => r.data);

  const { ShopeeClient } = await import("../../shopee-sync-products/client.ts");

  const client = new ShopeeClient({
    partnerId: Deno.env.get("SHOPEE_PARTNER_ID")!,
    partnerKey: Deno.env.get("SHOPEE_PARTNER_KEY")!,
    baseUrl: Deno.env.get("SHOPEE_BASE_URL")!,
    accessToken: token.access_token as string,
    shopId: account.external_account_id
  });

  switch (job.job_type) {
    case "sync_products":
      await syncShopeeProducts(client, job);
      break;
    case "sync_orders":
      await syncShopeeOrders(client, job);
      break;
    case "sync_inventory":
      await syncShopeeInventory(client, job);
      break;
    default:
      throw new Error(`Unhandled Shopee job type: ${job.job_type}`);
  }
}

async function syncShopeeProducts(client: any, job: any) {
  // delegate to product sync logic
}

async function syncShopeeOrders(client: any, job: any) {
  // delegate to order sync logic
}

async function syncShopeeInventory(client: any, job: any) {
  // delegate to inventory sync logic
}
```

The handlers for `tiktok.ts`, `lazada.ts`, and `google-merchant.ts` follow the exact same shape with their respective client and sync functions.

***

## Final file structure

```txt
supabase/
  migrations/
    20260330_001_extensions.sql
    20260330_002_enums.sql
    20260330_003_tenancy.sql
    20260330_004_commerce.sql
    20260330_005_marketplace_accounts.sql
    20260330_006_mappings.sql
    20260330_007_sync_jobs.sql
    20260330_008_events.sql
    20260330_009_error_logs.sql
    20260330_010_google_merchant.sql
    20260330_011_rls.sql
    20260330_012_cron.sql

  functions/
    _shared/
      supabase.ts
      crypto.ts
      credentials.ts
      jobs.ts
      dedup.ts
      logger.ts
      handlers/
        shopee.ts
        tiktok.ts
        lazada.ts
        google-merchant.ts

    job-runner/
      index.ts
    shopee-start/
    shopee-callback/
    shopee-webhook/
    tiktok-start/
    tiktok-callback/
    tiktok-webhook/
    lazada-start/
    lazada-callback/
    lazada-webhook/
    google-merchant-start/
    google-merchant-callback/
```


***

## Execution checklist

Run these steps in order to get the whole system live:

1. Enable `pg_cron`, `pg_net`, and `uuid-ossp` in your Supabase project settings.
2. Run migrations `001` through `012` in order.
3. Store Vault secrets for project URL and service role key.
4. Deploy all Edge Functions using the Supabase CLI.
5. Register app credentials in Shopee, TikTok, Lazada, and Google Cloud consoles.
6. Add all env vars to the Supabase Edge Functions environment.
7. Verify pg_cron schedules are active in the Supabase Dashboard → Database → Cron Jobs.[^3]
8. Connect a sandbox account for each platform.
9. Trigger a manual `sync_products` job and inspect logs.
10. Send a test webhook to each handler and verify dedup works.
11. Run all RLS tests to confirm cross-tenant isolation.
12. Run the dead-letter sweep and confirm stale locks reset.

The next logical step would be the **complete Next.js dashboard implementation** covering connection wizards, sync status pages, event inspectors, diagnostics views, and retry consoles for all four platforms.
<span style="display:none">[^10][^11][^12][^13][^14][^15][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://github.com/supabase/supabase/blob/master/examples/prompts/edge-functions.md

[^2]: https://supabase.com/docs/guides/functions/schedule-functions

[^3]: https://supabase.com/modules/cron

[^4]: https://www.youtube.com/watch?v=-U6DJcjVvGo

[^5]: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/functions/schedule-functions.mdx

[^6]: https://fossies.org/linux/supabase/apps/docs/content/guides/functions/schedule-functions.mdx

[^7]: https://www.openspaceservices.com/blog/postgre-sql

[^8]: https://supabase.com/blog/supabase-edge-functions-deploy-dashboard-deno-2-1

[^9]: https://github.com/orgs/supabase/discussions/5612

[^10]: https://leapcell.io/blog/achieving-robust-multi-tenant-data-isolation-with-postgresql-row-level-security

[^11]: https://docs-b8tmkljqz-supabase.vercel.app/docs/guides/database/extensions/pgcron

[^12]: https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/

[^13]: https://supabase.com/docs/guides/functions

[^14]: https://dev.to/hussain101/supabase-edge-functions-4o1

[^15]: https://www.techbuddies.io/2026/02/04/how-to-implement-postgresql-row-level-security-for-multi-tenant-saas-2/

