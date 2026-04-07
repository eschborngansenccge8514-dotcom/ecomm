'use client'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { 
  TrendingUp, TrendingDown, ShoppingBag, Users, 
  ArrowUpRight, AlertCircle, Package, Activity,
  Download, ChevronDown, CheckCircle2, Store,
  DollarSign, Percent, Loader2, ArrowRight, Zap, Clock, Receipt, Truck
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// Recharts components must be dynamic for SSR
const AreaChart = dynamic(() => import('recharts').then(mod => mod.AreaChart), { ssr: false })
const Area = dynamic(() => import('recharts').then(mod => mod.Area), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false })
const Legend = dynamic(() => import('recharts').then(mod => mod.Legend), { ssr: false })
const PieChart = dynamic(() => import('recharts').then(mod => mod.PieChart), { ssr: false })
const Pie = dynamic(() => import('recharts').then(mod => mod.Pie), { ssr: false })
const Cell = dynamic(() => import('recharts').then(mod => mod.Cell), { ssr: false })

// --- Constants ---
const DATE_PRESETS = [
  { label: 'Today',        fn: () => { const d = new Date(); return { from: format(d,'yyyy-MM-dd'), to: format(d,'yyyy-MM-dd') } } },
  { label: 'Yesterday',    fn: () => { const d = subDays(new Date(),1); return { from: format(d,'yyyy-MM-dd'), to: format(d,'yyyy-MM-dd') } } },
  { label: 'Last 7 days',  fn: () => ({ from: format(subDays(new Date(),6),'yyyy-MM-dd'), to: format(new Date(),'yyyy-MM-dd') }) },
  { label: 'Last 30 days', fn: () => ({ from: format(subDays(new Date(),29),'yyyy-MM-dd'), to: format(new Date(),'yyyy-MM-dd') }) },
  { label: 'This month',   fn: () => ({ from: format(startOfMonth(new Date()),'yyyy-MM-dd'), to: format(endOfMonth(new Date()),'yyyy-MM-dd') }) },
  { label: 'Last month',   fn: () => ({ from: format(startOfMonth(subMonths(new Date(),1)),'yyyy-MM-dd'), to: format(endOfMonth(subMonths(new Date(),1)),'yyyy-MM-dd') }) },
]

// --- Helpers ---
function rm(v: number) { return `RM ${Number(v ?? 0).toFixed(2)}` }

