import { getAccountingOverview } from "./actions";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  PieChart,
  Target,
  CheckCircle2
} from 'lucide-react'

export default async function AccountingPage() {
  const { income, balance } = await getAccountingOverview();

  const stats = [
    { 
      label: 'Monthly Revenue', 
      value: formatCurrency(income.totalRevenue), 
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50'
    },
    { 
      label: 'Net Profit', 
      value: formatCurrency(income.netProfit), 
      icon: Target,
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    { 
      label: 'Accounts Receivable', 
      value: formatCurrency(balance.assets.find(a => a.code === '1200')?.balance || 0), 
      icon: ArrowUpRight,
      color: 'text-amber-600',
      bg: 'bg-amber-50'
    },
    { 
      label: 'Accounts Payable', 
      value: formatCurrency(balance.liabilities.find(a => a.code === '2100')?.balance || 0), 
      icon: ArrowDownRight,
      color: 'text-red-600',
      bg: 'bg-red-50'
    },
  ]

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl shadow-blue-100 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
        <div className="relative z-10">
          <h2 className="text-3xl font-black mb-2">Welcome to Accounting</h2>
          <p className="text-blue-100 font-medium max-w-md">
            We've simplified your financial management. Most of your sales and expenses are tracked automatically.
          </p>
          <div className="flex gap-3 mt-6">
            <Link href="/accounting/journal" className="bg-white text-blue-600 px-6 py-2.5 rounded-xl font-black text-sm hover:bg-blue-50 transition-colors">
              Manual Entry
            </Link>
            <Link href="/accounting/reconcile" className="bg-blue-500 text-white px-6 py-2.5 rounded-xl font-black text-sm hover:bg-blue-600 transition-colors border border-blue-400">
              Reconcile
            </Link>
            <Link href="/accounting/periods" className="bg-blue-500/30 text-white border border-blue-400/30 px-6 py-2.5 rounded-xl font-black text-sm hover:bg-blue-500/40 transition-colors">
              Setup Periods
            </Link>
          </div>
        </div>
        <div className="relative z-10 bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
          <h3 className="font-black text-sm uppercase tracking-widest text-blue-200 mb-4">Account Status</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
               <div className="w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center">
                  <CheckCircle2 size={12} className="text-emerald-900" />
               </div>
               <span className="text-sm font-bold">Chart of Accounts Ready</span>
            </div>
            <div className="flex items-center gap-3 text-blue-200">
               <div className="w-5 h-5 rounded-full border-2 border-blue-300" />
               <span className="text-sm font-bold">First Period Not Closed</span>
            </div>
          </div>
        </div>
        
        {/* Decorative Circles */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon size={22} className={stat.color} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-black text-gray-900 mt-0.5">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Breakdown */}
        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
           <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <PieChart size={20} className="text-blue-600" />
                Revenue Breakdown
              </h2>
           </div>
           
           <div className="space-y-6">
              {income.revenue.map(rev => (
                <div key={rev.id} className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-gray-600 font-bold">{rev.name}</span>
                   </div>
                   <span className="text-gray-900 font-black tabular-nums">{formatCurrency(rev.balance)}</span>
                </div>
              ))}
              {income.revenue.length === 0 && (
                <p className="text-gray-400 font-medium italic">No revenue recorded this month</p>
              )}
           </div>

           <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between items-center">
              <span className="text-gray-500 font-bold uppercase text-sm">Total Revenue</span>
              <span className="text-2xl font-black text-gray-900">{formatCurrency(income.totalRevenue)}</span>
           </div>
        </div>

        {/* Expense Breakdown */}
        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
           <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <TrendingDown size={20} className="text-red-600" />
                Operating Expenses
              </h2>
           </div>
           
           <div className="space-y-6">
              {income.expenses.slice(0, 5).map(exp => (
                <div key={exp.id} className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-400" />
                      <span className="text-gray-600 font-bold">{exp.name}</span>
                   </div>
                   <span className="text-gray-900 font-black tabular-nums">{formatCurrency(exp.balance)}</span>
                </div>
              ))}
              {income.expenses.length > 5 && (
                <p className="text-gray-400 text-sm font-medium pt-2 italic">+ {income.expenses.length - 5} other accounts</p>
              )}
              {income.expenses.length === 0 && (
                <p className="text-gray-400 font-medium italic">No expenses recorded this month</p>
              )}
           </div>

           <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between items-center">
              <span className="text-gray-500 font-bold uppercase text-sm">Total Expenses</span>
              <span className="text-2xl font-black text-red-600">{formatCurrency(income.totalExpenses)}</span>
           </div>
        </div>
      </div>
    </div>
  )
}
