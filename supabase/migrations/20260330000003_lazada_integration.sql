-- ─── 1. Schema Adjustments ————————————————————————————————————————————————──

-- Add site_code to marketplace_accounts for Lazada-specific region handling
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marketplace_accounts' AND column_name = 'site_code') THEN
        ALTER TABLE public.marketplace_accounts ADD COLUMN site_code TEXT;
    END IF;
END $$;

-- ─── 2. Webhook Subscriptions —————————————————————————————————————————────
-- Lazada requires managing webhook subscriptions for different event types
CREATE TABLE IF NOT EXISTS public.marketplace_webhook_subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  account_id          UUID NOT NULL REFERENCES public.marketplace_accounts(id) ON DELETE CASCADE,
  
  event_type          TEXT NOT NULL,
  address             TEXT NOT NULL,
  status              TEXT DEFAULT 'active',
  
  metadata            JSONB DEFAULT '{}',
  
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(account_id, event_type)
);

-- RLS
ALTER TABLE public.marketplace_webhook_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchants_manage_own_webhook_subscriptions"
  ON public.marketplace_webhook_subscriptions FOR ALL TO authenticated
  USING (tenant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));

-- ─── 3. Indices ————————————————————————————————————————————————————————──
CREATE INDEX IF NOT EXISTS idx_webhook_subs_account ON public.marketplace_webhook_subscriptions(account_id);
