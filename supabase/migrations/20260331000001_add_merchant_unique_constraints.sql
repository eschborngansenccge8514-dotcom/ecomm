-- ── Add unique constraints for upsert operations ──────────────────────────────────

-- 1. Merchant applications should be unique per user
ALTER TABLE merchant_applications 
  ADD CONSTRAINT merchant_applications_user_id_key UNIQUE (user_id);

-- 2. Merchant stores should be unique per owner
ALTER TABLE merchants 
  ADD CONSTRAINT merchants_owner_id_key UNIQUE (owner_id);
