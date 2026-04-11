import { getAccountBalancesByPeriod } from '../ledger';

export async function getIncomeStatement(merchantId: string, from: Date, to: Date) {
  const balances = await getAccountBalancesByPeriod(merchantId, from, to);

  const revenue  = balances.filter(a => a.type === 'REVENUE');
  const expenses = balances.filter(a => a.type === 'EXPENSE');

  const totalRevenue  = revenue.reduce((s, a) => s + a.balance, 0);
  const totalExpenses = expenses.reduce((s, a) => s + a.balance, 0);
  
  // COGS is often specifically itemized in Malaysia P&L
  const cogs = expenses
    .filter(a => a.code.startsWith('5'))
    .reduce((s, a) => s + a.balance, 0);

  const grossProfit = totalRevenue - cogs;
  const netProfit = totalRevenue - totalExpenses;

  return {
    revenue,
    expenses,
    totalRevenue,
    totalExpenses,
    cogs,
    grossProfit,
    netProfit,
    period: { from, to }
  };
}
