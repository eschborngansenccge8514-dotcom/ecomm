-- Add metadata column to support_sessions to store channel-specific info (like email references)
ALTER TABLE public.support_sessions
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Comment on the column for clarity
COMMENT ON COLUMN public.support_sessions.metadata IS 'Stores session-specific metadata, such as email addresses, WhatsApp identifiers, and message references for threading.';
