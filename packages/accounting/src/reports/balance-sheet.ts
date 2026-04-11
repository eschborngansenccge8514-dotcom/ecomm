import { getAccountBalancesByPeriod, getNetProfit } from '../ledger';

export async function getBalanceSheet(merchantId: string, asOf: Date) {
  // Balance sheet uses cumulative balances
  const balances = await getAccountBalancesByPeriod(merchantId, new Date(0), asOf);

  const assets      = balances.filter(a => a.type === 'ASSET');
  const liabilities = balances.filter(a => a.type === 'LIABILITY');
  const equity      = balances.filter(a => a.type === 'EQUITY');

  // Profit for current year (assuming Jan 1st start)
  const currentYearStart = new Date(asOf.getFullYear(), 0, 1);
  const currentYearProfit = await getNetProfit(merchantId, currentYearStart, asOf);

  const totalAssets      = assets.reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0);
  const totalEquity      = equity.reduce((s, a) => s + a.balance, 0) + currentYearProfit;

  return {
    assets,
    liabilities,
    equity,
    currentYearProfit,
    totalAssets,
    totalLiabilities,
    totalEquity,
    asOf
  };
}
