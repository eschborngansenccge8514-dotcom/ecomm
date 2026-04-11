-- Add payment_account_id to expenses table to link with bank_accounts
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS payment_account_id UUID REFERENCES public.coa_accounts(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_expenses_payment_account ON public.expenses(payment_account_id);

-- Note: In the Drizzle schema it was just a UUID, but usually this points to a COA account
-- defined in bank_accounts.coa_account_id or directly to coa_accounts.
-- Looking at auto-poster.ts, it uses the accountId directly in journal lines.
