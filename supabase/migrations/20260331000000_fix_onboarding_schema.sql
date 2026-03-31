-- ── Add radius_km to delivery_zones ──────────────────────────────────────────
ALTER TABLE delivery_zones 
  ADD COLUMN IF NOT EXISTS radius_km numeric DEFAULT 0;

-- ── Rename min_order_amount if needed or just use current ─────────────────────
-- The UI uses min_order, table uses min_order_amount. I'll stick to min_order_amount in DB.

-- ── Fix RLS Policies for INSERT operations ─────────────────────────────────────
-- Some Supabase environments require WITH CHECK for FOR ALL policies to allow INSERT.

DROP POLICY IF EXISTS "merchant manages own hours" ON merchant_operating_hours;
CREATE POLICY "merchant manages own hours"
  ON merchant_operating_hours FOR ALL TO authenticated
  USING (merchant_id IN (SELECT id FROM merchants WHERE owner_id = auth.uid()))
  WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "merchant manages own zones" ON delivery_zones;
CREATE POLICY "merchant manages own zones"
  ON delivery_zones FOR ALL TO authenticated
  USING (merchant_id IN (SELECT id FROM merchants WHERE owner_id = auth.uid()))
  WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE owner_id = auth.uid()));

-- ── Ensure merchants bucket is public and exists ────────────────────────────────
-- (Note: Storage bucket creation usually done via dashboard/API, 
-- but I'll add a reminder or check if I can run SQL for it).
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('merchants', 'merchants', true) 
-- ON CONFLICT (id) DO UPDATE SET public = true;