function ChangePill({ current, previous }: { current: number; previous: number }) {
  if (!previous) return null
  const pct = ((current - previous) / previous) * 100
  const pos = pct >= 0
  
  return (
    <span className={cn('flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full',
      pos ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500')}>
      {pos ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {pos ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

function MetricCard({ title, value, subValue, current, previous, icon: Icon, colorClass, highlight }: any) {
  return (
    <div className={cn('bg-white rounded-2xl border p-5 flex flex-col justify-between transition-all hover:shadow-md', 
      highlight ? 'border-blue-200 bg-blue-50/10' : 'border-gray-100')}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
        </div>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', colorClass)}>
          <Icon size={20} />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <ChangePill current={current} previous={previous} />
        <span className="text-[10px] text-gray-400 font-medium">vs prev period</span>
      </div>
    </div>
  )
}

export function HomeOverviewClient({ merchantId, dateRange, data }: {
  merchantId: string; dateRange: { from: string; to: string }; data: any
}) {
  const router = useRouter()
  const [showPresets, setShowPresets] = useState(false)
  
  const summary = data?.summary ?? {}
  const dailyStats = data?.daily_stats ?? []
  const topProducts = data?.top_products ?? []
  const recentOrders = data?.recent_orders ?? []
  const alerts = data?.alerts ?? {}
  const purchaseSummary = data?.purchase_summary ?? {}
  const recentPurchases = data?.recent_purchases ?? []

  const applyRange = (from: string, to: string) => {
    router.push(`/?from=${from}&to=${to}`)
    setShowPresets(false)
  }

  // Chart data formatting
  const chartData = dailyStats.map((d: any) => ({
    ...d,
    formattedDate: format(parseISO(d.date), 'd MMM')
  }))

  const totalDays = Math.round((new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / 86400000) + 1

  return (
    <div className="space-y-6">
      
      {/* Header & Date Picker */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">Welcome back! Here's how your business is performing.</p>
        </div>
        
        <div className="relative">
          <button onClick={() => setShowPresets(!showPresets)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium hover:bg-gray-50 shadow-sm transition-all">
            <span className="text-gray-400 font-bold">📅</span>
            <span>{dateRange.from} → {dateRange.to}</span>
            <span className="text-xs text-gray-400 font-normal">({totalDays}d)</span>
            <ChevronDown size={14} className={cn('transition-transform', showPresets && 'rotate-180')} />
          </button>
          
          {showPresets && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowPresets(false)} />
              <div className="absolute right-0 top-12 z-30 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 min-w-[200px] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                {DATE_PRESETS.map(p => (
                  <button key={p.label}
                    onClick={() => { const r = p.fn(); applyRange(r.from, r.to) }}
                    className="w-full text-left px-4 py-2.5 text-sm rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-colors">
                    {p.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Total Revenue" 
          value={rm(summary.revenue)} 
          current={Number(summary.revenue)}
          previous={Number(summary.prev_revenue)}
          icon={TrendingUp} 
          colorClass="bg-blue-100 text-blue-600"
          highlight
        />
        <MetricCard 
          title="Gross Profit" 
          value={rm(summary.gross_profit)} 
          subValue={`Margin: ${summary.revenue > 0 ? ((summary.gross_profit / summary.revenue) * 100).toFixed(1) : 0}%`}
          current={Number(summary.gross_profit)}
          previous={Number(summary.prev_gross_profit)}
          icon={DollarSign} 
          colorClass="bg-green-100 text-green-600"
        />
        <MetricCard 
          title="Total Expenses" 
          value={rm(summary.expenses)} 
          current={Number(summary.expenses)}
          previous={Number(summary.prev_expenses)}
          icon={ArrowUpRight} 
          colorClass="bg-amber-100 text-amber-600"
        />
        <MetricCard 
          title="Net P&L" 
          value={rm(summary.net_pnl)} 
          current={Number(summary.net_pnl)}
          previous={Number(summary.prev_revenue - (summary.prev_cogs ?? 0) - summary.prev_expenses)} // Approx
          icon={Activity} 
          colorClass={summary.net_pnl >= 0 ? "bg-indigo-100 text-indigo-600" : "bg-red-100 text-red-600"}
        />
      </div>

      {/* Main Chart Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-gray-900">Performance Over Time</h3>
            <p className="text-xs text-gray-400 mt-0.5">Tracking revenue and gross profit daily</p>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-blue-600" />
              <span className="text-xs text-gray-500 font-medium">Revenue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-xs text-gray-500 font-medium">Profit</span>
            </div>
          </div>
        </div>
        
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis 
                dataKey="formattedDate" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                minTickGap={20}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickFormatter={(v) => `RM${v}`}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                formatter={(val: any) => [`RM ${Number(val ?? 0).toFixed(2)}`, '']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProf)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid: Top Products, Recent Orders, Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top Products */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <ShoppingBag size={18} className="text-blue-500" />
              Top Products
            </h3>
            <Link href="/products" className="text-xs text-blue-600 font-bold flex items-center hover:underline">
              View All <ArrowRight size={12} className="ml-1" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Product</th>
                  <th className="px-5 py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Units</th>
                  <th className="px-5 py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Revenue</th>
                  <th className="px-5 py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topProducts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-gray-400 italic">No sales data for this period</td>
                  </tr>
                ) : (
                  topProducts.map((p: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-5 py-4">
                        <span className="font-medium text-gray-900">{p.name}</span>
                      </td>
                      <td className="px-5 py-4 text-right text-gray-600">
                        {p.units_sold}
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-gray-900">
                        {rm(p.revenue)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-green-600 font-medium">+{rm(p.profit)}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar Column: Recent Orders & Alerts */}
        <div className="space-y-6">
          
          {/* Cost Breakdown Donut */}
          <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-6">Cost Breakdown</h3>
            
            {summary.revenue > 0 ? (
              <div className="flex flex-col items-center">
                <div className="h-[180px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'COGS', value: Number(summary.cogs) },
                          { name: 'Expenses', value: Number(summary.expenses) },
                          { name: 'Net Profit', value: Math.max(Number(summary.net_pnl), 0) },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="#F59E0B" />
                        <Cell fill="#EF4444" />
                        <Cell fill="#10B981" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold">
                      {summary.revenue > 0 ? Math.round((summary.net_pnl / summary.revenue) * 100) : 0}%
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">MARGIN</span>
                  </div>
                </div>

                <div className="w-full mt-6 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span className="text-slate-300">COGS</span>
                    </div>
                    <span className="font-bold">{rm(summary.cogs)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <span className="text-slate-300">Expenses</span>
                    </div>
                    <span className="font-bold">{rm(summary.expenses)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      <span className="text-slate-300">Net Profit</span>
                    </div>
                    <span className="font-bold">{rm(summary.net_pnl)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-[240px] flex flex-col items-center justify-center text-center p-4">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 text-slate-600">
                  <Package size={24} />
                </div>
                <p className="text-slate-400 text-sm font-medium">No revenue this period</p>
                <p className="text-slate-600 text-xs mt-1">Donut chart will appear when sales are recorded</p>
              </div>
            )}
          </div>

          {/* Purchase Activity */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Truck size={18} className="text-gray-400" />
                Purchase Activity
              </h3>
              <Link href="/inventory/purchases" className="text-[10px] bg-gray-50 text-gray-400 font-bold px-2 py-1 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors">
                VIEW ALL
              </Link>
            </div>
            
            {purchaseSummary.po_count > 0 ? (
              <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Total Spent</p>
                    <p className="text-lg font-bold text-gray-900">{rm(purchaseSummary.total_spent)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">{purchaseSummary.po_count} Orders</p>
                    <div className="flex gap-1 mt-1 justify-end">
                      {purchaseSummary.draft_count > 0 && <span className="w-1.5 h-1.5 rounded-full bg-gray-300" title={`${purchaseSummary.draft_count} Draft`} />}
                      {purchaseSummary.sent_count > 0 && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" title={`${purchaseSummary.sent_count} Sent`} />}
                      {purchaseSummary.received_count > 0 && <span className="w-1.5 h-1.5 rounded-full bg-green-500" title={`${purchaseSummary.received_count} Received`} />}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {recentPurchases.map((po: any) => (
                    <Link key={po.id} href={`/inventory/purchase-orders/${po.id}`} className="block group">
                      <div className="flex items-center justify-between p-1 rounded-lg group-hover:bg-gray-50 transition-colors">
                        <div>
                          <p className="text-xs font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{po.po_number}</p>
                          <p className="text-[10px] text-gray-400 truncate max-w-[120px]">{po.supplier_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-gray-900">{rm(po.total)}</p>
                          <span className={cn(
                            "text-[8px] font-bold px-1 py-0.5 rounded uppercase",
                            po.status === 'received' ? "bg-green-100 text-green-700" : 
                            po.status === 'sent' ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                          )}>
                            {po.status}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <Truck size={24} className="text-gray-200 mb-2" />
                <p className="text-xs text-gray-400 font-medium">No purchase orders this period</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

// Sparkle/Zap icon for Pulse Check
function ZapIcon({ size, className }: any) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  )
}
