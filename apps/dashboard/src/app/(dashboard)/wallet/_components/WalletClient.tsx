'use client'

import { useState } from 'react'
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  Download,
  Wallet,
  Clock,
  ArrowRight,
  TrendingUp,
  Receipt,
  AlertCircle,
  FileText
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { WithdrawalModal } from './WithdrawalModal'
import { TopupModal } from './TopupModal'

export function WalletClient({ 
  wallet, 
  transactions, 
  withdrawalRequests,
  merchant 
}: { 
  wallet: any, 
  transactions: any[], 
  withdrawalRequests: any[],
  merchant: any
}) {
  const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false)
  const [isTopupOpen, setIsTopupOpen] = useState(false)
  const balance = Number(wallet?.balance || 0)

  // Calculate some quick stats
  const totalEarned = transactions
    .filter(t => t.type === 'order_revenue')
    .reduce((acc, t) => acc + Number(t.amount), 0)
  
  const totalWithdrawn = transactions
    .filter(t => t.type === 'withdrawal')
    .reduce((acc, t) => acc + Math.abs(Number(t.amount)), 0)

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hero Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Balance Card */}
        <div className="lg:col-span-2 relative overflow-hidden bg-white rounded-[40px] border border-gray-100 p-10 shadow-2xl shadow-gray-200/50 group">
          <div className="absolute top-0 right-0 p-12 text-blue-50/50 -mr-8 -mt-8 group-hover:text-blue-50/80 transition-colors">
            <Wallet size={200} strokeWidth={0.5} />
          </div>
          
          <div className="relative space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200">
                <Wallet size={24} />
              </div>
              <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">Available Balance</h2>
            </div>
            
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black text-gray-400">RM</span>
              <span className="text-7xl font-black text-gray-900 tracking-tighter">
                {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center gap-4 pt-4">
              <Button 
                onClick={() => setIsTopupOpen(true)}
                className="h-14 px-10 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm shadow-xl shadow-blue-200 transition-all hover:scale-[1.02] active:scale-95"
              >
                Add Funds
                <Plus size={18} className="ml-2" />
              </Button>
              <Button 
                onClick={() => setIsWithdrawalOpen(true)}
                variant="outline"
                className="h-14 px-8 rounded-2xl border-gray-100 hover:bg-gray-50 font-bold text-gray-600 transition-all shadow-xl shadow-gray-100"
              >
                Withdraw Funds
                <ArrowUpRight size={18} className="ml-2" />
              </Button>
            </div>
          </div>
        </div>

        {/* Side Stats */}
        <div className="space-y-6">
          <div className="bg-emerald-50/50 rounded-[32px] border border-emerald-100/50 p-8 flex flex-col justify-between group hover:bg-emerald-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                <TrendingUp size={20} />
              </div>
              <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold">+ {transactions.length > 0 ? 'Active' : 'N/A'}</Badge>
            </div>
            <div className="mt-6">
              <p className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest">Total Earned (Net)</p>
              <p className="text-3xl font-black text-emerald-900 tracking-tight">RM {totalEarned.toFixed(2)}</p>
            </div>
          </div>

          <div className="bg-amber-50/50 rounded-[32px] border border-amber-100/50 p-8 flex flex-col justify-between group hover:bg-amber-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                <ArrowRight size={20} />
              </div>
              <Badge className="bg-amber-100 text-amber-700 border-none font-bold">{withdrawalRequests.length} Requests</Badge>
            </div>
            <div className="mt-6">
              <p className="text-[10px] font-black text-amber-600/60 uppercase tracking-widest">Total Withdrawn</p>
              <p className="text-3xl font-black text-amber-900 tracking-tight">RM {totalWithdrawn.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Tabs / Lists */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Transactions Table */}
        <div className="xl:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                <History size={16} />
              </div>
              <h3 className="font-black text-gray-900 tracking-tight">Recent Transactions</h3>
            </div>
            <button className="text-xs font-black text-blue-600 hover:underline">View All</button>
          </div>

          <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
               <table className="w-full border-collapse">
                 <thead>
                   <tr className="border-b border-gray-50 bg-gray-50/50">
                     <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Date & Time</th>
                     <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Description</th>
                     <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                     <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-50">
                   {transactions.length === 0 ? (
                     <tr>
                       <td colSpan={4} className="py-20 text-center">
                         <div className="flex flex-col items-center gap-3">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-200">
                              <Receipt size={32} />
                            </div>
                            <p className="text-sm font-bold text-gray-400">No transactions yet</p>
                         </div>
                       </td>
                     </tr>
                   ) : (
                     transactions.map((t) => (
                       <tr key={t.id} className="group hover:bg-gray-50/50 transition-colors">
                         <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-gray-900">{format(new Date(t.created_at), 'd MMM yyyy')}</span>
                              <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                <Clock size={10} /> {format(new Date(t.created_at), 'h:mm a')}
                              </span>
                            </div>
                         </td>
                         <td className="px-6 py-5">
                            <span className="text-sm font-bold text-gray-700">{t.description}</span>
                         </td>
                         <td className="px-6 py-5">
                            <Badge variant="outline" className={cn(
                              "rounded-xl border-none font-black text-[10px] px-2.5 py-1 uppercase",
                              t.type === 'order_revenue' || t.type === 'top_up' ? 'bg-emerald-50 text-emerald-600' :
                              t.type === 'withdrawal' || t.type === 'shipping_fee' ? 'bg-amber-50 text-amber-600' :
                              t.type === 'refund' ? 'bg-rose-50 text-rose-600' : 'bg-gray-100 text-gray-600'
                            )}>
                               {t.type.replace(/_/g, ' ')}
                            </Badge>
                         </td>
                         <td className="px-6 py-5 text-right font-black">
                            <span className={cn(
                              "text-sm",
                              Number(t.amount) > 0 ? 'text-emerald-600' : 'text-gray-900'
                            )}>
                              {Number(t.amount) > 0 ? '+' : ''} RM {Number(t.amount).toFixed(2)}
                            </span>
                         </td>
                       </tr>
                     ))
                   )}
                 </tbody>
               </table>
            </div>
          </div>
        </div>

        {/* Withdrawal Requests Sidebar */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                <Clock size={16} />
              </div>
              <h3 className="font-black text-gray-900 tracking-tight">Withdrawals</h3>
            </div>
          </div>

          <div className="bg-white rounded-[32px] border border-gray-100 p-6 space-y-4">
            {withdrawalRequests.length === 0 ? (
               <div className="py-12 text-center flex flex-col items-center gap-3">
                 <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-200">
                    <FileText size={24} />
                 </div>
                 <p className="text-xs font-bold text-gray-400">No requests found</p>
               </div>
            ) : (
              withdrawalRequests.map((req) => (
                <div key={req.id} className="p-4 rounded-2xl border border-gray-50 hover:border-gray-100 transition-all group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-gray-900">RM {Number(req.amount).toFixed(2)}</span>
                    <Badge className={cn(
                      "rounded-lg border-none font-bold text-[10px] px-2 py-0.5",
                      req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      req.status === 'processed' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    )}>
                      {req.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400">{format(new Date(req.created_at), 'd MMM, h:mm a')}</span>
                    {req.status === 'pending' && (
                      <AlertCircle size={12} className="text-amber-400" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quick Tip */}
          <div className="p-6 bg-blue-600 rounded-[32px] text-white shadow-xl shadow-blue-100 group overflow-hidden relative">
            <div className="absolute -bottom-8 -right-8 text-blue-500/20 group-hover:scale-110 transition-transform">
              <AlertCircle size={100} />
            </div>
            <h4 className="font-black text-sm mb-2 relative">Payout Schedule</h4>
            <p className="text-[11px] font-medium text-blue-100 leading-relaxed relative">
              Withdrawal requests are typically processed within 1-3 business days. Make sure your bank details are correct in settings.
            </p>
          </div>
        </div>
      </div>

      <WithdrawalModal 
        isOpen={isWithdrawalOpen} 
        onClose={() => setIsWithdrawalOpen(false)} 
        balance={balance}
        merchant={merchant}
      />
      <TopupModal
        isOpen={isTopupOpen}
        onClose={() => setIsTopupOpen(false)}
        merchant={merchant}
      />
    </div>
  )
}
