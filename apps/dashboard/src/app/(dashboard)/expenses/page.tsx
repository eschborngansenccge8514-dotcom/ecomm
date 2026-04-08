import { getAuthContext } from "@/lib/utils.server";
import { getExpenses, getExpenseSummary } from "./actions";
import { ExpensesTable } from "./_components/ExpensesTable";
import { ExpenseCharts } from "./_components/ExpenseCharts";
import { StatCard } from "@/components/dashboard/StatCard";
import { 
  Receipt, 
  Wallet, 
  TrendingUp, 
  Plus,
  ArrowUpRight,
  Zap,
  ShieldCheck,
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ 
    category?: string; 
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
    status?: string;
  }>
}) {
  const { 
    category = "all", 
    search = "", 
    startDate, 
    endDate, 
    page = "1",
    status = "all"
  } = await searchParams;
  const { merchant } = await getAuthContext();

  const [summary, { data: expenses, totalCount }] = await Promise.all([
    getExpenseSummary(),
    getExpenses({ 
      category, 
      search, 
      startDate, 
      endDate, 
      page: parseInt(page) 
    }),
  ]);

  const stats = [
    {
      title: "Gross Spend",
      value: `RM ${summary?.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      icon: <Receipt size={22} />,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      title: "Net Deductible",
      value: `RM ${summary?.totalDeductible.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      icon: <TrendingUp size={22} />,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      change: "Tax Savings RM " + (summary?.estTaxSavings.toFixed(2)),
      positive: true
    },
    {
      title: "Tax Benefits",
      value: `RM ${summary?.estTaxSavings.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      icon: <Wallet size={22} />,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
    },
    {
       title: "SST Total",
       value: `RM ${summary?.totalSst.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
       icon: <ArrowUpRight size={22} />,
       iconBg: "bg-indigo-50",
       iconColor: "text-indigo-600",
    }
  ];

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="rounded-full bg-indigo-50 text-indigo-600 border-indigo-100 font-black text-[10px] uppercase tracking-widest py-1 px-3">
              Accounting OS
            </Badge>
            <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500 uppercase tracking-widest px-2 py-1 bg-emerald-50 rounded-full">
              <ShieldCheck size={12} />
              Tax Ready
            </div>
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight leading-none">Business Expenses</h1>
          <p className="text-gray-500 font-bold text-sm">Automated tax extraction and spend analysis</p>
        </div>

        <div className="flex items-center gap-4">
           <Link href="/expenses/upload">
              <Button size="lg" className="rounded-[24px] h-14 px-8 bg-gray-900 hover:bg-gray-800 text-white font-black shadow-2xl shadow-gray-200 gap-3 group transition-all hover:scale-105 active:scale-95">
                <Plus size={22} className="group-hover:rotate-90 transition-transform" />
                Capture Receipt
              </Button>
           </Link>
        </div>
      </div>

      {/* Review Callout - Actionable Banner */}
      {summary && summary.pendingReview > 0 && (
        <div className="bg-indigo-600 rounded-[32px] p-1 shadow-xl shadow-indigo-200 overflow-hidden relative group">
          <div className="bg-white/10 backdrop-blur-md px-8 py-6 rounded-[31px] flex flex-col md:flex-row items-center justify-between gap-6">
             <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-indigo-600 shadow-xl group-hover:scale-110 transition-transform">
                   <Zap size={32} className="fill-indigo-600" />
                </div>
                <div>
                   <h3 className="text-xl font-black text-white tracking-tight">
                     {summary?.pendingReview} Receipts require review
                   </h3>
                   <p className="text-indigo-100 font-bold text-sm">AI has extracted data but needs your final confirmation for tax filing.</p>
                </div>
             </div>
             <Link href="/expenses?status=ai_review">
                <Button variant="secondary" className="rounded-2xl h-12 px-6 font-black bg-white text-indigo-600 hover:bg-indigo-50 shadow-lg gap-2">
                  Review Now
                  <ChevronRight size={18} />
                </Button>
             </Link>
          </div>
          <div className="absolute top-0 right-0 -mr-12 -mt-12 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        </div>
      )}

      {/* Visualizations Section */}
      <ExpenseCharts trends={summary?.trends || []} categories={summary?.categories || []} />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <div key={i} className="group transition-all hover:-translate-y-1">
            <StatCard {...s} />
          </div>
        ))}
      </div>

      {/* Main Table */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-2">
           <Receipt size={20} className="text-gray-400" />
           <h2 className="text-xl font-black text-gray-900 tracking-tight">Ledger entries</h2>
           <span className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-auto">
             Showing {totalCount} items
           </span>
        </div>
        <ExpensesTable 
          expenses={expenses} 
          totalCount={totalCount}
          currentCategory={category}
        />
      </div>
    </div>
  );
}
