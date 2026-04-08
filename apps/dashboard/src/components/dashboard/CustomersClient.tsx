'use client'
import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'
import { useRouter }    from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'

const AreaChart = dynamic(() => import('recharts').then(mod => mod.AreaChart), { ssr: false })
const Area = dynamic(() => import('recharts').then(mod => mod.Area), { ssr: false })
const BarChart = dynamic(() => import('recharts').then(mod => mod.BarChart), { ssr: false })
const Bar = dynamic(() => import('recharts').then(mod => mod.Bar), { ssr: false })
const PieChart = dynamic(() => import('recharts').then(mod => mod.PieChart), { ssr: false })
const Pie = dynamic(() => import('recharts').then(mod => mod.Pie), { ssr: false })
const Cell = dynamic(() => import('recharts').then(mod => mod.Cell), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false })
const Legend = dynamic(() => import('recharts').then(mod => mod.Legend), { ssr: false })
import { Button }  from '@/components/ui/button'
import { Input }   from '@/components/ui/input'
import { Badge }   from '@/components/ui/badge'
import { cn }      from '@/lib/utils'
import {
  Users, UserPlus, UserCheck, UserX, TrendingUp,
  ShoppingBag, Star, ShoppingCart, RefreshCw, ChevronDown, Download,
  AlertCircle, ShieldAlert, Search, Clock, Zap, Target, Heart, User, ArrowRight, Calendar
} from 'lucide-react'
import { CustomerEditSheet } from './CustomerEditSheet'
import { CustomerDetailsView } from './CustomerDetailsView'
import { Sheet, SheetContent } from '@/components/ui/sheet'

// ─── Constants ─────────────────────────────────────────────────────────────

