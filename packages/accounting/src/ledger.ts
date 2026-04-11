import { db, journalEntries, journalLines, accounts } from '@project1/db';
import { eq, and, gte, lte, lt, sql } from 'drizzle-orm';

/**
 * Calculates the opening balance for an account as of a specific date.
 */
export async function getOpeningBalance(
  merchantId: string,
  accountId: string,
  before: Date
) {
  const [result] = await db
    .select({
      totalDebit:  sql<string>`sum(${journalLines.debit})`,
      totalCredit: sql<string>`sum(${journalLines.credit})`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .where(and(
      eq(journalEntries.merchantId, merchantId),
      eq(journalLines.accountId, accountId),
      lt(journalEntries.date, before),
      eq(journalEntries.status, 'POSTED')
    ));

  // Get account info to determine normal balance
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  const net = Number(result?.totalDebit || 0) - Number(result?.totalCredit || 0);
  
  if (account?.normalBalance === 'CREDIT') {
    return -net;
  }
  return net;
}

/**
 * Fetches the General Ledger for a specific account over a date range.
 * Includes opening balance and running balance.
 */
export async function getLedger(
  merchantId: string,
  accountId: string,
  from: Date,
  to: Date
) {
  // 1. Get Opening Balance
  const openingBalance = await getOpeningBalance(merchantId, accountId, from);

  // 2. Fetch Entries
  const entries = await db
    .select({
      id:          journalEntries.id,
      date:        journalEntries.date,
      entryNumber: journalEntries.entryNumber,
      description: journalEntries.description,
      sourceType:  journalEntries.sourceType,
      sourceRef:   journalEntries.sourceRef,
      debit:       journalLines.debit,
      credit:      journalLines.credit,
      lineDescription: journalLines.description,
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
    .orderBy(journalEntries.date, journalEntries.createdAt);

  // 3. Get Account Info
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  const isCredit = account?.normalBalance === 'CREDIT';

  // 4. Compute Running Balance
  let currentBalance = openingBalance;
  const ledgerEntries = entries.map(e => {
    const debitAmount = Number(e.debit || 0);
    const creditAmount = Number(e.credit || 0);
    
    if (isCredit) {
      currentBalance += (creditAmount - debitAmount);
    } else {
      currentBalance += (debitAmount - creditAmount);
    }

    return {
      ...e,
      runningBalance: currentBalance,
    };
  });

  return {
    account,
    openingBalance,
    entries: ledgerEntries,
    closingBalance: currentBalance,
  };
}

/**
 * Aggregates balances for all accounts within a specific period.
 * Useful for Income Statements and Trial Balances.
 */
export async function getAccountBalancesByPeriod(
  merchantId: string,
  from: Date,
  to: Date
) {
  const results = await db
    .select({
      accountId:     journalLines.accountId,
      code:          accounts.code,
      name:          accounts.name,
      type:          accounts.type,
      normalBalance: accounts.normalBalance,
      totalDebit:    sql<string>`sum(${journalLines.debit})`,
      totalCredit:   sql<string>`sum(${journalLines.credit})`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(and(
      eq(journalEntries.merchantId, merchantId),
      gte(journalEntries.date, from),
      lte(journalEntries.date, to),
      eq(journalEntries.status, 'POSTED')
    ))
    .groupBy(journalLines.accountId, accounts.code, accounts.name, accounts.type, accounts.normalBalance);

  return results.map(r => {
    const net = Number(r.totalDebit || 0) - Number(r.totalCredit || 0);
    const balance = r.normalBalance === 'DEBIT' ? net : -net;
    return {
      id: r.accountId,
      code: r.code,
      name: r.name,
      type: r.type,
      balance,
    };
  });
}

/**
 * Calculates net profit for a specific period.
 */
export async function getNetProfit(merchantId: string, from: Date, to: Date) {
  const balances = await getAccountBalancesByPeriod(merchantId, from, to);
  const revenue  = balances.filter(a => a.type === 'REVENUE').reduce((s, a) => s + a.balance, 0);
  const expenses = balances.filter(a => a.type === 'EXPENSE').reduce((s, a) => s + a.balance, 0);
  return revenue - expenses;
}
