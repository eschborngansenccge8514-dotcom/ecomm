CREATE TABLE IF NOT EXISTS expenses (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id           UUID        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  receipt_url           TEXT        NOT NULL,
  receipt_storage_path  TEXT        NOT NULL,
  vendor_name           TEXT,
  vendor_address        TEXT,
  receipt_number        TEXT,
  receipt_date          TIMESTAMPTZ,
  currency              TEXT        NOT NULL DEFAULT 'MYR',
  total_amount          NUMERIC(12,2),
  subtotal_amount       NUMERIC(12,2),
  sst_amount            NUMERIC(12,2),
  payment_method        TEXT,
  line_items            JSONB,
  category              TEXT        NOT NULL DEFAULT 'other',
  category_reason       TEXT,
  tax_deductible        TEXT        NOT NULL DEFAULT 'full'
                          CHECK (tax_deductible IN ('full','partial','none','capital_allowance')),
  tax_deductible_pct    INTEGER     NOT NULL DEFAULT 100,
  tax_deductible_reason TEXT,
  deductible_amount     NUMERIC(12,2),
  status                TEXT        NOT NULL DEFAULT 'ai_review'
                          CHECK (status IN ('ai_review','confirmed','rejected')),
  ai_confidence_score   NUMERIC(4,3),
  ai_notes              TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_merchant ON expenses(merchant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date     ON expenses(receipt_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_status   ON expenses(status);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merchants_own_expenses" ON expenses
  FOR ALL USING (merchant_id = auth.uid());

-- Storage RLS (run once in SQL editor)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'merchant_receipts_access' AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "merchant_receipts_access" ON storage.objects
      FOR ALL USING (
        bucket_id = 'receipts'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;
