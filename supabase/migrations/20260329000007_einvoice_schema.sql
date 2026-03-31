-- ─── 1. Merchant Config —————————————————————————————————————————————————
CREATE TABLE IF NOT EXISTS public.merchant_einvoice_config (
  merchant_id         UUID PRIMARY KEY REFERENCES public.merchants(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','inactive')),
  env                 TEXT NOT NULL DEFAULT 'sandbox' CHECK (env IN ('sandbox','production')),

  -- LHDN credentials
  client_id           TEXT,
  client_secret       TEXT,
  
  -- Supplier/Merchant Details for LHDN
  tin                 TEXT,
  brn                 TEXT,
  msic_code           TEXT DEFAULT '47910',
  description         TEXT DEFAULT 'E-Commerce / Retail',
  
  -- Digital certificate
  cert_p12_base64     TEXT, -- Store as base64
  cert_passphrase     TEXT, -- Encypted storage would be better but we'll use text for now
  cert_issuer_name    TEXT,
  cert_serial         TEXT,

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.merchant_einvoice_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants can manage their own e-invoice config"
  ON public.merchant_einvoice_config
  FOR ALL TO authenticated
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));

-- ─── 2. e-Invoices —————————————————————————————————————————————————————
CREATE TABLE IF NOT EXISTS public.einvoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id         UUID NOT NULL REFERENCES public.merchants(id),
  order_id            UUID UNIQUE NOT NULL REFERENCES public.orders(id),
  order_number        TEXT NOT NULL, -- Reference order_number
  
  invoice_type        TEXT NOT NULL DEFAULT '01', -- 01: Invoice, 02: Credit, 03: Debit, 04: Refund
  status              TEXT NOT NULL DEFAULT 'pending', -- pending, submitted, validated, rejected, cancelled
  
  submission_uid      TEXT,
  lhdn_uuid           TEXT,
  lhdn_long_id        TEXT,
  qr_code_url         TEXT,
  error_message       TEXT,
  
  submitted_at        TIMESTAMPTZ,
  validated_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.einvoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants can view their own e-invoices"
  ON public.einvoices
  FOR ALL TO authenticated
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));

-- ─── 3. Consolidated Staging ————————————————————————————————————————————
CREATE TABLE IF NOT EXISTS public.consolidated_staging (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id              UUID NOT NULL REFERENCES public.merchants(id),
  order_id                 UUID UNIQUE NOT NULL REFERENCES public.orders(id),
  order_number             TEXT NOT NULL,
  
  subtotal                 NUMERIC(12,2) NOT NULL,
  tax_amount               NUMERIC(12,2) NOT NULL DEFAULT 0,
  
  period_year              INT NOT NULL,
  period_month             INT NOT NULL,
  
  consolidated_einvoice_id UUID REFERENCES public.einvoices(id),
  consolidated_at          TIMESTAMPTZ,
  staged_at                TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.consolidated_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants can manage their own consolidated staging"
  ON public.consolidated_staging
  FOR ALL TO authenticated
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));

-- ─── 4. Audit Log —————————————————————————————————————————————————————──
CREATE TABLE IF NOT EXISTS public.einvoice_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id   UUID NOT NULL REFERENCES public.merchants(id),
  order_id      UUID REFERENCES public.orders(id),
  
  action        TEXT,
  endpoint      TEXT,
  request_body  JSONB DEFAULT '{}',
  response_body JSONB DEFAULT '{}',
  status_code   INT,
  duration_ms   INT,
  
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.einvoice_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants can view their own e-invoice logs"
  ON public.einvoice_audit_log
  FOR SELECT TO authenticated
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));

-- ─── 5. Production Log (Historical) —————————————————————————————————————
CREATE TABLE IF NOT EXISTS public.einvoice_production_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id      UUID NOT NULL REFERENCES public.merchants(id),
  order_number     TEXT NOT NULL,
  lhdn_uuid        TEXT NOT NULL,
  lhdn_long_id     TEXT,
  invoice_type     TEXT,
  amount           NUMERIC(12,2),
  issued_at        TIMESTAMPTZ DEFAULT NOW(),
  tax_period_year  INT,
  tax_period_month INT
);

-- RLS
ALTER TABLE public.einvoice_production_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants can view their own production log"
  ON public.einvoice_production_log
  FOR SELECT TO authenticated
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));

-- ─── 6. Failed Jobs —————————————————————————————————————————————————————
CREATE TABLE IF NOT EXISTS public.failed_invoice_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id  UUID NOT NULL REFERENCES public.merchants(id),
  job_type     TEXT,
  order_id     UUID REFERENCES public.orders(id),
  
  error        TEXT,
  attempts     INT DEFAULT 0,
  payload      JSONB DEFAULT '{}',
  
  failed_at    TIMESTAMPTZ DEFAULT NOW(),
  resolved     BOOLEAN DEFAULT FALSE,
  resolved_at  TIMESTAMPTZ,
  resolved_by  TEXT
);

-- RLS
ALTER TABLE public.failed_invoice_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants can manage their failed invoice jobs"
  ON public.failed_invoice_jobs
  FOR ALL TO authenticated
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));

-- ─── Indexing —————————————————————————————————————————————————————————──
CREATE INDEX IF NOT EXISTS idx_einvoices_merchant ON public.einvoices(merchant_id);
CREATE INDEX IF NOT EXISTS idx_einvoices_order_id ON public.einvoices(order_id);
CREATE INDEX IF NOT EXISTS idx_consolidated_staging_period ON public.consolidated_staging(merchant_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_failed_invoice_jobs_resolved ON public.failed_invoice_jobs(merchant_id, resolved);
CREATE INDEX IF NOT EXISTS idx_production_log_period ON public.einvoice_production_log(merchant_id, tax_period_year, tax_period_month);
