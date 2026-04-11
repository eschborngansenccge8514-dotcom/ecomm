import { db, accounts } from '@project1/db';
import { eq, and, inArray } from 'drizzle-orm';
import { DEFAULT_CHART_OF_ACCOUNTS } from './default-coa';

export type DefaultAccount = typeof DEFAULT_CHART_OF_ACCOUNTS[number];

/**
 * Returns a default account by its code.
 */
export function getDefaultAccountByCode(code: string): DefaultAccount | undefined {
  return DEFAULT_CHART_OF_ACCOUNTS.find(a => a.code === code);
}

/**
 * Returns all system accounts definitions.
 */
export function getSystemAccountDefinitions() {
  return DEFAULT_CHART_OF_ACCOUNTS.filter(a => a.isSystemAccount);
}

/**
 * Fetches the IDs of system accounts for a specific merchant.
 */
export async function getSystemAccountsByMerchant(merchantId: string) {
  const systemCodes = DEFAULT_CHART_OF_ACCOUNTS
    .map(a => a.code); // Get all codes to be safe, or just system ones

  const results = await db
    .select()
    .from(accounts)
    .where(and(
      eq(accounts.merchantId, merchantId),
      inArray(accounts.code, systemCodes)
    ));

  const accountMap: Record<string, string> = {};
  results.forEach(a => {
    accountMap[a.code] = a.id;
  });

  return {
    CASH_BANK:      accountMap['1100'],
    PETTY_CASH:     accountMap['1110'],
    RECEIVABLES:    accountMap['1200'],
    INVENTORY:      accountMap['1300'],
    PAYABLES:       accountMap['2100'],
    SST_PAYABLE:    accountMap['2200'],
    SALES_REVENUE:  accountMap['4000'],
    COGS:           accountMap['5000'],
    SALARIES:       accountMap['6100'],
    GATEWAY_FEES:   accountMap['6500'],
    EPF_PAYABLE:    accountMap['2310'],
    SOCSO_PAYABLE:  accountMap['2320'],
    EIS_PAYABLE:    accountMap['2330'],
    PAYROLL_LIABILITIES: accountMap['2300'],
    raw:            accountMap,
  };
}
