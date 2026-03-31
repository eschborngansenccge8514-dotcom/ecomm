-- ─── 1. OAuth States ———————————————————————————————————————————————————──
-- Used to track Shopee (and other) OAuth flows
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL, -- 'shopee', 'tiktok', etc.
  state               TEXT NOT NULL UNIQUE,
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  expires_at          TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- RLS for oauth_states
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_can_insert_oauth_states"
  ON public.oauth_states FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));

-- ─── 2. Marketplace Credentials ———————————————————————————————————————————──
-- Encrypted storage for access/refresh tokens
CREATE TABLE IF NOT EXISTS public.marketplace_credentials (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  account_id          UUID NOT NULL REFERENCES public.marketplace_accounts(id) ON DELETE CASCADE,
  
  credential_type     TEXT NOT NULL, -- 'access_token', 'refresh_token'
  encrypted_payload   TEXT NOT NULL, -- AES-256-GCM encrypted
  
  is_active           BOOLEAN DEFAULT true,
  expires_at          TIMESTAMPTZ,
  
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for marketplace_credentials
ALTER TABLE public.marketplace_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchants_manage_own_credentials"
  ON public.marketplace_credentials FOR ALL TO authenticated
  USING (tenant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));

-- ─── 3. Schema Adjustments ————————————————————————————————————————————————──

-- Add order_sn specific field if not already present or clear
-- (Already present in 20260330000000 as external_order_sn)

-- Ensure marketplace_accounts has fields for Shopee shop info
-- shop_id is already there, but let's add metadata if we need it
-- (Already has metadata in shopee.md, but existing migration doesn't)

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marketplace_accounts' AND column_name = 'metadata') THEN
        ALTER TABLE public.marketplace_accounts ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
END $$;

-- ─── 4. Product Variant Mapping —————————————————————————————————————————────
-- shopee.md uses external_variant_id for variations
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marketplace_product_mappings' AND column_name = 'external_variant_id') THEN
        ALTER TABLE public.marketplace_product_mappings ADD COLUMN external_variant_id TEXT;
    END IF;
END $$;
