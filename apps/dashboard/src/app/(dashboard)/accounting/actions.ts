'use server'

import { getAuthContext } from "@/lib/utils.server";
import { getIncomeStatement, getBalanceSheet, getAccountBalancesByPeriod, getLedger } from "@project1/accounting";
import { db, accounts, journalEntries, fiscalPeriods, journalLines } from "@project1/db";
import { eq, desc, and, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Fetches recent journal entries.
 */
export async function getJournalEntries() {
  const { merchant } = await getAuthContext();
  if (!merchant) throw new Error("Not authenticated");

  return await db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.merchantId, merchant.id))
    .orderBy(desc(journalEntries.date), desc(journalEntries.createdAt))
    .limit(100);
}

/**
 * Fetches all accounts for the merchant.
 */
export async function getAccounts() {
  const { merchant } = await getAuthContext();
  if (!merchant) throw new Error("Not authenticated");

  return await db.select().from(accounts).where(eq(accounts.merchantId, merchant.id));
}

/**
 * Fetches accounting overview data for the current month.
 */
export async function getAccountingOverview() {
  const { merchant } = await getAuthContext();
  if (!merchant) throw new Error("Not authenticated as merchant");

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const income = await getIncomeStatement(merchant.id, monthStart, today);
  const balance = await getBalanceSheet(merchant.id, today);

  return {
    income,
    balance,
  };
}

/**
 * Fetches the Trial Balance for a specific period.
 */
export async function getTrialBalance(from: Date, to: Date) {
  const { merchant } = await getAuthContext();
  if (!merchant) throw new Error("Not authenticated");

  return await getAccountBalancesByPeriod(merchant.id, from, to);
}

/**
 * Fetches fiscal periods for the merchant.
 */
export async function getFiscalPeriods() {
  const { merchant } = await getAuthContext();
  if (!merchant) throw new Error("Not authenticated");

  return await db
    .select()
    .from(fiscalPeriods)
    .where(eq(fiscalPeriods.merchantId, merchant.id))
    .orderBy(desc(fiscalPeriods.startDate));
}

/**
 * Creates a new account in the Chart of Accounts.
 */
export async function createAccount(data: any) {
  const { merchant } = await getAuthContext();
  if (!merchant) throw new Error("Not authenticated");

  const result = await db.insert(accounts).values({
    ...data,
    merchantId: merchant.id,
  }).returning();

  revalidatePath("/accounting/coa");
  return result[0];
}

/**
 * Updates an existing account.
 */
export async function updateAccount(id: string, data: any) {
  const { merchant } = await getAuthContext();
  if (!merchant) throw new Error("Not authenticated");

  const result = await db
    .update(accounts)
    .set({
      code: data.code,
      name: data.name,
      type: data.type,
      normalBalance: data.normalBalance,
      description: data.description,
      updatedAt: new Date(),
    })
    .where(and(eq(accounts.id, id), eq(accounts.merchantId, merchant.id)))
    .returning();

  revalidatePath("/accounting/coa");
  return result[0];
}

/**
 * Toggles an account active status.
 */
export async function toggleAccountStatus(id: string, isActive: boolean) {
  const { merchant } = await getAuthContext();
  if (!merchant) throw new Error("Not authenticated");

  const result = await db
    .update(accounts)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(accounts.id, id), eq(accounts.merchantId, merchant.id)))
    .returning();

  revalidatePath("/accounting/coa");
  return result[0];
}

/**
 * Initializes 12 fiscal periods for the current year.
 */
export async function setupFiscalPeriods() {
  const { merchant } = await getAuthContext();
  if (!merchant) throw new Error("Not authenticated");

  // Check if periods already exist to prevent duplicates
  const existing = await db
    .select()
    .from(fiscalPeriods)
    .where(eq(fiscalPeriods.merchantId, merchant.id))
    .limit(1);

  if (existing.length > 0) return;

  const currentYear = new Date().getFullYear();
  const periodsToCreate = [];

  const currentMonth = new Date().getMonth();

  for (let month = 0; month < 12; month++) {
    const startDate = new Date(currentYear, month, 1);
    const endDate = new Date(currentYear, month + 1, 0, 23, 59, 59);
    const name = startDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    // Only set the current month as OPEN, others as LOCKED
    const status = month === currentMonth ? 'OPEN' : 'LOCKED';

    periodsToCreate.push({
      merchantId: merchant.id,
      name,
      startDate,
      endDate,
      status,
    });
  }

  await db.insert(fiscalPeriods).values(periodsToCreate);

  revalidatePath("/accounting/periods");
}

/**
 * Opens a single new fiscal period.
 */
export async function openNewPeriod(data: { name: string, startDate: Date, endDate: Date }) {
  const { merchant } = await getAuthContext();
  if (!merchant) throw new Error("Not authenticated");

  const result = await db.insert(fiscalPeriods).values({
    ...data,
    merchantId: merchant.id,
    status: 'OPEN',
  }).returning();

  revalidatePath("/accounting/periods");
  return result[0];
}

/**
 * Updates the status of a fiscal period.
 */
export async function updateFiscalPeriodStatus(id: string, status: 'OPEN' | 'CLOSED' | 'LOCKED') {
  const { merchant, user } = await getAuthContext();
  if (!merchant) throw new Error("Not authenticated");

  const result = await db
    .update(fiscalPeriods)
    .set({ 
      status, 
      closedBy: status !== 'OPEN' ? user.id : null,
      closedAt: status !== 'OPEN' ? new Date() : null,
    })
    .where(and(eq(fiscalPeriods.id, id), eq(fiscalPeriods.merchantId, merchant.id)))
    .returning();

  revalidatePath("/accounting/periods");
  return result[0];
}

