-- Create merchant_applications table (was missing, only ALTER TABLE existed)
CREATE TABLE IF NOT EXISTS merchant_applications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name          TEXT NOT NULL,
  store_type          TEXT,
  tagline             TEXT,
  description         TEXT,
  phone               TEXT,
  whatsapp            TEXT,
  city                TEXT,
  state               TEXT,
  postcode            TEXT,
  business_reg_number TEXT,
  bank_name           TEXT,
  bank_account_number TEXT,
  bank_account_name   TEXT,
  expected_orders     TEXT,
  how_heard           TEXT,
  agree_terms         BOOLEAN DEFAULT FALSE,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason    TEXT,
  reviewed_by         UUID REFERENCES auth.users(id),
  reviewed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT merchant_applications_user_id_key UNIQUE (user_id)
);

ALTER TABLE merchant_applications ENABLE ROW LEVEL SECURITY;

-- Users can read/upsert their own application
CREATE POLICY "users can manage own application"
  ON merchant_applications FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can read all applications (via service role, RLS bypassed)
-- Service role key used in admin pages bypasses RLS automatically

CREATE OR REPLACE FUNCTION update_merchant_applications_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER merchant_applications_updated_at
  BEFORE UPDATE ON merchant_applications
  FOR EACH ROW EXECUTE FUNCTION update_merchant_applications_updated_at();
