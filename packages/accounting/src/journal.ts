import { db, journalEntries, journalLines, fiscalPeriods, accounts } from '@project1/db';
import { eq, and, lte, gte, ne } from 'drizzle-orm';

export interface JournalLineInput {
  accountId:      string;
  debit:          number;
  credit:         number;
  description?:   string;
  currency?:      string;
}

export interface JournalEntryInput {
  merchantId:     string;
  date:           Date;
  description:    string;
  sourceType:     string;
  sourceRef?:     string;
  status?:        'DRAFT' | 'POSTED' | 'REVERSED';
  reversalOfId?:  string;
  postedBy?:      string;
  lines:          JournalLineInput[];
}

/**
 * Checks if a date falls within an open fiscal period.
 */
export async function isPeriodOpen(merchantId: string, date: Date) {
  const closed = await db
    .select()
    .from(fiscalPeriods)
    .where(and(
      eq(fiscalPeriods.merchantId, merchantId),
      lte(fiscalPeriods.startDate, date),
      gte(fiscalPeriods.endDate, date),
      ne(fiscalPeriods.status, 'OPEN')
    ))
    .limit(1);
    
  return closed.length === 0;
}

export async function insertJournalEntry(input: JournalEntryInput) {
  const { lines, ...header } = input;

  // 1. Period Validation: Cannot post to closed periods
  const open = await isPeriodOpen(header.merchantId, header.date);
  if (!open) {
    throw new Error(`Cannot post to a closed fiscal period for date ${header.date.toDateString()}`);
  }

  // 2. Balance Validation: Debits must equal Credits
  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error(`Journal entry is unbalanced: debits=${totalDebit} credits=${totalCredit}`);
  }

  // 3. Status Validation
  if (header.reversalOfId && header.status !== 'REVERSED') {
    // Reversals should typically be marked as such
  }

  return await db.transaction(async (tx) => {
    const entryNumber = `JE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const [entry] = await tx.insert(journalEntries).values({
      merchantId:   header.merchantId,
      entryNumber:  entryNumber,
      date:         header.date,
      description:  header.description,
      sourceType:   header.sourceType,
      sourceRef:    header.sourceRef,
      status:       header.status ?? 'POSTED',
      reversalOfId: header.reversalOfId,
      postedBy:     header.postedBy,
      postedAt:     new Date(),
    }).returning();

    await tx.insert(journalLines).values(lines.map(line => ({
      journalEntryId: entry.id,
      accountId:      line.accountId,
      debit:          line.debit.toString(),
      credit:         line.credit.toString(),
      description:    line.description,
      currency:       line.currency ?? 'MYR',
    })));

    return entry;
  });
}

/**
 * Reverses an existing journal entry by creating an exact opposite entry.
 */
export async function reverseJournalEntry(entryId: string, userId: string) {
  // 1. Fetch original
  const [original] = await db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.id, entryId))
    .limit(1);

  if (!original) throw new Error('Original journal entry not found');
  if (original.status === 'REVERSED') throw new Error('Journal entry is already reversed');

  const lines = await db
    .select()
    .from(journalLines)
    .where(eq(journalLines.journalEntryId, entryId));

  // 2. Create reversal input (swap debit/credit)
  const reversalLines: JournalLineInput[] = lines.map(line => ({
    accountId: line.accountId,
    debit:     Number(line.credit || 0),
    credit:    Number(line.debit || 0),
    description: `REVERSAL: ${line.description || 'No description'}`,
    currency:  line.currency || 'MYR'
  }));

  // 3. Post (today's date is often used for reversals if the old period is closed, 
  // but here we use original date and let validation handle it)
  return await insertJournalEntry({
    merchantId:  original.merchantId,
    date:         new Date(), // Reversals are usually posted on the day they are made
    description:  `REVERSAL of ${original.entryNumber}: ${original.description}`,
    sourceType:   original.sourceType,
    sourceRef:    original.sourceRef ?? undefined,
    reversalOfId: original.id,
    postedBy:     userId,
    status:       'REVERSED',
    lines:        reversalLines,
  });
}

/**
 * Exports a flat list of journal lines for audit purposes (CSV).
 * Required for LHDN audit compliance in Malaysia.
 */
export async function exportJournalToCSV(merchantId: string, from: Date, to: Date) {
  const entries = await db
    .select({
      date:        journalEntries.date,
      entryNumber: journalEntries.entryNumber,
      totalDesc:   journalEntries.description,
      sourceType:  journalEntries.sourceType,
      sourceRef:   journalEntries.sourceRef,
      status:      journalEntries.status,
      accountCode: accounts.code,
      accountName: accounts.name,
      debit:       journalLines.debit,
      credit:      journalLines.credit,
      lineDesc:    journalLines.description,
    })
    .from(journalEntries)
    .innerJoin(journalLines, eq(journalEntries.id, journalLines.journalEntryId))
    .innerJoin(accounts,      eq(journalLines.accountId,      accounts.id))
    .where(and(
      eq(journalEntries.merchantId, merchantId),
      gte(journalEntries.date, from),
      lte(journalEntries.date, to)
    ))
    .orderBy(journalEntries.date, journalEntries.createdAt);

  const headers = ['Date', 'Entry Number', 'Journal Description', 'Source Type', 'Source Ref', 'Status', 'Account Code', 'Account Name', 'Line Description', 'Debit', 'Credit'];
  
  const rows = entries.map(e => [
    e.date.toISOString(),
    `"${e.entryNumber}"`,
    `"${e.totalDesc.replace(/"/g, '""')}"`,
    e.sourceType,
    e.sourceRef || '',
    e.status,
    `"${e.accountCode}"`,
    `"${e.accountName.replace(/"/g, '""')}"`,
    `"${(e.lineDesc || '').replace(/"/g, '""')}"`,
    e.debit,
    e.credit
  ]);

  return [headers, ...rows].map(r => r.join(',')).join('\n');
}