/**
 * Fetches the General Ledger for a specific account.
 */
export async function getAccountLedger(accountId: string, from?: Date, to?: Date) {
  const { merchant } = await getAuthContext();
  if (!merchant) throw new Error("Not authenticated");

  const startDate = from || new Date(new Date().getFullYear(), 0, 1); // Default to start of year
  const endDate = to || new Date();

  return await getLedger(merchant.id, accountId, startDate, endDate);
}

/**
 * Automatically locks all future periods and potentially previous ones to ensure only the current month is open.
 */
export async function fixPeriods() {
  const { merchant } = await getAuthContext();
  if (!merchant) throw new Error("Not authenticated");

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const periods = await db
    .select()
    .from(fiscalPeriods)
    .where(eq(fiscalPeriods.merchantId, merchant.id));

  for (const period of periods) {
    const periodDate = new Date(period.startDate);
    const isCurrent = periodDate.getMonth() === currentMonth && periodDate.getFullYear() === currentYear;
    
    let newStatus: 'OPEN' | 'LOCKED' | 'CLOSED' = period.status as any;
    
    if (isCurrent) {
        newStatus = 'OPEN';
    } else if (periodDate > today) {
        newStatus = 'LOCKED';
    } else if (periodDate < today && period.status === 'OPEN') {
        newStatus = 'CLOSED';
    }

    if (newStatus !== period.status) {
        await db.update(fiscalPeriods)
            .set({ status: newStatus })
            .where(eq(fiscalPeriods.id, period.id));
    }
  }

  revalidatePath("/accounting/periods");
}

/**
 * Creates a manual journal entry with multiple lines.
 * Validates that total debits equal total credits.
 */
export async function createManualJournalEntry(data: {
  date: Date;
  description: string;
  lines: { accountId: string; debit: number; credit: number; description?: string }[];
}) {
  const { merchant, user } = await getAuthContext();
  if (!merchant) throw new Error("Not authenticated");

  // Basic Validation
  if (data.lines.length < 2) throw new Error("Journal entry must have at least 2 lines");
  
  const totalDebits = data.lines.reduce((sum, l) => sum + Number(l.debit), 0);
  const totalCredits = data.lines.reduce((sum, l) => sum + Number(l.credit), 0);

  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    throw new Error(`Total Debits (${totalDebits}) must equal Total Credits (${totalCredits})`);
  }

  // Generate Entry Number (e.g., JE-2026-0001)
  const entryCountResult = await db
    .select({ val: count() })
    .from(journalEntries)
    .where(eq(journalEntries.merchantId, merchant.id));
  
  const entryNumber = `JE-${new Date().getFullYear()}-${(Number(entryCountResult[0].val) + 1).toString().padStart(4, '0')}`;

  const result = await db.transaction(async (tx) => {
    // 1. Create Entry
    const [entry] = await tx.insert(journalEntries).values({
      merchantId: merchant.id,
      entryNumber,
      date: data.date,
      description: data.description,
      sourceType: 'MANUAL',
      postedBy: user.id,
      postedAt: new Date(),
    }).returning();

    // 2. Create Lines
    await tx.insert(journalLines).values(
      data.lines.map(l => ({
        journalEntryId: entry.id,
        accountId: l.accountId,
        debit: l.debit.toString(),
        credit: l.credit.toString(),
        description: l.description || data.description,
      }))
    );

    return entry;
  });

  revalidatePath("/accounting/journal");
  return result;
}

/**
 * Fetches a single journal entry with its lines.
 */
export async function getJournalEntry(id: string) {
  const { merchant } = await getAuthContext();
  if (!merchant) throw new Error("Not authenticated");

  const entry = await db
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.id, id), eq(journalEntries.merchantId, merchant.id)))
    .limit(1);

  if (entry.length === 0) return null;

  const lines = await db
    .select()
    .from(journalLines)
    .where(eq(journalLines.journalEntryId, id));

  return {
    ...entry[0],
    lines,
  };
}

/**
 * Updates an existing journal entry and its lines.
 */
export async function updateJournalEntry(id: string, data: {
  date: Date;
  description: string;
  lines: { accountId: string; debit: number; credit: number; description?: string }[];
}) {
  const { merchant } = await getAuthContext();
  if (!merchant) throw new Error("Not authenticated");

  // Basic Validation
  if (data.lines.length < 2) throw new Error("Journal entry must have at least 2 lines");
  
  const totalDebits = data.lines.reduce((sum, l) => sum + Number(l.debit), 0);
  const totalCredits = data.lines.reduce((sum, l) => sum + Number(l.credit), 0);

  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    throw new Error(`Total Debits (${totalDebits}) must equal Total Credits (${totalCredits})`);
  }

  await db.transaction(async (tx) => {
    // 1. Update Entry
    await tx.update(journalEntries)
      .set({
        date: data.date,
        description: data.description,
      })
      .where(and(eq(journalEntries.id, id), eq(journalEntries.merchantId, merchant.id)));

    // 2. Delete old lines
    await tx.delete(journalLines).where(eq(journalLines.journalEntryId, id));

    // 3. Insert new lines
    await tx.insert(journalLines).values(
      data.lines.map(l => ({
        journalEntryId: id,
        accountId: l.accountId,
        debit: l.debit.toString(),
        credit: l.credit.toString(),
        description: l.description || data.description,
      }))
    );
  });

  revalidatePath("/accounting/journal");
  revalidatePath(`/accounting/journal/${id}`);
}
