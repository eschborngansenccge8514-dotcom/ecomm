-- Allow platform-level support sessions (no merchant) by making merchant_id nullable.
-- Previously, inserting with merchant_id = '00000000-...' caused FK violations against
-- auth.users(id), silently failing session creation and blocking email replies to
-- support@mail.senang.store.

ALTER TABLE public.support_sessions
  ALTER COLUMN merchant_id DROP NOT NULL;

ALTER TABLE public.support_messages
  ALTER COLUMN merchant_id DROP NOT NULL;

ALTER TABLE public.support_escalations
  ALTER COLUMN merchant_id DROP NOT NULL;

-- Update RLS policies to handle null merchant_id
DROP POLICY IF EXISTS "merchant read support_sessions" ON public.support_sessions;
CREATE POLICY "merchant read support_sessions" ON public.support_sessions
  FOR ALL USING (merchant_id IS NULL OR merchant_id = auth.uid());

DROP POLICY IF EXISTS "merchant read support_messages" ON public.support_messages;
CREATE POLICY "merchant read support_messages" ON public.support_messages
  FOR ALL USING (merchant_id IS NULL OR merchant_id = auth.uid());

DROP POLICY IF EXISTS "merchant read support_escalations" ON public.support_escalations;
CREATE POLICY "merchant read support_escalations" ON public.support_escalations
  FOR ALL USING (merchant_id IS NULL OR merchant_id = auth.uid());
