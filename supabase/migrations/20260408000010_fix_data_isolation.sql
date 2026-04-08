-- Fix data isolation issues affecting new merchant accounts.
-- Three problems addressed:
--   1. Support sessions with merchant_id IS NULL were visible to ALL authenticated merchants.
--   2. email_logs had no merchant_id column — service role queries returned all merchants' logs.
--   3. whatsapp_messages table had no RLS policies (table was created outside migrations).

-- ============================================================
-- 1. SUPPORT SESSIONS: Restrict NULL-merchant sessions to admins
-- ============================================================
-- NULL merchant_id sessions are platform-level (e.g. inbound emails to support@).
-- Regular merchants should never see them.

DROP POLICY IF EXISTS "merchant read support_sessions" ON public.support_sessions;
CREATE POLICY "merchant read support_sessions" ON public.support_sessions
  FOR ALL USING (
    merchant_id = auth.uid()
    OR (
      merchant_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "merchant read support_messages" ON public.support_messages;
CREATE POLICY "merchant read support_messages" ON public.support_messages
  FOR ALL USING (
    merchant_id = auth.uid()
    OR (
      merchant_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "merchant read support_escalations" ON public.support_escalations;
CREATE POLICY "merchant read support_escalations" ON public.support_escalations
  FOR ALL USING (
    merchant_id = auth.uid()
    OR (
      merchant_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

-- ============================================================
-- 2. EMAIL LOGS: Add merchant_id for per-merchant isolation
-- ============================================================
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_logs_merchant_id ON public.email_logs(merchant_id);

-- Allow merchants to read only their own email logs.
-- Service role retains full access (existing policy).
DROP POLICY IF EXISTS "Merchants can read own email logs" ON public.email_logs;
CREATE POLICY "Merchants can read own email logs" ON public.email_logs
  FOR SELECT
  TO authenticated
  USING (merchant_id = auth.uid());

-- ============================================================
-- 3. WHATSAPP MESSAGES: Ensure table exists with RLS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  recipient_number TEXT,
  sender_number TEXT,
  message_content TEXT,
  evolution_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  direction TEXT NOT NULL DEFAULT 'outbound',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_merchant_id ON public.whatsapp_messages(merchant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON public.whatsapp_messages(created_at DESC);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can manage own whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "Merchants can manage own whatsapp messages" ON public.whatsapp_messages
  FOR ALL
  TO authenticated
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access whatsapp_messages" ON public.whatsapp_messages;
CREATE POLICY "Service role full access whatsapp_messages" ON public.whatsapp_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
