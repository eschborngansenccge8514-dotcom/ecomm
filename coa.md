<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Write a full implementation for what's missing starting with "No GL/chart of accounts visible; Analytics ≠ Accounting"

Here is the full implementation plan for building a proper **Accounting Engine** — General Ledger, Chart of Accounts, financial statements, and auto-posting from your existing modules — directly into your monorepo stack.

***

## The Core Concept: Analytics ≠ Accounting

Analytics tells you *what happened in sales*. Accounting answers the question *where did the money go and what does the business owe?*. The difference is **double-entry bookkeeping** — every financial event creates two ledger entries (a debit and a credit) that must always balance. Your current Recharts dashboard has none of this. Without it, you cannot produce a P\&L, Balance Sheet, or Cash Flow Statement that any accountant, bank, or tax authority would accept.[^1][^2]

***

## Monorepo Placement

This lives as a new shared package and a dashboard section:

```
packages/
└── accounting/              # NEW — core ledger engine (shared)
    ├── src/
    │   ├── chart-of-accounts.ts
    │   ├── journal.ts
    │   ├── ledger.ts
    │   ├── auto-poster.ts   # converts POS/invoice events → journal entries
    │   └── reports/
    │       ├── income-statement.ts
    │       ├── balance-sheet.ts
    │       └── cash-flow.ts
    └── index.ts

apps/dashboard/
└── app/accounting/          # NEW — UI routes
    ├── chart-of-accounts/
    ├── journal/
    ├── ledger/
    └── reports/
```


***

## Phase 1 — Database Schema (Weeks 1–3)

This is the foundation everything else builds on. Add these tables to `packages/db` via Drizzle.[^3][^4]

**1.1 Chart of Accounts**

```typescript
// packages/db/src/schema/accounting.ts
import { pgTable, uuid, text, varchar, boolean,
         timestamp, integer, pgEnum, numeric } from 'drizzle-orm/pg-core';

export const accountTypeEnum = pgEnum('account_type', [
  'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'
]);

export const accountNormalBalanceEnum = pgEnum('normal_balance', [
  'DEBIT', 'CREDIT'
]);

// Chart of Accounts
export const accounts = pgTable('coa_accounts', {
  id:             uuid('id').primaryKey().defaultRandom(),
  merchantId:     uuid('merchant_id').notNull(),       // multi-tenant isolation
  code:           varchar('code', { length: 20 }).notNull(),  // e.g. "1100"
  name:           text('name').notNull(),               // e.g. "Cash & Bank"
  type:           accountTypeEnum('type').notNull(),
  normalBalance:  accountNormalBalanceEnum('normal_balance').notNull(),
  parentId:       uuid('parent_id'),                    // for hierarchy
  isSystemAccount: boolean('is_system_account').default(false), // locked accounts
  description:    text('description'),
  isActive:       boolean('is_active').default(true),
  createdAt:      timestamp('created_at').defaultNow(),
  updatedAt:      timestamp('updated_at').defaultNow(),
});
```

**1.2 Journal Entries (Immutable)**

Every financial event creates one `journal_entry` header with two or more `journal_lines`. The lines must always sum to zero — debits equal credits:[^5][^6]

```typescript
export const journalEntries = pgTable('journal_entries', {
  id:            uuid('id').primaryKey().defaultRandom(),
  merchantId:    uuid('merchant_id').notNull(),
  entryNumber:   text('entry_number').notNull(),        // JE-2026-00001
  date:          timestamp('date').notNull(),
  description:   text('description').notNull(),
  sourceType:    text('source_type').notNull(),          // 'POS' | 'INVOICE' | 'PAYROLL' | 'MANUAL'
  sourceRef:     text('source_ref'),                     // links back to txnRef, invoiceId, etc.
  status:        text('status').default('POSTED'),       // 'DRAFT' | 'POSTED' | 'REVERSED'
  reversalOfId:  uuid('reversal_of_id'),                 // for reversals
  postedBy:      uuid('posted_by'),
  postedAt:      timestamp('posted_at'),
  createdAt:     timestamp('created_at').defaultNow(),
});

export const journalLines = pgTable('journal_lines', {
  id:             uuid('id').primaryKey().defaultRandom(),
  journalEntryId: uuid('journal_entry_id').notNull(),
  accountId:      uuid('account_id').notNull(),
  debit:          numeric('debit', { precision: 15, scale: 2 }).default('0'),
  credit:         numeric('credit', { precision: 15, scale: 2 }).default('0'),
  description:    text('description'),
  currency:       varchar('currency', { length: 3 }).default('MYR'),
});
```

