-- 1. Product level tax tracking
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS lhdn_tax_type TEXT DEFAULT '06'; -- Default 06: Not Subject to Tax

-- 2. Transaction Line Item Precision
ALTER TABLE public.pos_transaction_items
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount_rm NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS lhdn_tax_type TEXT DEFAULT '06';

ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS lhdn_tax_type TEXT DEFAULT '06';

-- 3. E-Invoice Config Mode Toggle
ALTER TABLE public.merchant_einvoice_config
ADD COLUMN IF NOT EXISTS issue_mode TEXT DEFAULT 'individual' CHECK (issue_mode IN ('individual', 'consolidated')),
ADD COLUMN IF NOT EXISTS last_consolidated_at TIMESTAMPTZ;

-- 4. Buyer Mapping for E-Invoicing
-- Support cases where a buyer wants an individual e-invoice for a POS transaction
CREATE TABLE IF NOT EXISTS public.pos_einvoice_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id),
    transaction_id UUID NOT NULL REFERENCES public.pos_transactions(id),
    
    -- Buyer info provided via scan-to-invoice
    buyer_name TEXT NOT NULL,
    buyer_tin TEXT NOT NULL,
    buyer_id_type TEXT NOT NULL, -- NRIC, BRN, PASSPORT
    buyer_id_number TEXT NOT NULL,
    buyer_email TEXT,
    buyer_phone TEXT,
    
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'validated', 'failed')),
    einvoice_id UUID REFERENCES public.einvoices(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for requests
ALTER TABLE public.pos_einvoice_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants manage own requests" ON public.pos_einvoice_requests
    FOR ALL USING (merchant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));

-- 5. Helper function to update tax in historical items (One-time migration)
-- Defaulting based on merchant store_config taxRate
UPDATE public.pos_transaction_items SET tax_rate = (SELECT (store_config->>'taxRate')::NUMERIC FROM public.merchants m WHERE m.id = (SELECT merchant_id FROM public.pos_transactions t WHERE t.id = transaction_id))
WHERE tax_rate = 0;
