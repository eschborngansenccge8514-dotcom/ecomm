import { getAccountingOverview, getTrialBalance } from "../actions";
import { AccountingReportsClient } from "./_components/AccountingReportsClient";
import { FileText } from 'lucide-react'

export default async function AccountingReportsPage() {
  const { income, balance } = await getAccountingOverview();
  
  // Get trial balance for the current year
  const today = new Date();
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const trialBalance = await getTrialBalance(yearStart, today);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
        <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
          <FileText size={20} className="text-blue-600" />
          Financial Statements
        </h2>
        <p className="text-gray-500 font-medium mt-1">
          Automated reports based on your ledger. Use these for tax filings and business health checks.
        </p>
      </div>
      <AccountingReportsClient 
        income={income} 
        balance={balance} 
        trialBalance={trialBalance} 
      />
    </div>
  );
}