**1.3 PostgreSQL Constraint: Always Balanced**

Enforce the fundamental accounting equation at the database level — never rely on application code alone:[^4]

```sql
-- In a Supabase migration file
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
```

**1.4 Account Balances (Materialized for Performance)**

```sql
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

-- Refresh after each journal post (via Supabase Edge Function trigger)
CREATE UNIQUE INDEX ON account_balances (account_id, merchant_id);
```


***

## Phase 2 — Default Chart of Accounts (Weeks 2–3)

Seed every new merchant with a **Malaysian SME-appropriate default CoA**. Merchants can add custom accounts but cannot delete system accounts.[^7][^8]

```typescript
// packages/accounting/src/default-coa.ts
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
];
```


***

## Phase 3 — Auto-Poster: Convert Business Events to Journal Entries (Weeks 3–8)

This is the most critical integration layer. Every event in your existing modules — a POS sale, a paid invoice, a payroll run — must automatically post a balanced journal entry. No human should need to do manual data entry for routine transactions.[^6]

**3.1 Auto-Poster Architecture**

```
POS Sale Committed
       │
       ▼
Supabase DB Trigger / Edge Function
       │
       ▼
packages/accounting/auto-poster.ts
       │
       ├── lookupAccounts(merchantId)
       ├── buildJournalLines(event)
       ├── validateBalance(lines)           ← must sum to zero
       └── insertJournalEntry(header, lines)
```

**3.2 POS Sale → Journal Entry**

A cash sale of RM100 (6% SST = RM6, COGS = RM60):

```typescript
// packages/accounting/src/auto-poster.ts
import { db } from '@repo/db';
import { journalEntries, journalLines } from '@repo/db/schema/accounting';

export async function postPOSSale(txn: POSTransaction) {
  const accts = await getSystemAccounts(txn.merchantId);

  const lines = [
    // Money received (which payment method?)
    { accountId: accts.CASH_BANK,           debit: txn.totalAmount,  credit: 0 },
    // Revenue recorded
    { accountId: accts.SALES_REVENUE,       debit: 0,   credit: txn.subtotal },
    // SST collected — it's a liability, not revenue
    { accountId: accts.SST_PAYABLE,         debit: 0,   credit: txn.sstAmount },
    // Cost of Goods Sold (if COGS tracking is enabled)
    { accountId: accts.COGS,                debit: txn.cogsAmount,   credit: 0 },
    // Inventory reduced
    { accountId: accts.INVENTORY,           debit: 0,   credit: txn.cogsAmount },
  ];

  await insertJournalEntry({
    merchantId:  txn.merchantId,
    date:        txn.createdAt,
    description: `POS Sale — ${txn.txnRef}`,
    sourceType:  'POS',
    sourceRef:   txn.txnRef,
    lines,
  });
}
```

**3.3 Posting Map for All Modules**


