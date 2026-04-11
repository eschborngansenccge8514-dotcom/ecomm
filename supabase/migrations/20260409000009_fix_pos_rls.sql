-- Migration: 20260409000009_fix_pos_rls.sql
-- Description: Enable RLS and add policies for POS tables

-- 1. Enable RLS
ALTER TABLE public.pos_outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_transaction_items ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if any to avoid conflicts
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Merchants can manage their own outlets" ON public.pos_outlets;
    DROP POLICY IF EXISTS "Merchants can manage their own sessions" ON public.pos_sessions;
    DROP POLICY IF EXISTS "Merchants can manage their own transactions" ON public.pos_transactions;
    DROP POLICY IF EXISTS "Merchants can manage their own transaction items" ON public.pos_transaction_items;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

-- 3. Create Policies
CREATE POLICY "Merchants can manage their own outlets" ON public.pos_outlets
    FOR ALL USING (merchant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));

CREATE POLICY "Merchants can manage their own sessions" ON public.pos_sessions
    FOR ALL USING (merchant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));

CREATE POLICY "Merchants can manage their own transactions" ON public.pos_transactions
    FOR ALL USING (merchant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));

CREATE POLICY "Merchants can manage their own transaction items" ON public.pos_transaction_items
    FOR ALL USING (transaction_id IN (SELECT id FROM public.pos_transactions WHERE merchant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid())));
