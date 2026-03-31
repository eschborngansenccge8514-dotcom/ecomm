-- Create merchant_razorpay_config table
CREATE TABLE IF NOT EXISTS public.merchant_razorpay_config (
    merchant_id uuid PRIMARY KEY REFERENCES public.merchants(id) ON DELETE CASCADE,
    key_id text NOT NULL,
    key_secret text NOT NULL,
    webhook_secret text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.merchant_razorpay_config ENABLE ROW LEVEL SECURITY;

-- Migration to add refund columns to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refunded_at timestamp with time zone;

-- RLS Policies for merchant_razorpay_config
-- Merchants can view their own config
CREATE POLICY "Merchants can view their own razorpay config"
    ON public.merchant_razorpay_config
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.merchants m
            WHERE m.id = merchant_razorpay_config.merchant_id
            AND m.owner_id = auth.uid()
        )
    );

-- Merchants can insert their own config
CREATE POLICY "Merchants can insert their own razorpay config"
    ON public.merchant_razorpay_config
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.merchants m
            WHERE m.id = merchant_id
            AND m.owner_id = auth.uid()
        )
    );

-- Merchants can update their own config
CREATE POLICY "Merchants can update their own razorpay config"
    ON public.merchant_razorpay_config
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.merchants m
            WHERE m.id = merchant_razorpay_config.merchant_id
            AND m.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.merchants m
            WHERE m.id = merchant_razorpay_config.merchant_id
            AND m.owner_id = auth.uid()
        )
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_merchant_razorpay_config_updated_at
BEFORE UPDATE ON public.merchant_razorpay_config
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
