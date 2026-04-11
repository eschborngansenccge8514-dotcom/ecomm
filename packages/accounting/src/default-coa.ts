export const DEFAULT_CHART_OF_ACCOUNTS = [
  // ── ASSETS (1xxx) ────────────────────────────────────
  { code: '1000', name: 'Current Assets',        type: 'ASSET',     normalBalance: 'DEBIT', isSystemAccount: true },
  { code: '1100', name: 'Cash & Bank',           type: 'ASSET',     normalBalance: 'DEBIT', isSystemAccount: true },
  { code: '1110', name: 'Petty Cash',            type: 'ASSET',     normalBalance: 'DEBIT', isSystemAccount: true },
  { code: '1120', name: 'Bank Account - MYB',    type: 'ASSET',     normalBalance: 'DEBIT', isSystemAccount: false },
  { code: '1200', name: 'Accounts Receivable',   type: 'ASSET',     normalBalance: 'DEBIT', isSystemAccount: true },
  { code: '1300', name: 'Inventory',             type: 'ASSET',     normalBalance: 'DEBIT', isSystemAccount: true },
  { code: '1400', name: 'Prepaid Expenses',      type: 'ASSET',     normalBalance: 'DEBIT', isSystemAccount: false },
  { code: '1800', name: 'Fixed Assets',          type: 'ASSET',     normalBalance: 'DEBIT', isSystemAccount: true },

  // ── LIABILITIES (2xxx) ───────────────────────────────
  { code: '2000', name: 'Current Liabilities',   type: 'LIABILITY', normalBalance: 'CREDIT', isSystemAccount: true },
  { code: '2100', name: 'Accounts Payable',      type: 'LIABILITY', normalBalance: 'CREDIT', isSystemAccount: true },
  { code: '2200', name: 'SST Payable',           type: 'LIABILITY', normalBalance: 'CREDIT', isSystemAccount: true },
  { code: '2300', name: 'Payroll Liabilities',   type: 'LIABILITY', normalBalance: 'CREDIT', isSystemAccount: true },
  { code: '2310', name: 'EPF Payable',           type: 'LIABILITY', normalBalance: 'CREDIT', isSystemAccount: true },
  { code: '2320', name: 'SOCSO Payable',         type: 'LIABILITY', normalBalance: 'CREDIT', isSystemAccount: true },
  { code: '2330', name: 'EIS Payable',           type: 'LIABILITY', normalBalance: 'CREDIT', isSystemAccount: true },
  { code: '2400', name: 'Deferred Revenue',      type: 'LIABILITY', normalBalance: 'CREDIT', isSystemAccount: false },

  // ── EQUITY (3xxx) ────────────────────────────────────
  { code: '3000', name: 'Owner Equity',          type: 'EQUITY',    normalBalance: 'CREDIT', isSystemAccount: true },
  { code: '3100', name: 'Retained Earnings',     type: 'EQUITY',    normalBalance: 'CREDIT', isSystemAccount: true },
  { code: '3200', name: 'Owner Drawings',        type: 'EQUITY',    normalBalance: 'DEBIT',  isSystemAccount: false },

  // ── REVENUE (4xxx) ───────────────────────────────────
  { code: '4000', name: 'Sales Revenue',         type: 'REVENUE',   normalBalance: 'CREDIT', isSystemAccount: true },
  { code: '4100', name: 'Service Revenue',       type: 'REVENUE',   normalBalance: 'CREDIT', isSystemAccount: false },
  { code: '4200', name: 'Marketplace Revenue',   type: 'REVENUE',   normalBalance: 'CREDIT', isSystemAccount: false },
  { code: '4900', name: 'Other Income',          type: 'REVENUE',   normalBalance: 'CREDIT', isSystemAccount: false },

  // ── EXPENSES (5xxx–9xxx) ─────────────────────────────
  { code: '5000', name: 'Cost of Goods Sold',    type: 'EXPENSE',   normalBalance: 'DEBIT',  isSystemAccount: true },
  { code: '6000', name: 'Operating Expenses',    type: 'EXPENSE',   normalBalance: 'DEBIT',  isSystemAccount: true },
  { code: '6100', name: 'Salaries & Wages',      type: 'EXPENSE',   normalBalance: 'DEBIT',  isSystemAccount: true },
  { code: '6200', name: 'Rent Expense',          type: 'EXPENSE',   normalBalance: 'DEBIT',  isSystemAccount: false },
  { code: '6300', name: 'Utilities',             type: 'EXPENSE',   normalBalance: 'DEBIT',  isSystemAccount: false },
  { code: '6400', name: 'Marketing & Ads',       type: 'EXPENSE',   normalBalance: 'DEBIT',  isSystemAccount: false },
  { code: '6500', name: 'Payment Gateway Fees',  type: 'EXPENSE',   normalBalance: 'DEBIT',  isSystemAccount: true },
  { code: '6600', name: 'Delivery Charges',      type: 'EXPENSE',   normalBalance: 'DEBIT',  isSystemAccount: false },
  { code: '6700', name: 'Depreciation',          type: 'EXPENSE',   normalBalance: 'DEBIT',  isSystemAccount: false },
] as const;
