import { getNetProfit, getAccountBalancesByPeriod } from '../ledger';

/**
 * Cash Flow Statement using the Indirect Method.
 * Converts Net Profit to Cash Flow by adjusting for non-cash working capital changes.
 */
export async function getCashFlowStatement(merchantId: string, from: Date, to: Date) {
  const netProfit = await getNetProfit(merchantId, from, to);
  
  // Get changes within the period for working capital accounts
  const periodActivity = await getAccountBalancesByPeriod(merchantId, from, to);
  
  // 1200: Accounts Receivable
  const arChange        = periodActivity.find(a => a.code === '1200')?.balance || 0;
  // 1300: Inventory
  const inventoryChange = periodActivity.find(a => a.code === '1300')?.balance || 0;
  // 2100: Accounts Payable
  const apChange        = periodActivity.find(a => a.code === '2100')?.balance || 0;

  /**
   * Cash Flow Adjustments:
   * - AR Increase = Cash OUT (customer didn't pay yet) -> subtract
   * - Inventory Increase = Cash OUT (bought more stock) -> subtract
   * - AP Increase = Cash IN (we didn't pay supplier yet) -> add
   */
  const operatingCashFlow = netProfit - arChange - inventoryChange + apChange;

  return {
    netProfit,
    adjustments: {
      accountsReceivable: -arChange,
      inventory:         -inventoryChange,
      accountsPayable:    apChange,
    },
    operatingCashFlow,
    investingCashFlow: 0, // Placeholder for capex
    financingCashFlow: 0, // Placeholder for loans/equity
    netCashChange:     operatingCashFlow,
    period: { from, to }
  };
}
