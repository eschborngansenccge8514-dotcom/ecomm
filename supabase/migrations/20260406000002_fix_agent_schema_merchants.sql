-- 20260406000002_fix_agent_schema_merchants.sql
-- Fixes the agent_actions and agent_approvals table to use public.merchants(id) 
-- instead of auth.users(id), which caused foreign key and RLS failures.

BEGIN;

-- 0. Clear stale data (Merchant ID column was using User ID)
TRUNCATE public.agent_approvals CASCADE;
TRUNCATE public.agent_actions CASCADE;

-- 1. Fix agent_actions
ALTER TABLE public.agent_actions 
  DROP CONSTRAINT IF EXISTS agent_actions_merchant_id_fkey;

ALTER TABLE public.agent_actions
  ADD CONSTRAINT agent_actions_merchant_id_fkey 
  FOREIGN KEY (merchant_id) REFERENCES public.merchants(id) ON DELETE CASCADE;

-- Update RLS for agent_actions
DROP POLICY IF EXISTS "own actions" ON public.agent_actions;
CREATE POLICY "merchant actions" ON public.agent_actions
  FOR ALL USING (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE owner_id = auth.uid()
    )
  );

-- 2. Fix agent_approvals
ALTER TABLE public.agent_approvals
  DROP CONSTRAINT IF EXISTS agent_approvals_merchant_id_fkey;

ALTER TABLE public.agent_approvals
  ADD CONSTRAINT agent_approvals_merchant_id_fkey 
  FOREIGN KEY (merchant_id) REFERENCES public.merchants(id) ON DELETE CASCADE;

-- Update RLS for agent_approvals
DROP POLICY IF EXISTS "own approvals" ON public.agent_approvals;
CREATE POLICY "merchant approvals" ON public.agent_approvals
  FOR ALL USING (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE owner_id = auth.uid()
    )
  );

COMMIT;
