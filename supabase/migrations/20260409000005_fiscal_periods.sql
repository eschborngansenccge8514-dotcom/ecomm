-- Accounting Engine Phase 6: Fiscal Periods & Period Locking

CREATE TABLE fiscal_periods (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  start_date  timestamptz NOT NULL,
  end_date    timestamptz NOT NULL,
  status      text DEFAULT 'OPEN',  -- 'OPEN' | 'CLOSED' | 'LOCKED'
  closed_by   uuid,
  closed_at   timestamptz,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_fp_merchant ON fiscal_periods(merchant_id);

-- RLS
ALTER TABLE fiscal_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchant_own_periods" ON fiscal_periods
  USING (merchant_id = (SELECT id FROM merchants WHERE owner_id = auth.uid() LIMIT 1));

-- Constraint: No overlapping periods for the same merchant
-- (Simplified version, ideally use a gist index or trigger)
CREATE UNIQUE INDEX idx_fp_unique_merchant_name ON fiscal_periods(merchant_id, name);

-- Function to check if a date falls within a closed period
CREATE OR REPLACE FUNCTION is_period_closed(p_merchant_id UUID, p_date TIMESTAMPTZ)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM fiscal_periods
    WHERE merchant_id = p_merchant_id
      AND p_date BETWEEN start_date AND end_date
      AND status <> 'OPEN'
  );
END;
$$ LANGUAGE plpgsql;
