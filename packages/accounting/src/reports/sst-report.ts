import { getLedger } from '../ledger';
import { getSystemAccountsByMerchant } from '../chart-of-accounts';

/**
 * Generates data required for Malaysia SST-02 filing.
 * Pulls from the SST Payable (2200) ledger.
 */
export async function getSST02Report(merchantId: string, from: Date, to: Date) {
  const accts = await getSystemAccountsByMerchant(merchantId);
  if (!accts.SST_PAYABLE) {
    throw new Error(`SST Payable account (2200) not found for merchant ${merchantId}`);
  }

  const ledger = await getLedger(merchantId, accts.SST_PAYABLE, from, to);
  
  // Sum of credits in the liability account represents SST collected from customers
  const totalSSTCollected = ledger.entries.reduce((sum, e) => sum + Number(e.credit || 0), 0);
  
  // Sum of debits would represent SST paid to Customs or reversals
  const totalSSTAdjustments = ledger.entries.reduce((sum, e) => sum + Number(e.debit || 0), 0);

  return {
    merchantId,
    period: { from, to },
    sstPayableAccount: ledger.account,
    summary: {
      totalSSTCollected,
      totalSSTAdjustments,
      netSSTPayable: totalSSTCollected - totalSSTAdjustments,
    },
    lineItems: ledger.entries.map(e => ({
      date:        e.date,
      entryNumber: e.entryNumber,
      description: e.description,
      sourceType:  e.sourceType,
      sourceRef:   e.sourceRef,
      amount:      Number(e.credit || 0) - Number(e.debit || 0),
    }))
  };
}
