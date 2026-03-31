-- Add missing timestamp columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS preparing_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS ready_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS dispatched_at timestamp with time zone;

-- Also add helpful comments for these columns
COMMENT ON COLUMN public.orders.preparing_at IS 'When the merchant started preparing the order';
COMMENT ON COLUMN public.orders.ready_at IS 'When the merchant marked the order as ready for pickup';
COMMENT ON COLUMN public.orders.dispatched_at IS 'When the order was dispatched/picked up for delivery';
