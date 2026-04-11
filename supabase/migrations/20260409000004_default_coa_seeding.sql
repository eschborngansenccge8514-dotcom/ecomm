-- Accounting Engine Phase 2: Default Chart of Accounts Seeding

-- Add unique constraint to prevent duplicate accounts for the same merchant
ALTER TABLE coa_accounts ADD CONSTRAINT unique_merchant_account_code UNIQUE (merchant_id, code);

-- Seeding Function
CREATE OR REPLACE FUNCTION seed_merchant_coa(p_merchant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO coa_accounts (merchant_id, code, name, type, normal_balance, is_system_account)
  VALUES 
    -- ASSETS (1xxx)
    (p_merchant_id, '1000', 'Current Assets',        'ASSET',     'DEBIT', true),
    (p_merchant_id, '1100', 'Cash & Bank',           'ASSET',     'DEBIT', true),
    (p_merchant_id, '1110', 'Petty Cash',            'ASSET',     'DEBIT', true),
    (p_merchant_id, '1120', 'Bank Account - MYB',    'ASSET',     'DEBIT', false),
    (p_merchant_id, '1200', 'Accounts Receivable',   'ASSET',     'DEBIT', true),
    (p_merchant_id, '1300', 'Inventory',             'ASSET',     'DEBIT', true),
    (p_merchant_id, '1400', 'Prepaid Expenses',      'ASSET',     'DEBIT', false),
    (p_merchant_id, '1800', 'Fixed Assets',          'ASSET',     'DEBIT', true),

    -- LIABILITIES (2xxx)
    (p_merchant_id, '2000', 'Current Liabilities',   'LIABILITY', 'CREDIT', true),
    (p_merchant_id, '2100', 'Accounts Payable',      'LIABILITY', 'CREDIT', true),
    (p_merchant_id, '2200', 'SST Payable',           'LIABILITY', 'CREDIT', true),
    (p_merchant_id, '2300', 'Payroll Liabilities',   'LIABILITY', 'CREDIT', true),
    (p_merchant_id, '2310', 'EPF Payable',           'LIABILITY', 'CREDIT', true),
    (p_merchant_id, '2320', 'SOCSO Payable',         'LIABILITY', 'CREDIT', true),
    (p_merchant_id, '2330', 'EIS Payable',           'LIABILITY', 'CREDIT', true),
    (p_merchant_id, '2400', 'Deferred Revenue',      'LIABILITY', 'CREDIT', false),

    -- EQUITY (3xxx)
    (p_merchant_id, '3000', 'Owner Equity',          'EQUITY',    'CREDIT', true),
    (p_merchant_id, '3100', 'Retained Earnings',     'EQUITY',    'CREDIT', true),
    (p_merchant_id, '3200', 'Owner Drawings',        'EQUITY',    'DEBIT',  false),

    -- REVENUE (4xxx)
    (p_merchant_id, '4000', 'Sales Revenue',         'REVENUE',   'CREDIT', true),
    (p_merchant_id, '4100', 'Service Revenue',       'REVENUE',   'CREDIT', false),
    (p_merchant_id, '4200', 'Marketplace Revenue',   'REVENUE',   'CREDIT', false),
    (p_merchant_id, '4900', 'Other Income',          'REVENUE',   'CREDIT', false),

    -- EXPENSES (5xxx–9xxx)
    (p_merchant_id, '5000', 'Cost of Goods Sold',    'EXPENSE',   'DEBIT',  true),
    (p_merchant_id, '6000', 'Operating Expenses',    'EXPENSE',   'DEBIT',  true),
    (p_merchant_id, '6100', 'Salaries & Wages',      'EXPENSE',   'DEBIT',  true),
    (p_merchant_id, '6200', 'Rent Expense',          'EXPENSE',   'DEBIT',  false),
    (p_merchant_id, '6300', 'Utilities',             'EXPENSE',   'DEBIT',  false),
    (p_merchant_id, '6400', 'Marketing & Ads',       'EXPENSE',   'DEBIT',  false),
    (p_merchant_id, '6500', 'Payment Gateway Fees',  'EXPENSE',   'DEBIT',  true),
    (p_merchant_id, '6600', 'Delivery Charges',      'EXPENSE',   'DEBIT',  false),
    (p_merchant_id, '6700', 'Depreciation',          'EXPENSE',   'DEBIT',  false)
  ON CONFLICT (merchant_id, code) DO NOTHING;
END;
$$;
