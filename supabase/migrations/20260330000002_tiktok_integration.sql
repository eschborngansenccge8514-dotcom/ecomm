-- ─── 1. Marketplace Credentials ———————————————————————————————————————————
CREATE TABLE IF NOT EXISTS public.marketplace_credentials (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  account_id              UUID NOT NULL REFERENCES public.marketplace_accounts(id) ON DELETE CASCADE,
  
  credential_type         TEXT NOT NULL, -- e.g., 'access_token', 'refresh_token'
  encrypted_payload       TEXT NOT NULL,
  
  expires_at              TIMESTAMPTZ,
  is_active               BOOLEAN DEFAULT true,
  
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.marketplace_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants can manage their own marketplace credentials"
  ON public.marketplace_credentials
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));

-- ─── 2. Webhook Subscriptions —————————————————————————————————————————————
CREATE TABLE IF NOT EXISTS public.marketplace_webhook_subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  account_id              UUID NOT NULL REFERENCES public.marketplace_accounts(id) ON DELETE CASCADE,
  
  event_type              TEXT NOT NULL,
  address                 TEXT NOT NULL,
  
  status                  TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'failed')),
  
  last_verified_at        TIMESTAMPTZ,
  metadata                JSONB DEFAULT '{}',
  
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(account_id, event_type)
);

-- RLS
ALTER TABLE public.marketplace_webhook_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants can view their own webhook subscriptions"
  ON public.marketplace_webhook_subscriptions
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));

-- ─── 3. OAuth States ——————————————————————————————————————————————————————
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  provider                TEXT NOT NULL,
  state                   TEXT NOT NULL UNIQUE,
  metadata                JSONB DEFAULT '{}',
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  expires_at              TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour')
);

-- RLS
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants can manage their own oauth states"
  ON public.oauth_states
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));

-- ─── 4. Indexes —————————————————————————————————————————————————————————──
CREATE INDEX idx_marketplace_credentials_account ON public.marketplace_credentials(account_id, is_active);
CREATE INDEX idx_webhook_subscriptions_account ON public.marketplace_webhook_subscriptions(account_id, event_type);
CREATE INDEX idx_oauth_states_state ON public.oauth_states(state);
