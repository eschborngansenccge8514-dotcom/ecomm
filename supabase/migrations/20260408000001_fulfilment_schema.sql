-- Fulfilment status on orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfilment_status TEXT DEFAULT 'unfulfilled';
-- Values: unfulfilled, partially_fulfilled, fulfilled

-- Per-item tracking on order_items
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS quantity_fulfilled INTEGER DEFAULT 0;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS quantity_picked INTEGER DEFAULT 0;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS quantity_packed INTEGER DEFAULT 0;

-- Fulfilments table (supports partial/split fulfilment)
CREATE TABLE IF NOT EXISTS public.fulfilments (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    fulfilment_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    -- Status flow: pending → picking → picked → packing → packed → shipped → delivered
    tracking_number TEXT,
    courier TEXT,
    shipping_label_url TEXT,
    notes TEXT,
    picked_at TIMESTAMPTZ,
    packed_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fulfilment line items
CREATE TABLE IF NOT EXISTS public.fulfilment_items (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    fulfilment_id UUID NOT NULL REFERENCES public.fulfilments(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    variant_id UUID REFERENCES public.product_variants(id),
    quantity INTEGER NOT NULL,
    barcode TEXT,  -- snapshot for scan verification
    picked BOOLEAN DEFAULT false,
    packed BOOLEAN DEFAULT false
);

-- RLS policies
ALTER TABLE public.fulfilments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfilment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage own fulfilments" ON public.fulfilments
  FOR ALL USING (merchant_id IN (
    SELECT id FROM public.merchants WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Merchants manage own fulfilment items" ON public.fulfilment_items
  FOR ALL USING (fulfilment_id IN (
    SELECT id FROM public.fulfilments WHERE merchant_id IN (
      SELECT id FROM public.merchants WHERE owner_id = auth.uid()
    )
  ));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fulfilments_order ON public.fulfilments (order_id);
CREATE INDEX IF NOT EXISTS idx_fulfilments_merchant_status ON public.fulfilments (merchant_id, status);

-- Fulfilment number generator
CREATE OR REPLACE FUNCTION public.generate_fulfilment_number(p_merchant_id uuid)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.fulfilments WHERE merchant_id = p_merchant_id;
    RETURN 'FUL-' || LPAD((v_count + 1)::TEXT, 5, '0');
END;
$$;
