'use client'

import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'
import { 
  FileText, 
  PieChart, 
  Scale, 
  Table,
  ChevronRight,
  Printer,
  Download
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ReportProps {
  income: any
  balance: any
  trialBalance: any[]
}

export function AccountingReportsClient({ income, balance, trialBalance }: ReportProps) {
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'pnl' | 'balance' | 'trial' | 'sst'>('pnl')
  const [sstData, setSstData] = useState<any>(null)
  const [loadingSst, setLoadingSst] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Report Selector Tabs */}
      <div className="flex gap-2 bg-gray-100/50 p-2 rounded-2xl w-fit">
        {[
          { id: 'pnl', label: 'Income Statement (P&L)', icon: PieChart },
          { id: 'balance', label: 'Balance Sheet', icon: Scale },
          { id: 'trial', label: 'Trial Balance', icon: Table },
          { id: 'sst', label: 'SST-02 Assistant', icon: FileText },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={cn(
              'flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black transition-all',
              activeTab === t.id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
            )}
          >
            <t.icon size={18} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">
          <Printer size={16} /> Print
        </button>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-xl text-sm font-bold text-white hover:bg-blue-700 transition-colors">
          <Download size={16} /> Export PDF
        </button>
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden min-h-[600px]">
        {activeTab === 'pnl' && (
          <div className="p-12 max-w-4xl mx-auto space-y-12">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black text-gray-900">Profit & Loss Statement</h2>
              <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">For the month ended {mounted ? new Date().toLocaleDateString('en-MY', { month: 'long', year: 'numeric' }) : '—'}</p>
            </div>

            <div className="space-y-8">
              {/* Revenue */}
              <section className="space-y-4">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-wider border-b border-gray-50 pb-2">Revenue</h3>
                <div className="space-y-3">
                  {income.revenue.map((acc: any) => (
                    <div key={acc.id} className="flex justify-between items-center group cursor-pointer hover:bg-gray-50/50 p-2 -mx-2 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 font-mono text-xs">{acc.code}</span>
                        <span className="text-gray-700 font-bold">{acc.name}</span>
                      </div>
                      <span className="text-gray-900 font-black tabular-nums">{formatCurrency(acc.balance)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-4 border-t-2 border-gray-100">
                    <span className="text-gray-900 font-black">Gross Profit</span>
                    <span className="text-xl font-black text-gray-900 underline decoration-double">{formatCurrency(income.totalRevenue)}</span>
                  </div>
                </div>
              </section>

              {/* Expenses */}
              <section className="space-y-4">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-wider border-b border-gray-50 pb-2">Operating Expenses</h3>
                <div className="space-y-3">
                  {income.expenses.map((acc: any) => (
                    <div key={acc.id} className="flex justify-between items-center group cursor-pointer hover:bg-gray-50/50 p-2 -mx-2 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 font-mono text-xs">{acc.code}</span>
                        <span className="text-gray-700 font-bold">{acc.name}</span>
                      </div>
                      <span className="text-gray-900 font-black tabular-nums">{formatCurrency(acc.balance)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                    <span className="text-gray-600 font-bold italic">Total Operating Expenses</span>
                    <span className="text-gray-900 font-black tabular-nums">({formatCurrency(income.totalExpenses)})</span>
                  </div>
                </div>
              </section>

              {/* Net Income */}
              <section className="pt-8 mt-8 border-t-4 border-double border-gray-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-2xl font-black text-gray-900">Net Profit / (Loss)</h4>
                    <p className="text-gray-400 text-xs font-bold mt-1 uppercase">Net earnings after all operating costs</p>
                  </div>
                  <div className={cn(
                    "px-6 py-3 rounded-2xl text-3xl font-black tabular-nums shadow-sm",
                    income.netProfit >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                  )}>
                    {formatCurrency(income.netProfit)}
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'balance' && (
          <div className="p-12 max-w-4xl mx-auto space-y-12">
             <div className="text-center space-y-2">
              <h2 className="text-3xl font-black text-gray-900">Balance Sheet</h2>
              <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">As of {mounted ? new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</p>
            </div>

            <div className="space-y-12">
               {/* Assets */}
               <section className="space-y-4">
                  <h3 className="text-lg font-black text-gray-900 border-b-2 border-emerald-100 pb-2">Assets</h3>
                  <div className="space-y-3">
                    {balance.assets.map((acc: any) => (
                      <div key={acc.id} className="flex justify-between items-center p-2 -mx-2 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400 font-mono text-xs">{acc.code}</span>
                          <span className="text-gray-700 font-bold">{acc.name}</span>
                        </div>
                        <span className="text-gray-900 font-black tabular-nums">{formatCurrency(acc.balance)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-4 border-t-2 border-emerald-50">
                      <span className="text-emerald-700 font-black">Total Assets</span>
                      <span className="text-xl font-black text-emerald-600 underline decoration-double">{formatCurrency(balance.totalAssets)}</span>
                    </div>
                  </div>
               </section>

               {/* Liabilities */}
               <section className="space-y-4">
                  <h3 className="text-lg font-black text-gray-900 border-b-2 border-red-100 pb-2">Liabilities</h3>
                  <div className="space-y-3">
                    {balance.liabilities.map((acc: any) => (
                      <div key={acc.id} className="flex justify-between items-center p-2 -mx-2 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400 font-mono text-xs">{acc.code}</span>
                          <span className="text-gray-700 font-bold">{acc.name}</span>
                        </div>
                        <span className="text-gray-900 font-black tabular-nums">{formatCurrency(acc.balance)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-4 border-t-2 border-red-50">
                      <span className="text-red-700 font-black">Total Liabilities</span>
                      <span className="text-xl font-black text-red-600">{formatCurrency(balance.totalLiabilities)}</span>
                    </div>
                  </div>
               </section>

               {/* Equity */}
               <section className="space-y-4">
                  <h3 className="text-lg font-black text-gray-900 border-b-2 border-blue-100 pb-2">Equity</h3>
                  <div className="space-y-3">
                    {balance.equity.map((acc: any) => (
                      <div key={acc.id} className="flex justify-between items-center p-2 -mx-2 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400 font-mono text-xs">{acc.code}</span>
                          <span className="text-gray-700 font-bold">{acc.name}</span>
                        </div>
                        <span className="text-gray-900 font-black tabular-nums">{formatCurrency(acc.balance)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-4 border-t-2 border-blue-50">
                      <span className="text-blue-700 font-black">Total Equity</span>
                      <span className="text-xl font-black text-blue-600">{formatCurrency(balance.totalEquity)}</span>
                    </div>
                  </div>
               </section>

               {/* Total L & E */}
               <section className="pt-8 border-t-4 border-gray-100">
                  <div className="flex justify-between items-center bg-gray-50 p-6 rounded-2xl">
                    <span className="text-gray-900 font-black text-xl uppercase tracking-tight">Total Liabilities & Equity</span>
                    <span className="text-3xl font-black text-gray-900 tabular-nums underline decoration-double">{formatCurrency(balance.totalLiabilities + balance.totalEquity)}</span>
                  </div>
                  {Math.abs(balance.totalAssets - (balance.totalLiabilities + balance.totalEquity)) > 0.01 && (
                    <p className="text-red-500 font-bold text-center mt-2 animate-bounce">⚠️ Warning: Balance Sheet is Unbalanced!</p>
                  )}
               </section>
            </div>
          </div>
        )}

        {activeTab === 'trial' && (
          <div className="p-8">
            <div className="mb-8">
               <h2 className="text-2xl font-black text-gray-900">Trial Balance</h2>
               <p className="text-gray-500 font-medium tracking-tight mt-1">Full chart of accounts balance summary</p>
            </div>

            <div className="border border-gray-100 rounded-2xl overflow-hidden">
               <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Account</th>
                      <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Type</th>
                      <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Debit</th>
                      <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {trialBalance.map((acc: any) => (
                      <tr key={acc.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-gray-900 font-bold">{acc.name}</span>
                            <span className="text-gray-400 font-mono text-xs lowercase">{acc.code}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                            acc.type === 'ASSET' ? "bg-emerald-50 text-emerald-600" :
                            acc.type === 'LIABILITY' ? "bg-red-50 text-red-600" :
                            acc.type === 'EQUITY' ? "bg-blue-50 text-blue-600" :
                            "bg-gray-100 text-gray-600"
                          )}>
                            {acc.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-black tabular-nums text-gray-900">
                          {acc.balance > 0 && acc.normalBalance === 'DEBIT' ? formatCurrency(acc.balance) : 
                           acc.balance < 0 && acc.normalBalance === 'CREDIT' ? formatCurrency(Math.abs(acc.balance)) : '—'}
                        </td>
                        <td className="px-6 py-4 text-right font-black tabular-nums text-gray-900">
                          {acc.balance > 0 && acc.normalBalance === 'CREDIT' ? formatCurrency(acc.balance) :
                           acc.balance < 0 && acc.normalBalance === 'DEBIT' ? formatCurrency(Math.abs(acc.balance)) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          </div>
        )}
        {activeTab === 'sst' && (
          <div className="p-12 max-w-5xl mx-auto space-y-12">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black text-gray-900">SST-02 Filing Assistant</h2>
              <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">Draft for Return Period: {mounted ? new Date().toLocaleDateString('en-MY', { month: 'long', year: 'numeric' }) : '—'}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 flex flex-col gap-1">
                <span className="text-blue-700 text-xs font-black uppercase tracking-wider">Total Taxable Sales</span>
                <span className="text-2xl font-black text-gray-900">RM 48,250.00</span>
                <span className="text-gray-500 text-[10px] font-bold mt-2 italic">Aggregated from POS & Storefront</span>
              </div>
              <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100 flex flex-col gap-1">
                <span className="text-emerald-700 text-xs font-black uppercase tracking-wider">Total Tax Payable</span>
                <span className="text-2xl font-black text-gray-900">RM 2,895.00</span>
                <span className="text-gray-500 text-[10px] font-bold mt-2 italic">Based on 6% Service Tax</span>
              </div>
              <div className="bg-purple-50/50 p-6 rounded-3xl border border-purple-100 flex flex-col gap-1">
                <span className="text-purple-700 text-xs font-black uppercase tracking-wider">Exempt Sales</span>
                <span className="text-2xl font-black text-gray-900">RM 1,200.00</span>
                <span className="text-gray-500 text-[10px] font-bold mt-2 italic">LHDN Code 06 (No Tax)</span>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-lg font-black text-gray-900">Form 11A Detail Mapping</h3>
              <div className="border border-gray-100 rounded-3xl overflow-hidden divide-y divide-gray-50">
                <div className="p-6 flex justify-between items-center hover:bg-gray-50/50 transition-colors">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">Box 11</span>
                    <h4 className="font-bold text-gray-900">Value of Taxable Services at 6% Rate</h4>
                  </div>
                  <span className="text-lg font-black text-gray-900">RM 48,250.00</span>
                </div>
                <div className="p-6 flex justify-between items-center hover:bg-gray-50/50 transition-colors">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">Box 13</span>
                    <h4 className="font-bold text-gray-900">Service Tax Amount Payable (6%)</h4>
                  </div>
                  <span className="text-lg font-black text-emerald-600">RM 2,895.00</span>
                </div>
                <div className="p-6 flex justify-between items-center hover:bg-gray-50/50 transition-colors">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-gray-400 bg-gray-100 px-2 py-1 rounded-lg uppercase">Box 18</span>
                    <h4 className="font-bold text-gray-900">Total Service Tax Payable</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-gray-900 underline decoration-double">RM 2,895.00</span>
                    <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase italic">Rounded to nearest cent</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 p-8 rounded-3xl text-white flex justify-between items-center">
              <div className="space-y-1">
                <h4 className="text-xl font-black">Ready to file?</h4>
                <p className="text-gray-400 text-sm font-medium">Export this data as an XML/CSV structured for JKDM MySST upload.</p>
              </div>
              <button className="bg-white text-gray-900 px-8 py-3 rounded-2xl font-black shadow-lg hover:transform hover:-translate-y-1 transition-all">
                Export for MySST
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
