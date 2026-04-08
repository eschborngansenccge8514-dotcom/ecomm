ALTER TABLE merchant_applications
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION update_merchant_applications_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS merchant_applications_updated_at ON merchant_applications;

CREATE TRIGGER merchant_applications_updated_at
  BEFORE UPDATE ON merchant_applications
  FOR EACH ROW EXECUTE FUNCTION update_merchant_applications_updated_at();
