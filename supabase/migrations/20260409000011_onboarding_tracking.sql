-- Add onboarding tracking to merchants and profiles
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS setup_steps_completed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_dismissed BOOLEAN DEFAULT FALSE;

-- Create a view for setup progress
CREATE OR REPLACE VIEW merchant_setup_progress AS
SELECT 
  m.id as merchant_id,
  m.store_name,
  (SELECT count(*) FROM products p WHERE p.merchant_id = m.id) > 0 as has_products,
  (SELECT count(*) FROM outlets o WHERE o.merchant_id = m.id) > 0 as has_outlets,
  (SELECT count(*) FROM pos_sessions s WHERE s.merchant_id = m.id) > 0 as has_sessions,
  (SELECT count(*) FROM chart_of_accounts coa WHERE coa.merchant_id = m.id) > 0 as has_coa
FROM merchants m;