| Business Event | Debit | Credit |
| :-- | :-- | :-- |
| **POS Cash Sale** | Cash \& Bank | Sales Revenue + SST Payable |
| **POS Card Sale** | Cash \& Bank (net) + Gateway Fees Expense | Sales Revenue + SST Payable |
| **E-Invoice Issued** | Accounts Receivable | Sales Revenue + SST Payable |
| **Invoice Payment Received** | Cash \& Bank | Accounts Receivable |
| **Purchase Order Received** | Inventory | Accounts Payable |
| **Supplier Invoice Paid** | Accounts Payable | Cash \& Bank |
| **Payroll Run** | Salaries Expense + EPF/SOCSO Expense | Payroll Liabilities |
| **Payroll Disbursed** | Payroll Liabilities | Cash \& Bank |
| **Customer Refund** | Sales Revenue | Cash \& Bank |
| **Loyalty Points Redeemed** | Deferred Revenue | Sales Revenue |
| **Marketplace Settlement** | Cash \& Bank | Marketplace Revenue |

**3.4 Supabase Edge Function Trigger**

Wire the auto-poster to DB events using a Supabase Edge Function:

```typescript
// supabase/functions/accounting-auto-post/index.ts
import { serve } from 'https://deno.land/std/http/server.ts';
import { postPOSSale, postInvoicePayment, postPayroll } from '@repo/accounting';

serve(async (req) => {
  const { type, record } = await req.json();  // Supabase webhook payload

  switch (type) {
    case 'pos.transaction.completed':
      await postPOSSale(record); break;
    case 'invoice.payment.received':
      await postInvoicePayment(record); break;
    case 'payroll.run.disbursed':
      await postPayroll(record); break;
  }

  return new Response('ok');
});
```


***

## Phase 4 — General Ledger Service (Weeks 6–9)

```typescript
// packages/accounting/src/ledger.ts
export async function getLedger(
  merchantId: string,
  accountId: string,
  from: Date,
  to: Date
) {
  const entries = await db
    .select({
      date:        journalEntries.date,
      entryNumber: journalEntries.entryNumber,
      description: journalEntries.description,
      sourceType:  journalEntries.sourceType,
      sourceRef:   journalEntries.sourceRef,
      debit:       journalLines.debit,
      credit:      journalLines.credit,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .where(and(
      eq(journalEntries.merchantId, merchantId),
      eq(journalLines.accountId, accountId),
      gte(journalEntries.date, from),
      lte(journalEntries.date, to),
      eq(journalEntries.status, 'POSTED')
    ))
    .orderBy(journalEntries.date);

  // Compute running balance
  let runningBalance = await getOpeningBalance(merchantId, accountId, from);
  return entries.map(e => {
    runningBalance += Number(e.debit) - Number(e.credit);
    return { ...e, runningBalance };
  });
}
```


***

## Phase 5 — Financial Statements (Weeks 9–13)

All three statements derive purely from the journal — no separate aggregation tables needed.[^1]

**5.1 Income Statement (P\&L)**

```typescript
// packages/accounting/src/reports/income-statement.ts
export async function getIncomeStatement(merchantId: string, from: Date, to: Date) {
  const balances = await getAccountBalancesByType(merchantId, from, to);

  const revenue  = balances.filter(a => a.type === 'REVENUE');
  const expenses = balances.filter(a => a.type === 'EXPENSE');

  const totalRevenue  = revenue.reduce((s, a) => s + a.balance, 0);
  const totalExpenses = expenses.reduce((s, a) => s + a.balance, 0);
  const grossProfit   = totalRevenue - balances
    .filter(a => a.code.startsWith('5'))  // COGS
    .reduce((s, a) => s + a.balance, 0);
  const netProfit     = totalRevenue - totalExpenses;

  return { revenue, expenses, totalRevenue, totalExpenses, grossProfit, netProfit };
}
```

**5.2 Balance Sheet**

```typescript
// packages/accounting/src/reports/balance-sheet.ts
// Balance Sheet is a POINT-IN-TIME snapshot — pass a single `asOf` date
export async function getBalanceSheet(merchantId: string, asOf: Date) {
  const balances = await getAccountBalancesByType(merchantId, new Date(0), asOf);

  const assets      = balances.filter(a => a.type === 'ASSET');
  const liabilities = balances.filter(a => a.type === 'LIABILITY');
  const equity      = balances.filter(a => a.type === 'EQUITY');

  // Roll retained earnings: beginning RE + net profit for the period
  const netProfit = await getNetProfit(merchantId, getYearStart(asOf), asOf);

  const totalAssets      = assets.reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0);
  const totalEquity      = equity.reduce((s, a) => s + a.balance, 0) + netProfit;

  // The accounting equation must hold: Assets = Liabilities + Equity
  console.assert(
    Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    'Balance sheet is out of balance!'
  );

  return { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity };
}
```

