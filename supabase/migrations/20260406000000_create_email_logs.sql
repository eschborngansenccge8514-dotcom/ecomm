-- Create email_logs table to track transactional emails via Resend
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resend_id TEXT,
    template TEXT NOT NULL,
    recipient TEXT NOT NULL,
    status TEXT NOT NULL, -- 'sent' | 'delivered' | 'failed' | 'bounced' | 'complained'
    error TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexing for lookup by resend_id and recipient
CREATE INDEX idx_email_logs_resend_id ON public.email_logs(resend_id);
CREATE INDEX idx_email_logs_recipient ON public.email_logs(recipient);
CREATE INDEX idx_email_logs_status ON public.email_logs(status);
CREATE INDEX idx_email_logs_created_at ON public.email_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Policy: service_role has full access
CREATE POLICY "Service Role full access" ON public.email_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy: Admins can read (if we have admin roles)
-- Assuming we might have a custom check for admin roles in the future
-- For now, we'll rely on the dashboard using service role client for logging/viewing in the internal tool
