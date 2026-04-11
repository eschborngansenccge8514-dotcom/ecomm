import { getAccountLedger } from "../../actions";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, BookOpen, Calendar, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import Link from "next/link";
import { cn } from "@/lib/utils";

export default async function LedgerPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ledger = await getAccountLedger(params.id);
  const { account, openingBalance, entries, closingBalance } = ledger;

  if (!account) return <div>Account not found</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <Link 
          href="/accounting/coa" 
          className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Chart of Accounts
        </Link>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 p-10 shadow-sm">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
             <div className="w-16 h-16 rounded-2xl bg-gray-900 text-white flex items-center justify-center">
                <BookOpen size={28} />
             </div>
             <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block mb-1">General Ledger</span>
                <h1 className="text-3xl font-black text-gray-900">{account.name}</h1>
                <p className="text-sm font-bold text-gray-400 mt-1">{account.code} • {account.type}</p>
             </div>
          </div>
          <div className="text-right">
             <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block mb-1">Current Balance</span>
             <h2 className={cn(
               "text-3xl font-black",
               closingBalance >= 0 ? "text-emerald-600" : "text-red-600"
             )}>
               {formatCurrency(closingBalance)}
             </h2>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-10">
          <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100">
             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Opening Balance</span>
             <p className="text-xl font-black text-gray-900">{formatCurrency(openingBalance)}</p>
          </div>
          <div className="bg-emerald-50/30 rounded-2xl p-6 border border-emerald-50">
             <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-2 text-opacity-70">Total Debits</span>
             <p className="text-xl font-black text-emerald-700">
               {formatCurrency(entries.reduce((sum, e) => sum + Number(e.debit || 0), 0))}
             </p>
          </div>
          <div className="bg-red-50/30 rounded-2xl p-6 border border-red-50">
             <span className="text-[10px] font-black text-red-600 uppercase tracking-widest block mb-2 text-opacity-70">Total Credits</span>
             <p className="text-xl font-black text-red-700">
               {formatCurrency(entries.reduce((sum, e) => sum + Number(e.credit || 0), 0))}
             </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                <th className="text-left py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Reference</th>
                <th className="text-left py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Description</th>
                <th className="text-right py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Debit</th>
                <th className="text-right py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Credit</th>
                <th className="text-right py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-5 px-4">
                    <div className="flex items-center gap-2">
                       <Calendar size={14} className="text-gray-400" />
                       <span className="text-sm font-bold text-gray-600">
                         {new Date(entry.date).toLocaleDateString()}
                       </span>
                    </div>
                  </td>
                  <td className="py-5 px-4">
                    <span className="text-xs font-black text-gray-900 bg-gray-100 px-2 py-1 rounded-md">
                      {entry.entryNumber}
                    </span>
                  </td>
                  <td className="py-5 px-4 text-sm font-medium text-gray-500">
                    {entry.lineDescription || entry.description}
                  </td>
                  <td className="py-5 px-4 text-right">
                    {Number(entry.debit) > 0 ? (
                      <span className="text-sm font-black text-emerald-600 flex items-center justify-end gap-1">
                        {formatCurrency(Number(entry.debit))}
                        <ArrowUpRight size={12} />
                      </span>
                    ) : '-'}
                  </td>
                  <td className="py-5 px-4 text-right">
                    {Number(entry.credit) > 0 ? (
                      <span className="text-sm font-black text-red-600 flex items-center justify-end gap-1">
                        {formatCurrency(Number(entry.credit))}
                        <ArrowDownLeft size={12} />
                      </span>
                    ) : '-'}
                  </td>
                  <td className="py-5 px-4 text-right font-black text-gray-900 text-sm">
                    {formatCurrency(entry.runningBalance)}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                     <p className="text-gray-400 font-bold">No transactions found for this period.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
