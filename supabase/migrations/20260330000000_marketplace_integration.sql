-- ─── 1. Marketplace Providers —————————————————————————————————————————————
CREATE TABLE IF NOT EXISTS public.marketplace_providers (
  id                  TEXT PRIMARY KEY, -- 'shopee', 'tiktok', 'lazada', etc.
  name                TEXT NOT NULL,
  description         TEXT,
  image_url           TEXT,
  is_active           BOOLEAN DEFAULT true,
  config_schema       JSONB DEFAULT '{}', -- Validated via Zod in edge functions
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Seed providers
INSERT INTO public.marketplace_providers (id, name, description)
VALUES 
  ('shopee', 'Shopee', 'Southeast Asia and Taiwan online shopping platform'),
  ('tiktok', 'TikTok Shop', 'Social commerce marketplace by TikTok'),
  ('lazada', 'Lazada', 'Online shopping and selling destination in Southeast Asia'),
  ('google_merchant', 'Google Merchant Center', 'Showcase your products across Google')
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Marketplace Accounts ——————————————————————————————————————————————
CREATE TABLE IF NOT EXISTS public.marketplace_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  provider_id         TEXT NOT NULL REFERENCES public.marketplace_providers(id),
  
  shop_id             TEXT, -- External shop ID provided by marketplace
  shop_name           TEXT,
  region              TEXT, -- e.g. 'MY', 'SG', 'ID'
  
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'reauth_required', 'suspended')),
  credentials_ref     TEXT, -- Reference to encrypted credentials in vault or separate table
  
  sync_preferences    JSONB DEFAULT '{
    "products": true,
    "inventory": true,
    "orders": true,
    "prices": true
  }',
  
  last_sync_at        TIMESTAMPTZ,
  next_sync_at        TIMESTAMPTZ,
  
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, provider_id, shop_id)
);

-- RLS
ALTER TABLE public.marketplace_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants can manage their own marketplace accounts"
  ON public.marketplace_accounts
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));

-- ─── 3. Sync Jobs ———————————————————————————————————————————————————————──
CREATE TABLE IF NOT EXISTS public.marketplace_sync_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  account_id          UUID NOT NULL REFERENCES public.marketplace_accounts(id) ON DELETE CASCADE,
  
  job_type            TEXT NOT NULL, -- 'sync_products', 'sync_orders', 'sync_inventory'
  payload             JSONB DEFAULT '{}',
  
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  priority            INT DEFAULT 0, -- Higher = sooner
  
  attempt_count       INT DEFAULT 0,
  max_attempts        INT DEFAULT 3,
  
  error_message       TEXT,
  error_payload       JSONB,
  
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  next_retry_at       TIMESTAMPTZ,
  
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.marketplace_sync_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants can view their own sync jobs"
  ON public.marketplace_sync_jobs
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));

-- ─── 4. Mappings ————————————————————————————————————————————————————————──

-- Product Listings Mappings
CREATE TABLE IF NOT EXISTS public.marketplace_product_mappings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  account_id          UUID NOT NULL REFERENCES public.marketplace_accounts(id) ON DELETE CASCADE,
  
  product_id          UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  external_product_id TEXT NOT NULL,
  
  status              TEXT DEFAULT 'synced',
  last_payload        JSONB,
  last_synced_at      TIMESTAMPTZ,
  
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(account_id, product_id),
  UNIQUE(account_id, external_product_id)
);

-- Order Mappings
CREATE TABLE IF NOT EXISTS public.marketplace_order_mappings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  account_id          UUID NOT NULL REFERENCES public.marketplace_accounts(id) ON DELETE CASCADE,
  
  order_id            UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  external_order_id   TEXT NOT NULL,
  external_order_sn   TEXT, -- For Shopee order_sn
  
  raw_payload         JSONB,
  
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(account_id, order_id),
  UNIQUE(account_id, external_order_id)
);

-- ─── 5. Marketplace Events (Webhooks/Audit) —————————————————————————————──
CREATE TABLE IF NOT EXISTS public.marketplace_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id         TEXT NOT NULL REFERENCES public.marketplace_providers(id),
  external_event_id   TEXT, -- For idempotency
  
  tenant_id           UUID REFERENCES public.merchants(id),
  account_id          UUID REFERENCES public.marketplace_accounts(id),
  
  event_type          TEXT NOT NULL, -- e.g. 'order_status_update', 'item_inventory_change'
  payload             JSONB NOT NULL,
  
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'ignored')),
  error_message       TEXT,
  
  processed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(provider_id, external_event_id)
);

-- Indexing
CREATE INDEX idx_sync_jobs_status_priority ON public.marketplace_sync_jobs(status, priority DESC, created_at ASC);
CREATE INDEX idx_marketplace_events_external_id ON public.marketplace_events(provider_id, external_event_id);
CREATE INDEX idx_product_mappings_lookup ON public.marketplace_product_mappings(account_id, product_id);
CREATE INDEX idx_order_mappings_lookup ON public.marketplace_order_mappings(account_id, external_order_id);
