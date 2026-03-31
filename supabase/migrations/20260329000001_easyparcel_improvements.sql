-- Create easyparcel_api_log table
CREATE TABLE IF NOT EXISTS public.easyparcel_api_log (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    request_payload JSONB,
    response_payload JSONB,
    error_message TEXT,
    attempt INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.easyparcel_api_log ENABLE ROW LEVEL SECURITY;

-- Only service role (admin) can view logs for now
CREATE POLICY "Service role can manage easyparcel logs"
    ON public.easyparcel_api_log
    FOR ALL
    USING (auth.role() = 'service_role');

-- Create a helper function for cron balance check (mocking for now as we don't have settings table)
-- The actual cron setup should be done via Supabase Dashboard or a more stable settings table.
