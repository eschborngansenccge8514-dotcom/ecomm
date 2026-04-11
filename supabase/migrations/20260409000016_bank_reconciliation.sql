-- Phase 7: Bank Reconciliation Support

-- 1. Bank Statement Lines (Staging)
CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL REFERENCES public.merchants(id),
    
    transaction_date DATE NOT NULL,
    description TEXT NOT NULL,     -- Raw text from bank (e.g., "PETRONAS PAY" )
    reference TEXT,                -- Check number or reference ID
    
    debit NUMERIC(15,2) DEFAULT 0,
    credit NUMERIC(15,2) DEFAULT 0,
    amount NUMERIC(15,2) NOT NULL, -- Logical amount (+ for credit, - for debit)
    
    -- Matching State
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'ignored', 'manual')),
    matched_journal_entry_id UUID REFERENCES public.journal_entries(id),
    suggested_coa_id UUID REFERENCES public.coa_accounts(id),
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for reconciliation speed
CREATE INDEX IF NOT EXISTS idx_bsl_pending ON public.bank_statement_lines(bank_account_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_bsl_date ON public.bank_statement_lines(transaction_date);

-- 2. Audit triggers for banking (Security/Hardening)
CREATE TRIGGER trig_audit_bank_accounts 
AFTER INSERT OR UPDATE OR DELETE ON public.bank_accounts 
FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log();

CREATE TRIGGER trig_audit_bank_lines 
AFTER INSERT OR UPDATE OR DELETE ON public.bank_statement_lines 
FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log();

-- 3. RLS
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchant manage own bank accounts" ON public.bank_accounts
    FOR ALL USING (merchant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));

ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchant manage own bank lines" ON public.bank_statement_lines
    FOR ALL USING (merchant_id IN (SELECT id FROM public.merchants WHERE owner_id = auth.uid()));
