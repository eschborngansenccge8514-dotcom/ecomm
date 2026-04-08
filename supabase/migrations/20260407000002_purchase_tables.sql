-- Migration: 20260407000002_purchase_tables.sql
-- Description: Create tables and RPCs for Purchases feature (reproducibility)

-- 1. Suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address JSONB DEFAULT '{}'::jsonb,
    contact_person TEXT,
    payment_terms TEXT,
    lead_time_days INTEGER DEFAULT 7,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Product Suppliers (Mapping)
CREATE TABLE IF NOT EXISTS public.product_suppliers (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    supplier_sku TEXT,
    unit_cost NUMERIC NOT NULL DEFAULT 0,
    min_order_qty INTEGER DEFAULT 1,
    is_preferred BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Purchase Orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    po_number TEXT NOT NULL,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    outlet_id UUID REFERENCES public.pos_outlets(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    order_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    expected_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    subtotal NUMERIC DEFAULT 0,
    tax NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Purchase Order Items
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    quantity_ordered INTEGER NOT NULL,
    quantity_received INTEGER DEFAULT 0,
    unit_cost NUMERIC NOT NULL DEFAULT 0,
    total NUMERIC NOT NULL DEFAULT 0
);

-- 5. Goods Receipts
CREATE TABLE IF NOT EXISTS public.goods_receipts (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    received_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Goods Receipt Items
CREATE TABLE IF NOT EXISTS public.goods_receipt_items (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    receipt_id UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
    po_item_id UUID NOT NULL REFERENCES public.purchase_order_items(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    quantity_received INTEGER NOT NULL
);

-- RLS Policies
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_items ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    -- Suppliers
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'Merchants can view their own suppliers') THEN
        CREATE POLICY "Merchants can view their own suppliers" ON public.suppliers FOR SELECT USING (merchant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'Merchants can insert their own suppliers') THEN
        CREATE POLICY "Merchants can insert their own suppliers" ON public.suppliers FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));
    END IF;

    -- Product Suppliers
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_suppliers' AND policyname = 'Merchants can manage their product suppliers') THEN
        CREATE POLICY "Merchants can manage their product suppliers" ON public.product_suppliers FOR ALL USING (merchant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));
    END IF;

    -- Purchase Orders
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_orders' AND policyname = 'Merchants can manage their purchase orders') THEN
        CREATE POLICY "Merchants can manage their purchase orders" ON public.purchase_orders FOR ALL USING (merchant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));
    END IF;

    -- PO Items
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_order_items' AND policyname = 'Merchants can manage their PO items') THEN
        CREATE POLICY "Merchants can manage their PO items" ON public.purchase_order_items FOR ALL USING (po_id IN (SELECT id FROM public.purchase_orders WHERE merchant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid())));
    END IF;

    -- Goods Receipts
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goods_receipts' AND policyname = 'Merchants can manage their goods receipts') THEN
        CREATE POLICY "Merchants can manage their goods receipts" ON public.goods_receipts FOR ALL USING (merchant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));
    END IF;

    -- Receipt Items
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goods_receipt_items' AND policyname = 'Merchants can manage their receipt items') THEN
        CREATE POLICY "Merchants can manage their receipt items" ON public.goods_receipt_items FOR ALL USING (receipt_id IN (SELECT id FROM public.goods_receipts WHERE merchant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid())));
    END IF;
END $$;

-- RPCs
CREATE OR REPLACE FUNCTION public.generate_po_number(p_merchant_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 AS $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.purchase_orders WHERE merchant_id = p_merchant_id;
    RETURN 'PO-' || LPAD((v_count + 1)::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.receive_goods(p_receipt_id uuid, p_items jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 AS $$
DECLARE
    v_po_id UUID;
    v_merchant_id UUID;
    v_item RECORD;
    v_all_received BOOLEAN;
BEGIN
    -- Get PO info
    SELECT po_id, merchant_id INTO v_po_id, v_merchant_id FROM public.goods_receipts WHERE id = p_receipt_id;
    
    -- Process each item in JSONB: [{"po_item_id": "...", "quantity": 10}, ...]
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(po_item_id UUID, quantity INT)
    LOOP
        -- Update PO item
        UPDATE public.purchase_order_items 
        SET quantity_received = quantity_received + v_item.quantity
        WHERE id = v_item.po_item_id;
        
        -- Get product/variant info
        DECLARE
            v_prod_id UUID;
            v_var_id UUID;
        BEGIN
            SELECT product_id, variant_id INTO v_prod_id, v_var_id FROM public.purchase_order_items WHERE id = v_item.po_item_id;
            
            -- Create receipt item record
            INSERT INTO public.goods_receipt_items (receipt_id, po_item_id, product_id, variant_id, quantity_received)
            VALUES (p_receipt_id, v_item.po_item_id, v_prod_id, v_var_id, v_item.quantity);
            
            -- Create inventory movement (trigger will handle stock update)
            INSERT INTO public.inventory_movements (merchant_id, product_id, variant_id, quantity, type, reference_id, reference_type)
            VALUES (v_merchant_id, v_prod_id, v_var_id, v_item.quantity, 'po_receive', v_po_id, 'purchase_order');
        END;
    END LOOP;
    
    -- Check if PO is fully received
    SELECT NOT EXISTS (
        SELECT 1 FROM public.purchase_order_items 
        WHERE po_id = v_po_id AND quantity_received < quantity_ordered
    ) INTO v_all_received;
    
    IF v_all_received THEN
        UPDATE public.purchase_orders SET status = 'received', updated_at = NOW() WHERE id = v_po_id;
    ELSE
        UPDATE public.purchase_orders SET status = 'partially_received', updated_at = NOW() WHERE id = v_po_id;
    END IF;
END;
$$;
