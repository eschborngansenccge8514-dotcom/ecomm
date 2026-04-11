import { pgTable, uuid, text, varchar, boolean, timestamp, numeric, pgEnum, index } from 'drizzle-orm/pg-core';

export const accountTypeEnum = pgEnum('account_type', [
  'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'
]);

export const accountNormalBalanceEnum = pgEnum('normal_balance', [
  'DEBIT', 'CREDIT'
]);

// Chart of Accounts
export const accounts = pgTable('coa_accounts', {
  id:             uuid('id').primaryKey().defaultRandom(),
  merchantId:     uuid('merchant_id').notNull(),
  code:           varchar('code', { length: 20 }).notNull(),
  name:           text('name').notNull(),
  type:           accountTypeEnum('type').notNull(),
  normalBalance:  accountNormalBalanceEnum('normal_balance').notNull(),
  parentId:       uuid('parent_id'),
  isSystemAccount: boolean('is_system_account').default(false),
  description:    text('description'),
  isActive:       boolean('is_active').default(true),
  createdAt:      timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  idxCoaMerchant: index("idx_coa_merchant").on(t.merchantId),
}));

export const journalEntries = pgTable('journal_entries', {
  id:            uuid('id').primaryKey().defaultRandom(),
  merchantId:    uuid('merchant_id').notNull(),
  entryNumber:   text('entry_number').notNull(),
  date:          timestamp('date', { withTimezone: true }).notNull(),
  description:   text('description').notNull(),
  sourceType:    text('source_type').notNull(),
  sourceRef:     text('source_ref'),
  status:        text('status').default('POSTED'),
  reversalOfId:  uuid('reversal_of_id'),
  postedBy:      uuid('posted_by'),
  postedAt:      timestamp('posted_at', { withTimezone: true }),
  createdAt:     timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  idxJeMerchant: index("idx_je_merchant").on(t.merchantId),
  idxJeDate: index("idx_je_date").on(t.date),
}));

export const journalLines = pgTable('journal_lines', {
  id:             uuid('id').primaryKey().defaultRandom(),
  journalEntryId: uuid('journal_entry_id').notNull(),
  accountId:      uuid('account_id').notNull(),
  debit:          numeric('debit', { precision: 15, scale: 2 }).default('0'),
  credit:         numeric('credit', { precision: 15, scale: 2 }).default('0'),
  description:    text('description'),
  currency:       varchar('currency', { length: 3 }).default('MYR'),
}, (t) => ({
  idxJlEntry: index("idx_jl_entry").on(t.journalEntryId),
  idxJlAccount: index("idx_jl_account").on(t.accountId),
}));

export const fiscalPeriods = pgTable('fiscal_periods', {
  id:         uuid('id').primaryKey().defaultRandom(),
  merchantId: uuid('merchant_id').notNull(),
  name:       text('name').notNull(),          // e.g., "April 2026"
  startDate:  timestamp('start_date', { withTimezone: true }).notNull(),
  endDate:    timestamp('end_date', { withTimezone: true }).notNull(),
  status:     text('status').default('OPEN'),  // 'OPEN' | 'CLOSED' | 'LOCKED'
  closedBy:   uuid('closed_by'),
  closedAt:   timestamp('closed_at', { withTimezone: true }),
}, (t) => ({
  idxFpMerchant: index("idx_fp_merchant").on(t.merchantId),
}));
