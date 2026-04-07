-- Add source column to sessions to track the origin (email, whatsapp, chat, etc.)
ALTER TABLE public.support_sessions
ADD COLUMN IF NOT EXISTS source text DEFAULT 'chat';

ALTER TABLE public.agent_sessions
ADD COLUMN IF NOT EXISTS source text DEFAULT 'chat';

-- Update RLS if needed (but usually column-level RLS is not strict unless specified)
-- No changes needed to policies as they reference merchant_id/user_id.