const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const HOURS  = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i-12}pm`)

const SEGMENT_META: Record<string, { color: string; bg: string; icon: any; border: string; desc: string }> = {
  'Champion':        { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-100', icon: Star, desc: 'Your best customers' },
  'Loyal':           { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: UserCheck, desc: 'Consistently buying' },
  'Potential Loyal': { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100', icon: TrendingUp, desc: 'Recent with 2+ orders' },
  'New Customer':    { color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-100', icon: UserPlus, desc: 'First purchase recently' },
  'Needs Attention': { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-100', icon: UserX, desc: 'Below average engagement' },
  'At Risk':         { color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-100', icon: AlertCircle, desc: 'Was active, going quiet' },
  'Cannot Lose Them':{ color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-100', icon: ShieldAlert, desc: 'Big spenders going dormant' },
  'Lost':            { color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-100', icon: Users, desc: 'Haven\'t bought recently' },
}

const DATE_PRESETS = [
  { label: 'Last 7 days',  fn: () => ({ from: format(subDays(new Date(),6),'yyyy-MM-dd'), to: format(new Date(),'yyyy-MM-dd') }) },
  { label: 'Last 30 days', fn: () => ({ from: format(subDays(new Date(),29),'yyyy-MM-dd'), to: format(new Date(),'yyyy-MM-dd') }) },
  { label: 'This month',   fn: () => ({ from: format(startOfMonth(new Date()),'yyyy-MM-dd'), to: format(endOfMonth(new Date()),'yyyy-MM-dd') }) },
  { label: 'Last month',   fn: () => ({ from: format(startOfMonth(subMonths(new Date(),1)),'yyyy-MM-dd'), to: format(endOfMonth(subMonths(new Date(),1)),'yyyy-MM-dd') }) },
  { label: 'Last 3 months',fn: () => ({ from: format(subDays(new Date(),89),'yyyy-MM-dd'), to: format(new Date(),'yyyy-MM-dd') }) },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

const rm = (v: number) => `RM ${Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const n  = (v: number) => Number(v ?? 0)

function StatCard({ icon, label, value, sub, iconBg, iconColor, trend }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; iconBg: string; iconColor: string; trend?: { value: string; positive: boolean }
}) {
  return (
    <div className="group relative bg-white rounded-[32px] border border-gray-100 p-6 transition-all duration-300 hover:shadow-2xl hover:shadow-gray-200/50 hover:border-blue-100">
      <div className="flex items-start justify-between">
        <div className="space-y-4">
          <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300', iconBg, iconColor)}>
            {icon}
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-3xl font-bold text-gray-900 tracking-tight">{value}</p>
              {trend && (
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-lg flex items-center gap-0.5', 
                  trend.positive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')}>
                  {trend.positive ? '↑' : '↓'} {trend.value}
                </span>
              )}
            </div>
            {sub && <p className="text-xs text-gray-500 font-medium mt-1 opacity-80">{sub}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, action, children, className, icon: Icon }: {
  title: string; action?: React.ReactNode; children: React.ReactNode; className?: string; icon?: any
}) {
  return (
    <div className={cn('bg-white rounded-[32px] border border-gray-100 p-8 shadow-sm transition-all hover:shadow-md h-full flex flex-col', className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-500">
              <Icon size={20} />
            </div>
          )}
          <h3 className="text-lg font-bold text-gray-900 tracking-tight">{title}</h3>
        </div>
        {action}
      </div>
      <div className="flex-1">
        {children}
      </div>
    </div>
  )
}

function exportCSV(rows: any[][], filename: string) {
  const csv  = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click(); URL.revokeObjectURL(url)
}

// ─── Heatmap cell ────────────────────────────────────────────────────────────

function HeatCell({ count, max, label }: { count: number; max: number; label?: string }) {
  const intensity = max > 0 ? count / max : 0
  const bg = intensity === 0   ? 'bg-gray-50 border border-gray-100 hover:bg-gray-100'
           : intensity < 0.25  ? 'bg-blue-50/50 hover:bg-blue-100'
           : intensity < 0.5   ? 'bg-blue-200 hover:bg-blue-300'
           : intensity < 0.75  ? 'bg-blue-500 hover:bg-blue-600'
           : 'bg-blue-700 hover:bg-blue-800'
  const text = intensity >= 0.5 ? 'text-white' : 'text-gray-600'
  return (
    <div 
      title={label} 
      className={cn(
        'w-full aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold transition-all cursor-default transform hover:scale-105 hover:z-10', 
        bg, text
      )}
    >
      {count > 0 ? count : ''}
    </div>
  )
}

// ─── Retention cohort table ──────────────────────────────────────────────────

function CohortTable({ cohorts }: { cohorts: any[] }) {
  if (!cohorts.length) return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-4">
      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
        <Clock size={32} />
      </div>
      <div>
        <p className="text-gray-900 font-bold">Waiting for more data</p>
        <p className="text-gray-500 text-sm max-w-[240px] mt-1">Cohort analysis requires at least two months of consistent order history.</p>
      </div>
    </div>
  )

  const months  = [...new Set(cohorts.map(c => c.cohort_month))]
  const maxOffset = Math.max(...cohorts.map(c => c.period_offset))
  const sizes: Record<string, number> = {}
  cohorts.forEach(c => { if (c.period_offset === 0) sizes[c.cohort_month] = Number(c.cohort_size) })
  const matrix: Record<string, Record<number, number>> = {}
  cohorts.forEach(c => {
    if (!matrix[c.cohort_month]) matrix[c.cohort_month] = {}
    matrix[c.cohort_month][c.period_offset] = Number(c.retention_pct)
  })

  function retColor(pct: number | undefined) {
    if (pct === undefined) return 'bg-gray-50 text-gray-300'
    if (pct >= 80) return 'bg-emerald-500 text-white shadow-sm'
    if (pct >= 60) return 'bg-emerald-400/80 text-emerald-950'
    if (pct >= 40) return 'bg-emerald-200 text-emerald-900'
    if (pct >= 20) return 'bg-blue-100 text-blue-900'
    return 'bg-blue-50 text-blue-600'
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto -mx-8 px-8">
        <table className="text-xs w-full border-separate border-spacing-x-1 border-spacing-y-1">
          <thead>
            <tr>
              <th className="text-left py-3 px-3 font-bold text-gray-400 uppercase tracking-widest">Cohort</th>
              <th className="text-right py-3 px-3 font-bold text-gray-400 uppercase tracking-widest">Size</th>
              {Array.from({ length: maxOffset + 1 }, (_, i) => (
                <th key={i} className="text-center py-3 px-1 min-w-[56px] font-bold text-gray-400 uppercase tracking-widest">
                  {i === 0 ? 'M0' : `M+${i}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map(month => (
              <tr key={month} className="group">
                <td className="px-3 py-3 text-gray-900 font-black whitespace-nowrap bg-gray-50/50 rounded-l-xl group-hover:bg-blue-50 transition-colors">{month}</td>
                <td className="px-3 py-3 text-right text-gray-500 font-bold bg-gray-50/50 group-hover:bg-blue-50 transition-colors border-r border-white">{sizes[month] ?? 0}</td>
                {Array.from({ length: maxOffset + 1 }, (_, offset) => {
                  const pct = matrix[month]?.[offset]
                  return (
                    <td key={offset} className="p-0.5">
                      <div className={cn('h-10 flex items-center justify-center font-black transition-all hover:scale-110 hover:z-10 cursor-default rounded-lg', retColor(pct))}>
                        {pct !== undefined ? `${pct}%` : ''}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="flex items-center gap-4 py-4 px-6 bg-gray-50 rounded-2xl border border-gray-100">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Retention Scale:</span>
        <div className="flex flex-wrap gap-2">
          {[
            ['bg-emerald-500 text-white', '≥80%'],
            ['bg-emerald-200 text-emerald-900', '40–79%'],
            ['bg-blue-100 text-blue-900', '20–39%'],
            ['bg-blue-50 text-blue-600', '<20%'],
          ].map(([cls, label]) => (
            <span key={label} className={cn('text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-tight', cls)}>{label}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Rating Display ─────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={14} strokeWidth={3}
          className={i <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-100'} />
      ))}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function CustomersClient({
  merchantId, dateRange, overview, customerKpis,
  segments, cohorts, patterns, abandonmentStats,
  satisfactionSummary, reviews, newTrend, allCustomers,
}: {
  merchantId:          string
  dateRange:           { from: string; to: string }
  overview:            any
  customerKpis:        any[]
  segments:            any[]
  cohorts:             any[]
  patterns:            any[]
  abandonmentStats:    any
  satisfactionSummary: any
  reviews:             any[]
  newTrend:            any[]
  allCustomers:        any[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'overview'|'segments'|'retention'|'patterns'|'satisfaction'|'management'>('management')
  const [showPresets, setShowPresets] = useState(false)
  const [customFrom, setCustomFrom]   = useState(dateRange.from)
  const [customTo,   setCustomTo]     = useState(dateRange.to)
  const [segSearch,  setSegSearch]    = useState('')
  const [kpiSearch,  setKpiSearch]    = useState('')
  const [mgtSearch,  setMgtSearch]    = useState('')
  const [editingCustomer, setEditingCustomer] = useState<any>(null)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [timeline, setTimeline] = useState<any[]>([])
  const [loadingTimeline, setLoadingTimeline] = useState(false)

  // ── Derived Data for selection ─────────────────────────────────────────────
  
  // customerKpis comes from a SECURITY DEFINER function (bypasses RLS). 
  // allCustomers adds any customers missing from kpis (e.g. loyalty-only).
  const kpiIds = new Set(customerKpis.map(k => k.customer_id))
  const extraProfiles = allCustomers.filter(p => !kpiIds.has(p.id))

  const masterList = [
    ...customerKpis.map(kpi => ({
      id:         kpi.customer_id,
      full_name:  kpi.full_name  || 'Anonymous',
      email:      kpi.email      || '—',
      phone:      kpi.phone      || '—',
      created_at: kpi.registered_at || new Date().toISOString(),
      last_active: kpi.last_order_date || kpi.registered_at,
      orders_count: kpi.lifetime_orders,
      lifetime_value: kpi.lifetime_value,
    })),
    ...extraProfiles.map(profile => ({
      id:         profile.id,
      full_name:  profile.full_name || 'Anonymous',
      email:      profile.email     || '—',
      phone:      profile.phone     || '—',
      created_at: profile.created_at,
      last_active: profile.created_at,
      orders_count: 0,
      lifetime_value: 0,
    })),
  ]

  const selectedCustomer = masterList.find(c => c.id === selectedCustomerId) || masterList[0]

  useEffect(() => {
    if (selectedCustomerId && selectedCustomer) {
      const fetchTimeline = async () => {
        setLoadingTimeline(true)
        const supabase = createClient()
        const { data, error } = await supabase.rpc('get_customer_activity_timeline', {
          p_customer_id: selectedCustomerId,
          p_merchant_id: merchantId,
          p_customer_email: selectedCustomer.email === '—' ? null : selectedCustomer.email,
          p_customer_phone: selectedCustomer.phone === '—' ? null : selectedCustomer.phone
        })
        if (!error) setTimeline(data || [])
        else console.error('Timeline error:', error.message, error.details, error.hint)
        setLoadingTimeline(false)
      }
      fetchTimeline()
    }
  }, [selectedCustomerId, selectedCustomer?.email, selectedCustomer?.phone, merchantId])

  const applyRange = (from: string, to: string) => {
    router.push(`/customers?from=${from}&to=${to}`)
    setShowPresets(false)
  }

  // ── Derived Data ──────────────────────────────────────────────────────────

  const COLORS = ['#3b82f6','#10b981','#8b5cf6','#06b6d4','#f59e0b','#ef4444','#64748b','#ec4899']

  const trendData = newTrend.map(d => ({
    date:     format(parseISO(d.date), 'd MMM'),
    new:      Number(d.new_count),
    total:    Number(d.total_count),
  }))

  const heatmap = Array.from({ length: 7 }, () => new Array(24).fill(0))
  patterns.forEach(p => {
    const d = Number(p.day_of_week), h = Number(p.hour_of_day)
    if (d >= 0 && d < 7 && h >= 0 && h < 24) heatmap[d][h] = Number(p.order_count)
  })
  const heatMax = Math.max(...heatmap.flat())

  const segmentCounts = segments.reduce((acc: Record<string, number>, c) => {
    acc[c.segment] = (acc[c.segment] ?? 0) + 1
    return acc
  }, {})
  
  const segmentPie = Object.entries(segmentCounts).map(([seg, count], i) => ({
    name: seg, value: count, color: SEGMENT_META[seg]?.bg.replace('bg-','text-').replace('-50','-500') || COLORS[i % COLORS.length],
  }))

  const filteredSegments = segments.filter(s =>
    segSearch === '' ||
    s.full_name?.toLowerCase().includes(segSearch.toLowerCase()) ||
    s.email?.toLowerCase().includes(segSearch.toLowerCase()) ||
    s.segment?.toLowerCase().includes(segSearch.toLowerCase())
  )

  const filteredKpis = customerKpis.filter(c =>
    kpiSearch === '' ||
    c.full_name?.toLowerCase().includes(kpiSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(kpiSearch.toLowerCase())
  )

  const topCouponUsers = [...customerKpis]
    .filter(c => Number(c.coupon_uses) > 0)
    .sort((a, b) => Number(b.coupon_uses) - Number(a.coupon_uses))
    .slice(0, 10)

  const ratingDist = [5,4,3,2,1].map(r => ({
    stars:   r,
    count:   Number(satisfactionSummary[['','one','two','three','four','five'][r] + '_star'] ?? 0),
    pct:     satisfactionSummary.total_reviews > 0
               ? Math.round(Number(satisfactionSummary[['','one','two','three','four','five'][r] + '_star'] ?? 0)
                   / Number(satisfactionSummary.total_reviews) * 100)
               : 0,
  }))

  // (masterList moved up)

  // Filtered Management list
  const filteredMgt = masterList.filter(c =>
    mgtSearch === '' ||
    c.full_name?.toLowerCase().includes(mgtSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(mgtSearch.toLowerCase()) ||
    c.phone?.toLowerCase().includes(mgtSearch.toLowerCase())
  )

  // (selectedCustomer moved up)

  const totalDays = Math.round((new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / 86400000) + 1

  return (
    <div className="space-y-8 pb-20">
      {/* ── Header & Date Range ──────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 transition-all">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Customers Directory</h1>
          <p className="text-gray-500 font-medium">Manage relationships and track customer lifetime value.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-[24px] border border-gray-100 shadow-sm transition-all hover:shadow-md">
          <div className="relative">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowPresets(v => !v)}
              className="flex items-center gap-2 h-10 px-4 rounded-xl font-bold text-gray-700 hover:bg-gray-50"
            >
              <Calendar size={18} className="text-blue-500" />
              {format(parseISO(dateRange.from), 'd MMM')} — {format(parseISO(dateRange.to), 'd MMM yyyy')}
              <Badge variant="outline" className="ml-1 bg-gray-50 border-gray-100 text-gray-400 font-bold px-1.5 py-0">
                {totalDays}D
              </Badge>
              <ChevronDown size={14} className={cn("transition-transform duration-300", showPresets && "rotate-180")} />
            </Button>
            {showPresets && (
              <div className="absolute top-12 right-0 z-[60] bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 min-w-[200px] animate-in fade-in zoom-in-95 duration-200">
                <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50 mb-1">
                  Presets
                </div>
                {DATE_PRESETS.map(p => (
                  <button key={p.label} onClick={() => { const r = p.fn(); applyRange(r.from, r.to) }}
                    className="w-full text-left px-4 py-2.5 text-sm font-semibold rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-colors text-gray-700">
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="h-6 w-px bg-gray-100 mx-1 secret-mobile-hide" />
          
          <div className="flex items-center gap-2 px-2">
            <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-32 h-9 rounded-lg border-gray-100 bg-gray-50/50 focus:bg-white text-xs font-semibold" />
            <span className="text-gray-300">→</span>
            <Input type="date" value={customTo}   onChange={e => setCustomTo(e.target.value)}   className="w-32 h-9 rounded-lg border-gray-100 bg-gray-50/50 focus:bg-white text-xs font-semibold" />
            <Button 
              size="sm" 
              onClick={() => applyRange(customFrom, customTo)}
              disabled={!customFrom || !customTo || customFrom > customTo}
              className="h-9 px-4 rounded-lg bg-gray-900 hover:bg-black text-white font-bold transition-all disabled:opacity-30"
            >
              Apply
            </Button>
          </div>
        </div>
      </div>

      {/* ── Headline Metrics ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard 
          icon={<Users size={22} />} 
          iconBg="bg-blue-50" 
          iconColor="text-blue-600"
          label="Active Customers" 
          value={String(n(overview.total_customers))}
          sub={`${n(overview.avg_orders_per_cust).toFixed(1)} orders per capita`}
          trend={{ value: '12%', positive: true }}
        />
        <StatCard 
          icon={<UserPlus size={22} />} 
          iconBg="bg-emerald-50" 
          iconColor="text-emerald-600"
          label="New Joiners" 
          value={String(n(overview.new_customers))}
          sub={`${n(overview.returning_customers)} returning visitors`}
          trend={{ value: '8.4%', positive: true }}
        />
        <StatCard 
          icon={<RefreshCw size={22} />} 
          iconBg="bg-violet-50" 
          iconColor="text-violet-600"
          label="Retention"
          value={overview.retention_rate != null ? `${overview.retention_rate}%` : '—'}
          sub={`${n(overview.churned_customers)} customers churned`}
          trend={{ value: '2.1%', positive: false }}
        />
        <StatCard 
          icon={<TrendingUp size={22} />} 
          iconBg="bg-amber-50" 
          iconColor="text-amber-600"
          label="Avg Lifetime Val" 
          value={rm(overview.avg_ltv)}
          sub={`Order every ${n(overview.avg_days_between).toFixed(0)} days`}
          trend={{ value: '18%', positive: true }}
        />
      </div>

      {/* ── Tab Navigation ────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 -mx-4 px-4 py-4 bg-gray-50/80 backdrop-blur-md border-b border-gray-100 transition-all">
        <div className="flex gap-1.5 p-1.5 bg-gray-200/50 rounded-[20px] w-fit mx-auto lg:mx-0 overflow-x-auto no-scrollbar max-w-full">
          {[
            { key: 'management',   label: 'Directory' },
            { key: 'overview',     label: 'Overview' },
            { key: 'segments',     label: 'Segmentation' },
            { key: 'retention',    label: 'Retention' },
            { key: 'patterns',     label: 'Purchase Patterns' },
            { key: 'satisfaction', label: 'Satisfaction' },
          ].map(t => (
            <button 
              key={t.key} 
              onClick={() => setTab(t.key as any)}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-[14px] text-sm font-bold transition-all duration-300 whitespace-nowrap',
                tab === t.key 
                  ? 'bg-white shadow-lg shadow-gray-200/50 text-gray-900 border border-gray-100' 
                  : 'text-gray-400 hover:text-gray-800 hover:bg-white/50'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════ MANAGEMENT TAB ══════════════════════════════════════════════ */}
      {/* ══════ DIRECTORY TAB (SIMPLE LIST) ═════════════════════════════════ */}
      {tab === 'management' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Section 
            title="Overview" 
            icon={Users}
            action={
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input 
                  placeholder="Search directory..." 
                  value={mgtSearch}
                  onChange={e => setMgtSearch(e.target.value)}
                  className="h-10 pl-9 pr-4 w-72 text-[12px] font-bold rounded-xl border-gray-100 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all font-medium" 
                />
              </div>
            }
          >
            <div className="overflow-x-auto -mx-8 px-8 pb-4">
              <table className="w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-[11px] font-black text-gray-400 uppercase tracking-widest">
                    <th className="py-4 px-6">Customer</th>
                    <th className="py-4 px-6">Contact</th>
                    <th className="py-4 px-6">Lifetime Spend</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMgt.map(c => (
                    <tr 
                      key={c.id} 
                      onClick={() => { setSelectedCustomerId(c.id); setShowDetails(true) }}
                      className="group bg-white hover:bg-gray-50/50 transition-all duration-300 rounded-[24px] border border-transparent hover:border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-200/30 cursor-pointer"
                    >
                      <td className="py-4 px-6 rounded-l-[24px]">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 font-black text-sm group-hover:scale-110 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                            {c.full_name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-gray-900 truncate max-w-[200px]">{c.full_name || 'Anonymous'}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Member since {format(new Date(c.created_at), 'MMM yyyy')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold text-gray-900">{c.email}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{c.phone || 'No phone'}</p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-0.5">
                          <p className="text-sm font-black text-emerald-600">{rm(c.lifetime_value)}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{c.orders_count} orders</p>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right rounded-r-[24px]">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-9 w-9 p-0 rounded-xl hover:bg-blue-50 text-gray-300 group-hover:text-blue-600 transition-all"
                        >
                          <ArrowRight size={18} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredMgt.length === 0 && (
                <div className="py-20 text-center space-y-4">
                   <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
                     <Search size={32} />
                   </div>
                   <div>
                     <p className="text-gray-900 font-bold">No customers found</p>
                     <p className="text-gray-500 text-sm">Try adjusting your search query.</p>
                   </div>
                </div>
              )}
            </div>
          </Section>
        </div>
      )}

      {/* ══════ OVERVIEW TAB ══════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Growth Chart */}
            <div className="lg:col-span-2">
              <Section title="Growth Intelligence" icon={TrendingUp}>
                <div className="h-[320px] w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}    />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} 
                        tickLine={false} 
                        axisLine={false}
                        dy={10}
                        interval={Math.ceil(trendData.length / 10)} 
                      />
                      <YAxis 
                        tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} 
                        tickLine={false} 
                        axisLine={false} 
                        width={40} 
                      />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '20px', 
                          border: 'none', 
                          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                          padding: '12px 16px'
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="new"   
                        stroke="#3b82f6" 
                        strokeWidth={4} 
                        fill="url(#growthGradient)" 
                        name="New Customers" 
                        dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            </div>

            {/* Shopping funnel */}
            <Section title="Conversion Funnel" icon={Target}>
              <div className="space-y-6 pt-4">
                {[
                  { label: 'Potential Opportunity', value: n(abandonmentStats.total_carts), color: 'bg-blue-500', icon: '🛒' },
                  { label: 'Completed Purchases', value: n(abandonmentStats.converted_carts), color: 'bg-emerald-500', icon: '✅' },
                  { label: 'Drop-off Rate', value: `${n(abandonmentStats.abandonment_rate)}%`, color: 'bg-rose-500', icon: '🛑' },
                ].map((item, idx) => (
                  <div key={item.label} className="group flex items-start gap-4 p-4 rounded-2xl transition-all hover:bg-gray-50 border border-transparent hover:border-gray-100">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm", item.color)}>
                      <span className="text-lg">{item.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.label}</p>
                        <p className="text-lg font-black text-gray-900">{item.value}</p>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full transition-all duration-1000", item.color)} 
                          style={{ width: idx === 0 ? '100%' : idx === 1 ? `${(n(abandonmentStats.converted_carts)/n(abandonmentStats.total_carts)*100) || 0}%` : `${abandonmentStats.abandonment_rate || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                
                <div className="mt-8 p-6 bg-gradient-to-br from-rose-500 to-rose-600 rounded-[24px] text-white shadow-xl shadow-rose-200/50">
                  <div className="flex items-center gap-3 mb-2">
                    <ShieldAlert size={20} className="text-rose-100" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-100">Recovery potential</p>
                  </div>
                  <p className="text-3xl font-black">{rm(abandonmentStats.lost_revenue)}</p>
                  <p className="text-[11px] font-medium text-rose-100 mt-1 opacity-80">Lost revenue from abandoned carts this period.</p>
                </div>
              </div>
            </Section>
          </div>

          {/* Efficiency rankings */}
          <Section 
            title="High performance individuals" 
            icon={Zap}
            action={
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input 
                    placeholder="Quick search..." 
                    value={kpiSearch}
                    onChange={e => setKpiSearch(e.target.value)}
                    className="h-9 pl-9 pr-4 w-48 text-[11px] font-bold rounded-xl border-gray-100 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all" 
                  />
                </div>
                <Button size="sm" variant="outline" className="h-9 rounded-xl border-gray-100 font-black text-[10px] uppercase tracking-widest px-4 hover:bg-gray-50 bg-white"
                   onClick={() => exportCSV([['Name','Email','Orders','Revenue','AOV','LTV','Last Order'], ...customerKpis.map(c => [c.full_name, c.email, c.orders_in_period, c.revenue_in_period, c.aov_in_period, c.lifetime_value, c.last_order_date])], 'customer_kpis.csv')}>
                  <Download size={14} className="mr-2" /> Export
                </Button>
              </div>
            }
          >
            <div className="overflow-x-auto -mx-8 px-8 pb-4">
              <table className="w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-[11px] font-black text-gray-400 uppercase tracking-widest">
                    <th className="py-4 px-6">Identity</th>
                    <th className="py-4 px-6 sr-only">Segment</th>
                    <th className="py-4 px-6">Volume</th>
                    <th className="py-4 px-6">LTV Performance</th>
                    <th className="py-4 px-6 text-right">Recency</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKpis.slice(0, 50).map(c => (
                    <tr key={c.customer_id} className="group bg-white hover:bg-gray-50/50 transition-all duration-300 rounded-[24px] border border-transparent hover:border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-200/30">
                      <td className="py-4 px-6 rounded-l-[24px]">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100/50 flex items-center justify-center text-blue-600 font-black text-sm group-hover:scale-110 transition-transform">
                            {c.full_name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-gray-900 truncate max-w-[200px]">{c.full_name || 'Guest User'}</p>
                            <p className="text-[11px] text-gray-400 font-bold truncate max-w-[200px]">{c.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="bg-emerald-50 text-emerald-600 font-black text-[10px] uppercase px-3 py-1 rounded-lg w-fit">
                          Top Tier
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-0.5">
                          <p className="text-sm font-black text-gray-900">{c.orders_in_period} Orders</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{rm(c.aov_in_period)} avg</p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-0.5">
                          <p className="text-sm font-black text-blue-600">{rm(c.lifetime_value)}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{c.lifetime_orders} Lifetime</p>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right rounded-r-[24px]">
                        <p className="text-xs font-black text-gray-900">{c.last_order_date ? format(new Date(c.last_order_date), 'd MMM yyyy') : 'No history'}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Last seen</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}

      {/* ══════ SEGMENTS TAB ══════════════════════════════════════════════ */}
      {tab === 'segments' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Section title="Market Share" icon={PieChart}>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={segmentPie} 
                      dataKey="value" 
                      nameKey="name"
                      cx="50%" cy="50%" 
                      outerRadius={100} 
                      innerRadius={60}
                      paddingAngle={4}
                    >
                      {segmentPie.map((s, i) => <Cell key={i} fill={s.color} fillOpacity={0.8} />)}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Section>

            <div className="lg:col-span-2">
              <Section title="Segment Intelligence" icon={Target}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(segmentCounts).sort((a,b) => b[1] - a[1]).map(([seg, count]) => {
                    const meta = SEGMENT_META[seg] || SEGMENT_META['Lost']
                    const Icon  = meta.icon
                    return (
                      <div key={seg} className="p-5 rounded-[24px] border border-gray-100 bg-white hover:border-blue-100 transition-all group overflow-hidden relative">
                        <div className={cn("absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-[0.03] group-hover:scale-150 transition-transform duration-700", meta.bg)} />
                        <div className="flex items-center gap-4">
                          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm", meta.bg, meta.color)}>
                            <Icon size={22} />
                          </div>
                          <div>
                            <p className="font-black text-gray-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight text-xs">{seg}</p>
                            <p className="text-[11px] font-medium text-gray-500 mt-0.5">{meta.desc}</p>
                          </div>
                          <div className="ml-auto text-right">
                            <p className="text-xl font-black text-gray-900">{count}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Profiles</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Section>
            </div>
          </div>

          <Section 
            title="RFM Analysis Dashboard" 
            icon={Target}
            action={
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input placeholder="Filter cohorts..." value={segSearch} onChange={e => setSegSearch(e.target.value)} className="h-9 pl-9 w-48 text-[11px] font-bold rounded-xl border-gray-100 bg-gray-50" />
              </div>
            }
          >
             <div className="overflow-x-auto -mx-8 px-8">
              <table className="w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-[11px] font-black text-gray-400 uppercase tracking-widest">
                    <th className="py-4 px-6">Customer</th>
                    <th className="py-4 px-6">Category</th>
                    <th className="py-4 px-6">Recency</th>
                    <th className="py-4 px-6">Frequency</th>
                    <th className="py-4 px-6">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSegments.slice(0, 50).map(s => {
                    const meta = SEGMENT_META[s.segment] || SEGMENT_META['Lost']
                    return (
                      <tr key={s.customer_id} className="group bg-white hover:bg-gray-50/50 transition-all rounded-[24px] border border-transparent hover:border-gray-100 shadow-sm">
                        <td className="py-4 px-6 rounded-l-[24px]">
                           <div className="flex items-center gap-3">
                             <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-black", meta.bg, meta.color)}>
                               {s.full_name?.charAt(0).toUpperCase() || 'U'}
                             </div>
                             <p className="font-black text-gray-900 truncate max-w-[150px]">{s.full_name || 'Guest'}</p>
                           </div>
                        </td>
                        <td className="py-4 px-6">
                           <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-black text-[10px] uppercase tracking-tight", meta.bg, meta.color)}>
                             <meta.icon size={12} /> {s.segment}
                           </div>
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-xs font-bold text-gray-700">{s.recency_days} days</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase">Since last order</p>
                        </td>
                        <td className="py-4 px-6">
                           <p className="text-sm font-black text-gray-900">{s.frequency} Orders</p>
                           <p className="text-[10px] text-blue-600 font-bold uppercase">{rm(s.monetary)} total</p>
                        </td>
                        <td className="py-4 px-6 rounded-r-[24px]">
                           <div className="flex items-center gap-1">
                             {[s.r_score, s.f_score, s.m_score].map((sc, i) => (
                               <div key={i} className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black", 
                                 sc >= 4 ? 'bg-emerald-500 text-white' : sc >= 2 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400')}>
                                 {sc}
                               </div>
                             ))}
                           </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
             </div>
          </Section>
        </div>
      )}

      {/* ══════ RETENTION TAB ══════════════════════════════════════════════ */}
      {tab === 'retention' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Section title="Customer Lifecycle Monitor" icon={Heart}>
            <StatCard 
              icon={<Heart size={22} />} 
              iconBg="bg-rose-50" 
              iconColor="text-rose-600"
              label="Overall Loyalty" 
              value={n(overview.retention_rate) > 0 ? `${overview.retention_rate}%` : '—'}
              sub="Percentage of customers coming back"
              trend={{ value: '2.4%', positive: true }}
            />
            <div className="mt-12">
              <CohortTable cohorts={cohorts} />
            </div>
          </Section>
        </div>
      )}

      {/* ══════ PATTERNS TAB ═══════════════════════════════════════════════ */}
      {tab === 'patterns' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Section title="Peak Ordering Behaviour" icon={Clock} className="relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Clock size={200} />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-1 space-y-6">
                <div className="p-6 bg-blue-50 rounded-[28px] border border-blue-100/50">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Golden Hour</p>
                  <p className="text-2xl font-black text-blue-900">
                    {HOURS[heatmap.map(day => day.indexOf(Math.max(...day))).reduce((a,b)=>a+b)/7 | 0]}
                  </p>
                  <p className="text-[11px] font-medium text-blue-700/70 mt-1">Average peak activity time across all days.</p>
                </div>
                
                <div className="p-6 bg-emerald-50 rounded-[28px] border border-emerald-100/50">
                   <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Top Volume Day</p>
                   <p className="text-2xl font-black text-emerald-900">
                     {DAYS[heatmap.map(day => day.reduce((a,b)=>a+b,0)).indexOf(Math.max(...heatmap.map(day => day.reduce((a,b)=>a+b,0))))]}
                   </p>
                   <p className="text-[11px] font-medium text-emerald-700/70 mt-1">Highest cumulative order count per week.</p>
                </div>
              </div>
              
              <div className="lg:col-span-3">
                <div className="overflow-x-auto h-full">
                  <div className="min-w-[800px] h-full space-y-2">
                    <div className="grid grid-cols-25 gap-1 mb-4">
                      <div className="w-16" />
                      {HOURS.map(h => (
                        <div key={h} className="text-center text-[10px] font-black text-gray-400 uppercase tracking-tighter">{h}</div>
                      ))}
                    </div>
                    {DAYS.map((day, dIdx) => (
                      <div key={day} className="grid grid-cols-25 gap-1 items-center">
                        <div className="w-16 text-[11px] font-black text-gray-900">{day}</div>
                        {heatmap[dIdx].map((val, hIdx) => (
                          <HeatCell key={hIdx} count={val} max={heatMax} label={`${DAYS[dIdx]} @ ${HOURS[hIdx]}`} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* ══════ SATISFACTION TAB ══════════════════════════════════════════ */}
      {tab === 'satisfaction' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Section title="Community Sentiment" icon={Star}>
              <div className="flex flex-col items-center justify-center h-full space-y-6 py-8">
                <div className="relative">
                  <div className="text-center">
                    <p className="text-7xl font-black text-gray-900 tracking-tighter transition-all hover:scale-110 duration-500 cursor-default">
                      {n(satisfactionSummary.avg_rating).toFixed(1)}
                    </p>
                    <div className="mt-2 flex justify-center">
                      <Stars rating={Math.round(n(satisfactionSummary.avg_rating))} />
                    </div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mt-4">
                      {n(satisfactionSummary.total_reviews)} REVIEWS
                    </p>
                  </div>
                </div>

                <div className="w-full space-y-3 pt-6 border-t border-gray-50">
                  {ratingDist.map(r => (
                    <div key={r.stars} className="flex items-center gap-4 group">
                      <span className="text-[10px] font-black text-gray-400 w-4">{r.stars}★</span>
                      <div className="flex-1 h-2 bg-gray-50 rounded-full overflow-hidden">
                         <div className="h-full bg-amber-400 rounded-full transition-all duration-1000 origin-left scale-x-0 group-hover:scale-x-100" style={{ width: `${r.pct}%` }} />
                      </div>
                      <span className="text-[10px] font-black text-gray-700 w-8 text-right">{r.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            <div className="lg:col-span-2">
              <Section title="Voices from your community" icon={Heart}>
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {reviews.length === 0 ? (
                    <p className="text-center text-gray-400 py-12 font-medium">No reviews recorded for this period.</p>
                  ) : (
                    reviews.map((r, idx) => (
                      <div key={idx} className="p-6 rounded-[24px] bg-white border border-gray-100 transition-all hover:shadow-xl hover:shadow-gray-200/30 hover:border-blue-100 group">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 font-black text-xs">
                              {r.customer?.full_name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div>
                               <p className="font-black text-gray-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight text-[11px]">{r.customer?.full_name || 'Verified User'}</p>
                               <Stars rating={r.rating} />
                            </div>
                          </div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{format(new Date(r.created_at), 'd MMM')}</p>
                        </div>
                        <p className="text-sm text-gray-700 font-medium leading-relaxed italic">"{r.comment || 'The customer didn\'t leave a written review.'}"</p>
                        <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                           <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Order #{r.order?.order_number}</p>
                           <Button variant="ghost" size="sm" className="h-7 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900">Flag Review</Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Section>
            </div>
          </div>
        </div>
      )}

      <CustomerEditSheet 
        customer={editingCustomer} 
        open={!!editingCustomer} 
        onOpenChange={(open) => !open && setEditingCustomer(null)}
        onSuccess={() => {
          router.refresh()
          setEditingCustomer(null)
        }}
      />

      <Sheet open={showDetails} onOpenChange={setShowDetails}>
        <SheetContent className="data-[side=right]:sm:max-w-3xl bg-white border-l border-gray-100 p-0 overflow-hidden flex flex-col transition-all duration-500">
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <CustomerDetailsView 
              customer={selectedCustomer} 
              onEdit={(c: any) => { 
                setEditingCustomer(c); 
                setShowDetails(false) 
              }} 
              timeline={timeline}
              loadingTimeline={loadingTimeline}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
