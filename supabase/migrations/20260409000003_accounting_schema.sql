-- Accounting Engine Phase 1: Database Schema

-- Enums
CREATE TYPE account_type AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
CREATE TYPE normal_balance AS ENUM ('DEBIT', 'CREDIT');

-- Chart of Accounts
CREATE TABLE coa_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  code varchar(20) NOT NULL,
  name text NOT NULL,
  type account_type NOT NULL,
  normal_balance normal_balance NOT NULL,
  parent_id uuid REFERENCES coa_accounts(id),
  is_system_account boolean DEFAULT false,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Journal Entries
CREATE TABLE journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  entry_number text NOT NULL,
  date timestamptz NOT NULL,
  description text NOT NULL,
  source_type text NOT NULL,          -- 'POS' | 'INVOICE' | 'PAYROLL' | 'MANUAL'
  source_ref text,                     -- links back to txnRef, invoiceId, etc.
  status text DEFAULT 'POSTED',       -- 'DRAFT' | 'POSTED' | 'REVERSED'
  reversal_of_id uuid REFERENCES journal_entries(id),
  posted_by uuid,
  posted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Journal Lines
CREATE TABLE journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES coa_accounts(id),
  debit numeric(15, 2) DEFAULT 0,
  credit numeric(15, 2) DEFAULT 0,
  description text,
  currency varchar(3) DEFAULT 'MYR'
);

-- Indexes
CREATE INDEX idx_coa_merchant ON coa_accounts(merchant_id);
CREATE INDEX idx_je_merchant ON journal_entries(merchant_id);
CREATE INDEX idx_je_date ON journal_entries(date);
CREATE INDEX idx_jl_entry ON journal_lines(journal_entry_id);
CREATE INDEX idx_jl_account ON journal_lines(account_id);

-- RLS Policies
ALTER TABLE coa_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchant_own_coa" ON coa_accounts
  USING (merchant_id = (SELECT id FROM merchants WHERE owner_id = auth.uid() LIMIT 1));

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchant_own_journal_entries" ON journal_entries
  USING (merchant_id = (SELECT id FROM merchants WHERE owner_id = auth.uid() LIMIT 1));

ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchant_own_journal_lines" ON journal_lines
  USING (EXISTS (
    SELECT 1 FROM journal_entries 
    WHERE journal_entries.id = journal_lines.journal_entry_id 
    AND journal_entries.merchant_id = (SELECT id FROM merchants WHERE owner_id = auth.uid() LIMIT 1)
  ));

-- 1.3 PostgreSQL Constraint: Always Balanced
CREATE OR REPLACE FUNCTION check_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
  total_debit  NUMERIC;
  total_credit NUMERIC;
BEGIN
  SELECT
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO total_debit, total_credit
  FROM journal_lines
  WHERE journal_entry_id = NEW.journal_entry_id;

  IF total_debit <> total_credit THEN
    RAISE EXCEPTION 'Journal entry is unbalanced: debits=% credits=%',
      total_debit, total_credit;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER enforce_journal_balance
AFTER INSERT OR UPDATE ON journal_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_journal_balance();

-- 1.4 Account Balances (Materialized for Performance)
CREATE MATERIALIZED VIEW account_balances AS
SELECT
  jl.account_id,
  je.merchant_id,
  a.type,
  a.normal_balance,
  SUM(jl.debit)  AS total_debits,
  SUM(jl.credit) AS total_credits,
  CASE a.normal_balance
    WHEN 'DEBIT'  THEN SUM(jl.debit)  - SUM(jl.credit)
    WHEN 'CREDIT' THEN SUM(jl.credit) - SUM(jl.debit)
  END AS balance
FROM journal_lines jl
JOIN journal_entries je ON jl.journal_entry_id = je.id
JOIN coa_accounts a    ON jl.account_id = a.id
WHERE je.status = 'POSTED'
GROUP BY jl.account_id, je.merchant_id, a.type, a.normal_balance;

CREATE UNIQUE INDEX idx_account_balances_unique ON account_balances (account_id, merchant_id);

-- Helper function to refresh balance view
CREATE OR REPLACE FUNCTION refresh_account_balances()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY account_balances;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to refresh view after journal entries are posted
CREATE TRIGGER refresh_balances_on_journal_line
AFTER INSERT OR UPDATE OR DELETE ON journal_lines
FOR EACH STATEMENT EXECUTE FUNCTION refresh_account_balances();