**5.3 Cash Flow Statement (Indirect Method)**

```typescript
// Simplified indirect method
export async function getCashFlowStatement(merchantId: string, from: Date, to: Date) {
  const netProfit         = await getNetProfit(merchantId, from, to);
  const arChange          = await getAccountChange(merchantId, '1200', from, to); // AR
  const inventoryChange   = await getAccountChange(merchantId, '1300', from, to);
  const apChange          = await getAccountChange(merchantId, '2100', from, to); // AP
  const depreciation      = await getAccountBalance(merchantId, '6700', from, to);

  const operatingCF = netProfit - arChange - inventoryChange + apChange + depreciation;

  return {
    operating: { netProfit, adjustments: { arChange, inventoryChange, apChange, depreciation }, total: operatingCF },
    investing:  { total: 0 },  // Extend later for capex
    financing:  { total: 0 },  // Extend later for loans/equity
    netChange:  operatingCF,
  };
}
```


***

## Phase 6 — Period Close \& Audit Trail (Weeks 12–15)

**6.1 Period Lock**

Add a `fiscal_periods` table. Once a period is closed, no new journal entries can be posted into it — only reversals in the next open period:[^5]

```typescript
export const fiscalPeriods = pgTable('fiscal_periods', {
  id:         uuid('id').primaryKey().defaultRandom(),
  merchantId: uuid('merchant_id').notNull(),
  name:       text('name').notNull(),          // "April 2026"
  startDate:  timestamp('start_date').notNull(),
  endDate:    timestamp('end_date').notNull(),
  status:     text('status').default('OPEN'),  // 'OPEN' | 'CLOSED' | 'LOCKED'
  closedBy:   uuid('closed_by'),
  closedAt:   timestamp('closed_at'),
});
```

**6.2 Journal Entry Reversal (Not Deletion)**

Accounting systems never delete — they reverse:[^5]

```typescript
export async function reverseJournalEntry(entryId: string, userId: string) {
  const original = await getJournalEntry(entryId);
  const reversalLines = original.lines.map(line => ({
    accountId: line.accountId,
    debit:     line.credit,    // swap debit ↔ credit
    credit:    line.debit,
  }));

  return insertJournalEntry({
    ...original,
    entryNumber:  generateEntryNumber(),
    description:  `REVERSAL of ${original.entryNumber}: ${original.description}`,
    reversalOfId: entryId,
    postedBy:     userId,
    lines:        reversalLines,
  });
}
```


***

## Phase 7 — Dashboard UI (Weeks 10–15)

**Key screens to build in `apps/dashboard/app/accounting/`:**


| Route | Screen | Description |
| :-- | :-- | :-- |
| `/accounting` | Accounting Home | P\&L snapshot, net profit widget, outstanding AR/AP |
| `/accounting/chart-of-accounts` | CoA Manager | Tree view of all accounts; add/edit custom accounts |
| `/accounting/journal` | Journal Log | Searchable, filterable list of all journal entries with drill-down |
| `/accounting/ledger/[accountId]` | Account Ledger | Running balance for a specific account over a date range |
| `/accounting/reports/income` | P\&L Report | Revenue vs. expenses breakdown, exportable to PDF/Excel |
| `/accounting/reports/balance-sheet` | Balance Sheet | Point-in-time assets/liabilities/equity view |
| `/accounting/reports/cash-flow` | Cash Flow | Monthly operating/investing/financing breakdown |
| `/accounting/periods` | Period Manager | Open/close fiscal periods; lock completed months |

**CoA Tree Component:**

