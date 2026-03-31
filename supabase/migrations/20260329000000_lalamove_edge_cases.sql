-- 1. Update orders table with tracking and exception fields
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS driver_assigned_at timestamptz,
ADD COLUMN IF NOT EXISTS last_driver_lat double precision,
ADD COLUMN IF NOT EXISTS last_driver_lng double precision,
ADD COLUMN IF NOT EXISTS last_driver_update_at timestamptz,
ADD COLUMN IF NOT EXISTS lalamove_cancel_reason text,
ADD COLUMN IF NOT EXISTS lalamove_retry_count int DEFAULT 0,
ADD COLUMN IF NOT EXISTS priority_fee_added numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS exception_flag text CHECK (exception_flag IN ('driver_not_found', 'driver_unresponsive', 'api_failure', 'quote_expired')),
ADD COLUMN IF NOT EXISTS exception_flagged_at timestamptz;

-- 2. Update profiles table with expo_push_token
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS expo_push_token text;

-- 3. Create delivery_exception_logs table
CREATE TABLE IF NOT EXISTS public.delivery_exception_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
    type text NOT NULL,
    message text,
    raw_payload jsonb,
    resolved boolean DEFAULT false,
    resolved_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- RLS for delivery_exception_logs
ALTER TABLE public.delivery_exception_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do everything on delivery_exception_logs"
ON public.delivery_exception_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Merchants can read exception logs for their orders"
ON public.delivery_exception_logs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.orders o
        JOIN public.merchants m ON o.merchant_id = m.id
        WHERE o.id = public.delivery_exception_logs.order_id
        AND m.owner_id = auth.uid()
    )
);

-- 4. Create lalamove_api_log table
CREATE TABLE IF NOT EXISTS public.lalamove_api_log (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
    endpoint text NOT NULL,
    method text NOT NULL,
    request_body jsonb,
    response_body jsonb,
    status_code int,
    attempt int DEFAULT 1,
    created_at timestamptz DEFAULT now()
);

-- RLS for lalamove_api_log
ALTER TABLE public.lalamove_api_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do everything on lalamove_api_log"
ON public.lalamove_api_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5. Create webhook_events table for idempotency
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    provider text NOT NULL,
    event_id text NOT NULL,
    order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
    processed_at timestamptz DEFAULT now(),
    UNIQUE(provider, event_id)
);

-- RLS for webhook_events
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do everything on webhook_events"
ON public.webhook_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_exception_flag ON public.orders(exception_flag) WHERE exception_flag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status_merchant_id ON public.orders(status, merchant_id);
CREATE INDEX IF NOT EXISTS idx_lalamove_api_log_order_id ON public.lalamove_api_log(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_exception_logs_order_id ON public.delivery_exception_logs(order_id);
