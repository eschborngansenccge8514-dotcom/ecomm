'use client'
import { useState }     from 'react'
import { useRouter }    from 'next/navigation'
import { format, parseISO, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Button }  from '@/components/ui/button'
import { Input }   from '@/components/ui/input'
import { cn }      from '@/lib/utils'
import {
  Users, UserPlus, UserCheck, UserX, TrendingUp,
  ShoppingBag, Star, ShoppingCart, RefreshCw, ChevronDown, Download,
} from 'lucide-react'

// ─── Constants ─────────────────────────────────────────────────────────────

const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const HOURS  = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i-12}pm`)

const SEGMENT_META: Record<string, { color: string; bg: string; desc: string }> = {
  'Champion':        { color: 'text-yellow-700', bg: 'bg-yellow-101', desc: 'Recent, frequent, high spend' },
  'Loyal':           { color: 'text-green-700',  bg: 'bg-green-101',  desc: 'Consistently buying'         },
  'Potential Loyal': { color: 'text-blue-700',   bg: 'bg-blue-101',   desc: 'Recent with 2+ orders'       },
  'New Customer':    { color: 'text-cyan-700',   bg: 'bg-cyan-101',   desc: 'First purchase recently'     },
  'Needs Attention': { color: 'text-orange-700', bg: 'bg-orange-101', desc: 'Below average engagement'    },
  'At Risk':         { color: 'text-amber-700',  bg: 'bg-amber-101',  desc: 'Was active, going quiet'     },
  'Cannot Lose Them':{ color: 'text-red-700',    bg: 'bg-red-101',    desc: 'Big spenders going dormant'  },
  'Lost':            { color: 'text-gray-500',   bg: 'bg-gray-101',   desc: 'Haven\'t bought in a while'  },
}

const DATE_PRESETS = [
  { label: 'Last 7 days',  fn: () => ({ from: format(subDays(new Date(),6),'yyyy-MM-dd'), to: format(new Date(),'yyyy-MM-dd') }) },
  { label: 'Last 30 days', fn: () => ({ from: format(subDays(new Date(),29),'yyyy-MM-dd'), to: format(new Date(),'yyyy-MM-dd') }) },
  { label: 'This month',   fn: () => ({ from: format(startOfMonth(new Date()),'yyyy-MM-dd'), to: format(endOfMonth(new Date()),'yyyy-MM-dd') }) },
  { label: 'Last month',   fn: () => ({ from: format(startOfMonth(subMonths(new Date(),1)),'yyyy-MM-dd'), to: format(endOfMonth(subMonths(new Date(),1)),'yyyy-MM-dd') }) },
  { label: 'Last 3 months',fn: () => ({ from: format(subDays(new Date(),89),'yyyy-MM-dd'), to: format(new Date(),'yyyy-MM-dd') }) },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

const rm = (v: number) => `RM ${Number(v ?? 0).toFixed(2)}`
const n  = (v: number) => Number(v ?? 0)

function StatCard({ icon, label, value, sub, iconBg, iconColor }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; iconBg: string; iconColor: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', iconBg, iconColor)}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function Section({ title, action, children, className }: {
  title: string; action?: React.ReactNode; children: React.ReactNode; className?: string
}) {
  return (
    <div className={cn('bg-white rounded-2xl border border-gray-100 p-5', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900">{title}</h3>
        {action}
      </div>
      {children}
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
  const bg = intensity === 0   ? 'bg-gray-50 border border-gray-100'
           : intensity < 0.25  ? 'bg-blue-100'
           : intensity < 0.5   ? 'bg-blue-300'
           : intensity < 0.75  ? 'bg-blue-500'
           : 'bg-blue-700'
  const text = intensity >= 0.5 ? 'text-white' : 'text-gray-600'
  return (
    <div title={label} className={cn('w-full aspect-square rounded-md flex items-center justify-center text-[9px] font-medium', bg, text)}>
      {count > 0 ? count : ''}
    </div>
  )
}

// ─── Retention cohort table ──────────────────────────────────────────────────

function CohortTable({ cohorts }: { cohorts: any[] }) {
  if (!cohorts.length) return (
    <p className="text-gray-400 text-sm text-center py-8">Not enough order history for cohort analysis</p>
  )

  // Build matrix: { cohortMonth → { periodOffset → retention_pct } }
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
    if (pct >= 80) return 'bg-green-500 text-white'
    if (pct >= 60) return 'bg-green-300 text-green-900'
    if (pct >= 40) return 'bg-yellow-200 text-yellow-900'
    if (pct >= 20) return 'bg-orange-200 text-orange-900'
    return 'bg-red-100 text-red-700'
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full">
        <thead>
          <tr>
            <th className="text-left text-gray-400 font-medium pb-2 pr-3 whitespace-nowrap">Cohort</th>
            <th className="text-right text-gray-400 font-medium pb-2 pr-3">Size</th>
            {Array.from({ length: maxOffset + 1 }, (_, i) => (
              <th key={i} className="text-center text-gray-400 font-medium pb-2 px-1 min-w-[48px]">
                {i === 0 ? 'M0' : `M+${i}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {months.map(month => (
            <tr key={month}>
              <td className="pr-3 py-1.5 text-gray-700 font-medium whitespace-nowrap">{month}</td>
              <td className="pr-3 py-1.5 text-right text-gray-500">{sizes[month] ?? 0}</td>
              {Array.from({ length: maxOffset + 1 }, (_, offset) => {
                const pct = matrix[month]?.[offset]
                return (
                  <td key={offset} className="px-1 py-1.5">
                    <div className={cn('rounded-lg text-center py-1 font-semibold', retColor(pct))}>
                      {pct !== undefined ? `${pct}%` : '—'}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <span className="text-xs text-gray-400">Retention scale:</span>
        {[
          ['bg-green-500 text-white', '≥80%'],
          ['bg-green-300 text-green-900', '60–79%'],
          ['bg-yellow-200 text-yellow-900', '40–59%'],
          ['bg-orange-200 text-orange-900', '20–39%'],
          ['bg-red-100 text-red-700', '<20%'],
        ].map(([cls, label]) => (
          <span key={label} className={cn('text-xs px-2 py-0.5 rounded-md font-medium', cls)}>{label}</span>
        ))}
      </div>
    </div>
  )
}

// ─── Star rating display ─────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={12}
          className={i <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'} />
      ))}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function CustomersClient({
  merchantId, dateRange, overview, customerKpis,
  segments, cohorts, patterns, abandonmentStats,
  satisfactionSummary, reviews, newTrend,
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
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'overview'|'segments'|'retention'|'patterns'|'satisfaction'>('overview')
  const [showPresets, setShowPresets] = useState(false)
  const [customFrom, setCustomFrom]   = useState(dateRange.from)
  const [customTo,   setCustomTo]     = useState(dateRange.to)
  const [segSearch,  setSegSearch]    = useState('')
  const [kpiSearch,  setKpiSearch]    = useState('')

  const applyRange = (from: string, to: string) => {
    router.push(`/customers?from=${from}&to=${to}`)
    setShowPresets(false)
  }

  // ── Derived data ────────────────────────────────────────────────────────

  const COLORS = ['#f59e0b','#059669','#2563eb','#0891b2','#d97706','#dc2626','#6b7280','#7c3aed']

  // New vs returning trend
  const trendData = newTrend.map(d => ({
    date:     format(parseISO(d.date), 'd MMM'),
    new:      Number(d.new_count),
    total:    Number(d.total_count),
  }))

  // Heatmap matrix [day][hour] = count
  const heatmap = Array.from({ length: 7 }, () => new Array(24).fill(0))
  patterns.forEach(p => {
    const d = Number(p.day_of_week), h = Number(p.hour_of_day)
    if (d >= 0 && d < 7 && h >= 0 && h < 24) heatmap[d][h] = Number(p.order_count)
  })
  const heatMax = Math.max(...heatmap.flat())

  // Segment summary
  const segmentCounts = segments.reduce((acc: Record<string, number>, c) => {
    acc[c.segment] = (acc[c.segment] ?? 0) + 1
    return acc
  }, {})
  const segmentPie = Object.entries(segmentCounts).map(([seg, count], i) => ({
    name: seg, value: count, color: COLORS[i % COLORS.length],
  }))

  // Filtered segments list
  const filteredSegments = segments.filter(s =>
    segSearch === '' ||
    s.full_name?.toLowerCase().includes(segSearch.toLowerCase()) ||
    s.email?.toLowerCase().includes(segSearch.toLowerCase()) ||
    s.segment?.toLowerCase().includes(segSearch.toLowerCase())
  )

  // Filtered KPI list
  const filteredKpis = customerKpis.filter(c =>
    kpiSearch === '' ||
    c.full_name?.toLowerCase().includes(kpiSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(kpiSearch.toLowerCase())
  )

  // Top coupon users
  const topCouponUsers = [...customerKpis]
    .filter(c => Number(c.coupon_uses) > 0)
    .sort((a, b) => Number(b.coupon_uses) - Number(a.coupon_uses))
    .slice(0, 10)

  // Satisfaction distribution
  const ratingDist = [5,4,3,2,1].map(r => ({
    stars:   r,
    count:   Number(satisfactionSummary[['','one','two','three','four','five'][r] + '_star'] ?? 0),
    pct:     satisfactionSummary.total_reviews > 0
               ? Math.round(Number(satisfactionSummary[['','one','two','three','four','five'][r] + '_star'] ?? 0)
                   / Number(satisfactionSummary.total_reviews) * 100)
               : 0,
  }))

  const totalDays = Math.round((new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / 86400000) + 1

  return (
    <div className="space-y-5">

      {/* ── Date range bar ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Button variant="outline" size="sm" onClick={() => setShowPresets(v => !v)}
            className="flex items-center gap-2">
            📅 {dateRange.from} → {dateRange.to}
            <span className="text-gray-400">({totalDays}d)</span>
            <ChevronDown size={14} />
          </Button>
          {showPresets && (
            <div className="absolute top-10 left-0 z-20 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 min-w-[170px]">
              {DATE_PRESETS.map(p => (
                <button key={p.label} onClick={() => { const r = p.fn(); applyRange(r.from, r.to) }}
                  className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-gray-50 text-gray-700">
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-36 h-8 text-xs" />
          <span className="text-gray-400 text-sm">→</span>
          <Input type="date" value={customTo}   onChange={e => setCustomTo(e.target.value)}   className="w-36 h-8 text-xs" />
          <Button size="sm" variant="outline"
            onClick={() => applyRange(customFrom, customTo)}
            disabled={!customFrom || !customTo || customFrom > customTo}>
            Apply
          </Button>
        </div>
      </div>

      {/* ── Headline metrics ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard icon={<Users    size={16} />} iconBg="bg-blue-100"   iconColor="text-blue-600"
          label="Active Customers" value={String(n(overview.total_customers))}
          sub={`${n(overview.avg_orders_per_cust).toFixed(1)} orders avg`} />
        <StatCard icon={<UserPlus  size={16} />} iconBg="bg-green-100"  iconColor="text-green-600"
          label="New Customers"    value={String(n(overview.new_customers))}
          sub={`${n(overview.returning_customers)} returning`} />
        <StatCard icon={<RefreshCw size={16} />} iconBg="bg-purple-100" iconColor="text-purple-600"
          label="Retention Rate"
          value={overview.retention_rate != null ? `${overview.retention_rate}%` : '—'}
          sub={`${n(overview.churned_customers)} churned`} />
        <StatCard icon={<TrendingUp size={16} />} iconBg="bg-amber-100" iconColor="text-amber-600"
          label="Avg Lifetime Value" value={rm(overview.avg_ltv)}
          sub={`${n(overview.avg_days_between).toFixed(0)}d avg between orders`} />
      </div>

      {/* ── Section tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit flex-wrap">
        {[
          { key: 'overview',     label: '👥  Customers'   },
          { key: 'segments',     label: '🎯  Segments'    },
          { key: 'retention',    label: '📈  Retention'   },
          { key: 'patterns',     label: '⏰  Patterns'    },
          { key: 'satisfaction', label: '⭐  Satisfaction' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════ OVERVIEW TAB ══════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <div className="space-y-4">

          {/* New customer trend */}
          <Section title="Customer Growth">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cgrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#059669" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                  interval={Math.ceil(trendData.length / 8)} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={30} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }} />
                <Area type="monotone" dataKey="new"   stroke="#059669" strokeWidth={2} fill="url(#cgrad)" name="New customers" dot={false} />
                <Bar  dataKey="total" fill="#e0f2fe" radius={[2,2,0,0]} name="Cumulative" />
              </AreaChart>
            </ResponsiveContainer>
          </Section>

          {/* Cart abandonment */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              { label: 'Total Carts',       value: String(n(abandonmentStats.total_carts)),      icon: '🛒' },
              { label: 'Converted',         value: String(n(abandonmentStats.converted_carts)),  icon: '✅' },
              { label: 'Abandonment Rate',  value: n(abandonmentStats.abandonment_rate) > 0 ? `${abandonmentStats.abandonment_rate}%` : '—', icon: '⚠️' },
              { label: 'Lost Revenue',      value: rm(abandonmentStats.lost_revenue),            icon: '💸' },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-2xl mb-1">{card.icon}</p>
                <p className="text-xs text-gray-400">{card.label}</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Customer KPI table */}
          <Section title="Customer KPIs"
            action={
              <div className="flex gap-2">
                <Input placeholder="Search customers..." value={kpiSearch}
                  onChange={e => setKpiSearch(e.target.value)} className="h-8 text-xs w-40" />
                <Button variant="outline" size="sm" onClick={() =>
                  exportCSV([
                    ['Name','Email','Orders','Revenue','AOV','Lifetime Orders','LTV','Last Order','Coupon Uses'],
                    ...customerKpis.map(c => [c.full_name, c.email, c.orders_in_period, rm(c.revenue_in_period),
                      rm(c.aov_in_period), c.lifetime_orders, rm(c.lifetime_value),
                      c.last_order_date ? format(new Date(c.last_order_date),'d MMM yyyy') : '', c.coupon_uses]),
                  ], `customers-${dateRange.from}-${dateRange.to}.csv`)}>
                  <Download size={13} className="mr-1" /> Export
                </Button>
              </div>
            }>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50">
                    {['Customer','Orders','Revenue (period)','AOV','Lifetime Orders','LTV','Last Order','Coupons'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-400 pb-2 pr-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredKpis.map(c => (
                    <tr key={c.customer_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">
                            {(c.full_name ?? 'G').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 truncate max-w-[120px]">{c.full_name ?? 'Guest'}</p>
                            <p className="text-xs text-gray-400 truncate max-w-[120px]">{c.email ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-700 font-semibold">{c.orders_in_period}</td>
                      <td className="py-2.5 pr-4 font-bold text-gray-900">{rm(c.revenue_in_period)}</td>
                      <td className="py-2.5 pr-4 text-gray-600">{rm(c.aov_in_period)}</td>
                      <td className="py-2.5 pr-4 text-gray-600">{c.lifetime_orders}</td>
                      <td className="py-2.5 pr-4 font-semibold text-blue-600">{rm(c.lifetime_value)}</td>
                      <td className="py-2.5 pr-4 text-xs text-gray-400 whitespace-nowrap">
                        {c.last_order_date ? format(new Date(c.last_order_date), 'd MMM yyyy') : '—'}
                      </td>
                      <td className="py-2.5">
                        {Number(c.coupon_uses) > 0 && (
                          <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">
                            {c.coupon_uses}×
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Top coupon users */}
          {topCouponUsers.length > 0 && (
            <Section title="Top Coupon Users">
              <div className="space-y-2">
                {topCouponUsers.map((c, i) => (
                  <div key={c.customer_id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-400 font-bold w-5">#{i+1}</span>
                    <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-xs font-bold shrink-0">
                      {(c.full_name ?? 'G').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{c.full_name ?? 'Guest'}</p>
                      <p className="text-xs text-gray-400 truncate">{c.email ?? '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-amber-600">{c.coupon_uses}× coupons</p>
                      <p className="text-xs text-gray-400">{rm(c.revenue_in_period)} revenue</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* ══════ SEGMENTS TAB ══════════════════════════════════════════════ */}
      {tab === 'segments' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Segment pie */}
            <Section title="Segment Distribution">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={segmentPie} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={90} innerRadius={50}>
                    {segmentPie.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </Section>

            {/* Segment cards */}
            <Section title="Segment Summary">
              <div className="space-y-2">
                {Object.entries(segmentCounts)
                  .sort((a, b) => Number(b[1]) - Number(a[1]))
                  .map(([seg, count]) => {
                    const meta = SEGMENT_META[seg] ?? { color: 'text-gray-600', bg: 'bg-gray-100', desc: '' }
                    return (
                      <div key={seg} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                        <div>
                          <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', meta.bg, meta.color)}>
                            {seg}
                          </span>
                          <span className="text-xs text-gray-400 ml-2">{meta.desc}</span>
                        </div>
                        <span className="text-sm font-bold text-gray-800">{count} customers</span>
                      </div>
                    )
                  })}
              </div>
            </Section>
          </div>

          {/* Full segment table */}
          <Section title="All Customers — RFM Detail"
            action={
              <div className="flex gap-2">
                <Input placeholder="Search..." value={segSearch}
                  onChange={e => setSegSearch(e.target.value)} className="h-8 text-xs w-36" />
                <Button variant="outline" size="sm" onClick={() =>
                  exportCSV([
                    ['Name','Email','Segment','Recency (days)','Frequency','Monetary (RM)','R','F','M','RFM Score','Last Order'],
                    ...segments.map(s => [s.full_name, s.email, s.segment, s.recency_days,
                      s.frequency, s.monetary, s.r_score, s.f_score, s.m_score, s.rfm_score,
                      s.last_order_at ? format(new Date(s.last_order_at),'d MMM yyyy') : '']),
                  ], `rfm-segments-${new Date().toISOString().slice(0,10)}.csv`)}>
                  <Download size={13} className="mr-1" /> Export
                </Button>
              </div>
            }>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50">
                    {['Customer','Segment','Recency','Orders','LTV','R','F','M','Score','Last Order'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-400 pb-2 pr-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSegments.map(s => {
                    const meta = SEGMENT_META[s.segment] ?? { color: 'text-gray-600', bg: 'bg-gray-100', desc: '' }
                    return (
                      <tr key={s.customer_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                        <td className="py-2.5 pr-3">
                          <p className="font-semibold text-gray-800 truncate max-w-[110px]">{s.full_name ?? 'Guest'}</p>
                          <p className="text-xs text-gray-400 truncate max-w-[110px]">{s.email ?? '—'}</p>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap', meta.bg, meta.color)}>
                            {s.segment}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-sm text-gray-600 whitespace-nowrap">
                          {s.recency_days}d ago
                        </td>
                        <td className="py-2.5 pr-3 text-gray-700 font-semibold">{s.frequency}</td>
                        <td className="py-2.5 pr-3 font-bold text-blue-600">{rm(s.monetary)}</td>
                        {[s.r_score, s.f_score, s.m_score].map((score, i) => (
                          <td key={i} className="py-2.5 pr-3">
                            <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                              score >= 4 ? 'bg-green-100 text-green-700' :
                              score >= 3 ? 'bg-blue-100 text-blue-700'  :
                              score >= 2 ? 'bg-amber-100 text-amber-700': 'bg-red-100 text-red-600')}>
                              {score}
                            </span>
                          </td>
                        ))}
                        <td className="py-2.5 pr-3">
                          <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-lg font-bold">
                            {s.rfm_score}
                          </span>
                        </td>
                        <td className="py-2.5 text-xs text-gray-400 whitespace-nowrap">
                          {s.last_order_at ? format(new Date(s.last_order_at), 'd MMM yyyy') : '—'}
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

      {/* ══════ RETENTION TAB ═════════════════════════════════════════════ */}
      {tab === 'retention' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700">
            <strong>How to read this table:</strong> Each row is a cohort of customers whose first order was in that month.
            M0 = 100% (all customers active in their first month). M+1 = % still ordering the next month, etc.
            High percentages = strong repeat purchase behaviour.
          </div>
          <Section title="Monthly Cohort Retention">
            <CohortTable cohorts={cohorts} />
          </Section>

          {/* Retention + churn summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <p className="text-xs text-gray-400">Retention Rate</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                {overview.retention_rate != null ? `${overview.retention_rate}%` : '—'}
              </p>
              <p className="text-xs text-gray-400 mt-1">returned this period</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <p className="text-xs text-gray-400">Returning</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{n(overview.returning_customers)}</p>
              <p className="text-xs text-gray-400 mt-1">from previous period</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <p className="text-xs text-gray-400">Churned</p>
              <p className="text-3xl font-bold text-red-500 mt-1">{n(overview.churned_customers)}</p>
              <p className="text-xs text-gray-400 mt-1">didn't return</p>
            </div>
          </div>
        </div>
      )}

      {/* ══════ PATTERNS TAB ══════════════════════════════════════════════ */}
      {tab === 'patterns' && (
        <div className="space-y-4">
          {/* Day × Hour heatmap */}
          <Section title="Purchase Timing Heatmap (Malaysia Time — MYT UTC+8)">
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                {/* Hour labels */}
                <div className="flex ml-10 mb-1 gap-0.5">
                  {HOURS.map((h, i) => (
                    <div key={i} className="flex-1 text-center text-[8px] text-gray-400">{i % 3 === 0 ? h : ''}</div>
                  ))}
                </div>
                {/* Grid */}
                {DAYS.map((day, d) => (
                  <div key={d} className="flex items-center gap-0.5 mb-0.5">
                    <div className="w-9 text-xs text-gray-500 font-medium shrink-0">{day}</div>
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="flex-1">
                        <HeatCell
                          count={heatmap[d][h]}
                          max={heatMax}
                          label={`${day} ${HOURS[h]}: ${heatmap[d][h]} orders`}
                        />
                      </div>
                    ))}
                  </div>
                ))}
                {/* Scale */}
                <div className="flex items-center gap-2 mt-3 ml-10">
                  <span className="text-xs text-gray-400">Low</span>
                  {['bg-gray-50 border border-gray-100','bg-blue-100','bg-blue-300','bg-blue-500','bg-blue-700'].map((c, i) => (
                    <div key={i} className={cn('w-5 h-5 rounded', c)} />
                  ))}
                  <span className="text-xs text-gray-400">High</span>
                </div>
              </div>
            </div>
          </Section>

          {/* Day of week bar chart */}
          <Section title="Orders by Day of Week">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={DAYS.map((day, d) => ({
                day,
                orders: heatmap[d].reduce((s, v) => s + v, 0),
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={25} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }} />
                <Bar dataKey="orders" fill="#2563eb" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>

          {/* Avg days between orders */}
          <Section title="Purchase Frequency">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: 'Avg Days Between Orders', value: n(overview.avg_days_between) > 0 ? `${n(overview.avg_days_between).toFixed(0)} days` : '—', icon: '📅' },
                { label: 'Avg Orders per Customer', value: n(overview.avg_orders_per_cust) > 0 ? `${n(overview.avg_orders_per_cust).toFixed(1)}×` : '—', icon: '🔁' },
                { label: 'Avg LTV',                 value: rm(overview.avg_ltv),       icon: '💰' },
              ].map(stat => (
                <div key={stat.label} className="bg-gray-50 rounded-xl p-4">
                  <p className="text-2xl mb-1">{stat.icon}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5">{stat.value}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ══════ SATISFACTION TAB ══════════════════════════════════════════ */}
      {tab === 'satisfaction' && (
        <div className="space-y-4">
          {/* Summary row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <p className="text-xs text-gray-400">Avg Rating</p>
              <p className="text-4xl font-bold text-amber-500 mt-1">
                {satisfactionSummary.avg_rating > 0
                  ? Number(satisfactionSummary.avg_rating).toFixed(1) : '—'}
              </p>
              <Stars rating={Math.round(Number(satisfactionSummary.avg_rating))} />
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <p className="text-xs text-gray-400">Total Reviews</p>
              <p className="text-4xl font-bold text-gray-900 mt-1">{n(satisfactionSummary.total_reviews)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <p className="text-xs text-gray-400">NPS Score</p>
              <p className={cn('text-4xl font-bold mt-1',
                n(satisfactionSummary.nps_score) >= 50 ? 'text-green-600' :
                n(satisfactionSummary.nps_score) >= 0  ? 'text-amber-500' : 'text-red-500')}>
                {satisfactionSummary.nps_score != null ? satisfactionSummary.nps_score : '—'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">promoters − detractors</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <p className="text-xs text-gray-400">5★ Reviews</p>
              <p className="text-4xl font-bold text-green-600 mt-1">{n(satisfactionSummary.five_star)}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {satisfactionSummary.total_reviews > 0
                  ? `${Math.round(n(satisfactionSummary.five_star)/n(satisfactionSummary.total_reviews)*100)}% of total`
                  : '—'}
              </p>
            </div>
          </div>

          {/* Rating distribution */}
          <Section title="Rating Distribution">
            <div className="space-y-2.5">
              {ratingDist.map(r => (
                <div key={r.stars} className="flex items-center gap-3">
                  <Stars rating={r.stars} />
                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full transition-all"
                      style={{ width: `${r.pct}%` }} />
                  </div>
                  <span className="text-sm text-gray-500 w-8 text-right">{r.count}</span>
                  <span className="text-xs text-gray-400 w-8">{r.pct}%</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Review list */}
          <Section title="Recent Reviews">
            {reviews.length === 0 ? (
              <div className="text-center py-12">
                <Star size={32} className="mx-auto text-gray-200 mb-3" />
                <p className="text-gray-400 text-sm">No reviews in this period</p>
                <p className="text-gray-300 text-xs mt-1">
                  Reviews are submitted after delivery via the customer app
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map(r => (
                  <div key={r.id} className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">
                      {(r.customer?.full_name ?? 'G').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-800">{r.customer?.full_name ?? 'Customer'}</p>
                        <Stars rating={r.rating} />
                        <span className="text-xs text-gray-400">
                          {r.order?.order_number ? `• ${r.order.order_number}` : ''}
                        </span>
                      </div>
                      {r.comment && (
                        <p className="text-sm text-gray-600 mt-1 leading-relaxed">{r.comment}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {format(new Date(r.created_at), 'd MMM yyyy, h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  )
}
