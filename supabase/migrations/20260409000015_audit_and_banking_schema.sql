-- Phase 7: Audit-Ready Finance Schema

-- 1. Universal Audit Log
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id),
    user_id UUID REFERENCES auth.users(id),
    
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL,          -- 'INSERT', 'UPDATE', 'DELETE'
    
    old_data JSONB,
    new_data JSONB,
    changed_fields JSONB,          -- Computed array of keys that changed
                             
    ip_address TEXT,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for fast audit lookups
CREATE INDEX IF NOT EXISTS idx_audit_record ON public.audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_merchant ON public.audit_logs(merchant_id, created_at DESC);

-- 2. Audit Trigger Function
CREATE OR REPLACE FUNCTION public.proc_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_merchant_id UUID;
    v_changed_fields JSONB := '[]'::jsonb;
BEGIN
    -- Identify merchant_id (tables being audited must have a merchant_id column)
    IF (TG_OP = 'DELETE') THEN
        v_merchant_id := OLD.merchant_id;
    ELSE
        v_merchant_id := NEW.merchant_id;
    END IF;

    -- Compute changed fields for UPDATES
    IF (TG_OP = 'UPDATE') THEN
        SELECT jsonb_agg(key) INTO v_changed_fields
        FROM (
            SELECT key FROM jsonb_each(to_jsonb(OLD))
            INTERSECT
            SELECT key FROM jsonb_each(to_jsonb(NEW))
            WHERE to_jsonb(OLD)->key IS DISTINCT FROM to_jsonb(NEW)->key
        ) s;
    END IF;

    INSERT INTO public.audit_logs (
        merchant_id,
        user_id,
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        changed_fields
    ) VALUES (
        v_merchant_id,
        auth.uid(),
        TG_TABLE_NAME,
        CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        v_changed_fields
    );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Apply Audit Triggers to Critical Financial Tables
CREATE TRIGGER trig_audit_products 
AFTER INSERT OR UPDATE OR DELETE ON public.products 
FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log();

CREATE TRIGGER trig_audit_journal_entries 
AFTER INSERT OR UPDATE OR DELETE ON public.journal_entries 
FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log();

CREATE TRIGGER trig_audit_inventory_adjustments 
AFTER INSERT OR UPDATE OR DELETE ON public.inventory_adjustments 
FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log();

-- 4. Bank Account Mapping (For Reconciliation)
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id),
    name TEXT NOT NULL,            -- e.g., "Maybank Main Account"
    account_number TEXT,
    bank_name TEXT,
    currency TEXT DEFAULT 'MYR',
    
    opening_balance NUMERIC(15,2) DEFAULT 0,
    current_balance NUMERIC(15,2) DEFAULT 0,
    
    coa_account_id UUID REFERENCES public.coa_accounts(id), -- Links to Chart of Accounts
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchant read own audit logs" ON public.audit_logs
    FOR SELECT USING (merchant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));
