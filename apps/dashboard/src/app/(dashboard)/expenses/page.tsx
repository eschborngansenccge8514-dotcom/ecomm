import { getAuthContext } from "@/lib/utils.server";
import { getExpenses, getExpenseSummary } from "./actions";
import { ExpensesTable } from "./_components/ExpensesTable";
import { StatCard } from "@/components/dashboard/StatCard";
import { 
  Receipt, 
  Wallet, 
  TrendingUp, 
  Plus,
  ArrowUpRight
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ 
    category?: string; 
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
  }>
}) {
  const { 
    category = "all", 
    search = "", 
    startDate, 
    endDate, 
    page = "1" 
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
      title: "Total Spent",
      value: `RM ${summary?.totalSpent.toFixed(2) || "0.00"}`,
      icon: <Receipt size={20} />,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      title: "Tax Deductible",
      value: `RM ${summary?.totalDeductible.toFixed(2) || "0.00"}`,
      icon: <TrendingUp size={20} />,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
    {
      title: "Est. Tax Savings",
      value: `RM ${summary?.estTaxSavings.toFixed(2) || "0.00"}`,
      icon: <Wallet size={20} />,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
    },
    {
       title: "SST Total",
       value: `RM ${summary?.totalSst.toFixed(2) || "0.00"}`,
       icon: <ArrowUpRight size={20} />,
       iconBg: "bg-indigo-50",
       iconColor: "text-indigo-600",
    }
  ];

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Expenses</h1>
          <p className="text-gray-500 font-medium mt-1">Manage your business spend and AI-extracted receipts</p>
        </div>
        <Link href="/expenses/upload">
          <Button className="rounded-2xl h-12 px-6 bg-gray-900 hover:bg-gray-800 text-white font-bold shadow-lg shadow-gray-200 gap-2">
            <Plus size={20} />
            Upload Receipt
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <StatCard key={i} {...s} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Main Content */}
        <div className="lg:col-span-3">
          <ExpensesTable 
            expenses={expenses} 
            totalCount={expenses.length}
            currentCategory={category}
          />
        </div>

        {/* Sidebar / Categories */}
        <aside className="space-y-6">
          <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-black text-gray-900 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-500 rounded-full" />
              Category Spend
            </h3>
            <div className="space-y-4">
              {summary?.categories?.slice(0, 5).map((c: any) => (
                <div key={c.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-tight">
                    <span className="text-gray-500 truncate mr-2">{c.name.replace(/_/g, ' ')}</span>
                    <span className="text-gray-900 shrink-0">RM {c.value.toFixed(2)}</span>
                  </div>
                  <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                      style={{ width: `${c.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
              {(!summary?.categories?.length) && (
                <p className="text-sm text-gray-400 italic">No data yet</p>
              )}
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-[32px] text-white shadow-xl">
             <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-4 text-blue-400">
               <TrendingUp size={24} />
             </div>
             <h4 className="font-bold text-lg mb-2">Automated Tax Tracking</h4>
             <p className="text-xs text-gray-400 font-medium leading-relaxed">
               All your expenses are automatically categorised and tax-deductible amounts are calculated based on Malaysian ITA 1967.
             </p>
             <Link href="/expenses/learn" className="inline-flex items-center gap-2 text-xs font-bold text-blue-400 mt-4 hover:underline">
               Learn more <ArrowUpRight size={14} />
             </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
