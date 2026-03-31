-- Create merchant_billplz_config table at 20260329000006_billplz_config.sql

CREATE TABLE IF NOT EXISTS public.merchant_billplz_config (
    merchant_id uuid PRIMARY KEY REFERENCES public.merchants(id) ON DELETE CASCADE,
    collection_id text NOT NULL,
    x_signature text,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.merchant_billplz_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for merchant_billplz_config
-- Merchants can view their own config
CREATE POLICY "Merchants can view their own billplz config"
    ON public.merchant_billplz_config
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.merchants m
            WHERE m.id = merchant_billplz_config.merchant_id
            AND m.owner_id = auth.uid()
        )
    );

-- Merchants can insert their own config
CREATE POLICY "Merchants can insert their own billplz config"
    ON public.merchant_billplz_config
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.merchants m
            WHERE m.id = merchant_id
            AND m.owner_id = auth.uid()
        )
    );

-- Merchants can update their own config
CREATE POLICY "Merchants can update their own billplz config"
    ON public.merchant_billplz_config
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.merchants m
            WHERE m.id = merchant_billplz_config.merchant_id
            AND m.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.merchants m
            WHERE m.id = merchant_billplz_config.merchant_id
            AND m.owner_id = auth.uid()
        )
    );

-- Trigger for updated_at
CREATE TRIGGER update_merchant_billplz_config_updated_at
BEFORE UPDATE ON public.merchant_billplz_config
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