```tsx
// apps/dashboard/app/accounting/chart-of-accounts/page.tsx
export function ChartOfAccountsTree({ accounts }: { accounts: Account[] }) {
  const tree = buildTree(accounts);  // nest children under parents

  return (
    <div className="font-mono text-sm">
      {['ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE'].map(type => (
        <AccountGroup key={type} type={type} accounts={tree[type]} />
      ))}
    </div>
  );
}

function AccountGroup({ type, accounts }) {
  const typeColors = {
    ASSET: 'text-blue-600', LIABILITY: 'text-red-600',
    EQUITY: 'text-purple-600', REVENUE: 'text-green-600', EXPENSE: 'text-orange-600'
  };
  return (
    <div className="mb-4">
      <div className={`font-bold uppercase ${typeColors[type]}`}>{type}</div>
      {accounts.map(a => (
        <div key={a.id} className="flex justify-between pl-4 py-1 hover:bg-muted">
          <span>{a.code} — {a.name}</span>
          <span className="tabular-nums">{formatMYR(a.balance)}</span>
        </div>
      ))}
    </div>
  );
}
```


***

## Phase 8 — Malaysia Tax Compliance (Weeks 13–16)

- **SST computation** — SST Payable account (2200) auto-accumulates from all taxable POS and invoice postings; generate a bi-monthly SST-02 filing report directly from this account's ledger[^7]
- **MyInvois linkage** — every e-invoice posting in `apps/einvoice-service` triggers an auto-post to Accounts Receivable (1200) and Sales Revenue (4000), keeping the two systems in perfect sync[^2]
- **EPF/SOCSO/EIS** — payroll auto-poster splits employer contribution into expense accounts (6100) and employee deductions into separate liability accounts (2310–2330), ready for monthly statutory payment reporting
- **Audit-ready export** — export any date range of journal entries as a signed PDF or structured CSV for LHDN audit requests

***

## Key Design Principles to Honour

- **Immutability above all** — never `UPDATE` or `DELETE` a posted journal entry; always reverse and re-post[^5]
- **Database-level balance enforcement** — the PostgreSQL trigger is your last line of defence; don't rely solely on application validation[^4]
- **Source traceability** — every auto-posted entry carries `sourceType` + `sourceRef` so you can always trace a ledger line back to the POS transaction, invoice, or payroll run that created it[^6]
- **Zero manual data entry for routine transactions** — the auto-poster should handle >95% of all journal entries; manual entries are for adjustments only
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^9]</span>

<div align="center">⁂</div>

[^1]: https://www.alaan.com/blog/gl-in-accounting-double-entry

[^2]: PROJECT_SUMMARY.md

[^3]: https://developer.squareup.com/blog/books-an-immutable-double-entry-accounting-database-service/

[^4]: https://gist.github.com/NYKevin/9433376

[^5]: https://www.moderntreasury.com/journal/how-to-scale-a-ledger-part-i

[^6]: https://finlego.com/blog/designing-a-real-time-ledger-system-with-double-entry-logic

[^7]: https://www.jocheojeda.com/2025/05/05/understanding-the-chart-of-accounts-module-day-3-the-backbone-of-financial-accounting-systems/

[^8]: https://www.cubesoftware.com/blog/chart-of-accounts

[^9]: https://www.balanced.software/double-entry-bookkeeping-for-programmers/

[^10]: https://anvil.works/blog/double-entry-accounting-for-engineers

[^11]: https://preview.hex.pm/preview/double_entry_ledger/show/README.md

[^12]: https://news.ycombinator.com/item?id=21276984

[^13]: https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-members/the-chart-of-accounts-concept-sap-design-r-3-to-s-4hana/ba-p/13450190

[^14]: https://www.linkedin.com/posts/ahmedeltahir_fintech-ledger-accountingengine-activity-7423919979311538176-1Y3V

[^15]: https://hexdocs.pm/double_entry_ledger/

[^16]: https://www.deloitte.com/us/en/services/consulting/articles/chart-of-accounts-design.html

