'use client'
import { useState, useCallback } from 'react'
import { useRouter }   from 'next/navigation'
import { format, parseISO, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { cn }       from '@/lib/utils'
import toast        from 'react-hot-toast'
import {
  TrendingUp, TrendingDown, ShoppingBag, Users,
  Truck, Tag, RotateCcw, Receipt, Download,
  Minus, ChevronDown, CheckCircle2, XCircle, Clock,
  DollarSign, Percent, Loader2,
} from 'lucide-react'

// ─── Constants ──────────────────────────────────────────────────────────────

const COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#be185d','#65a30d','#ea580c','#6366f1']

const STATUS_COLOR: Record<string, string> = {
  delivered:        '#059669',
  out_for_delivery: '#0891b2',
  ready_for_pickup: '#7c3aed',
  preparing:        '#d97706',
  confirmed:        '#2563eb',
  paid:             '#6366f1',
  cancelled:        '#dc2626',
  pending:          '#9ca3af',
}

const MY_STATES: Record<string, string> = {
  'Johor': 'JHR', 'Kedah': 'KDH', 'Kelantan': 'KTN',
  'Melaka': 'MLK', 'Negeri Sembilan': 'NSN', 'Pahang': 'PHG',
  'Perak': 'PRK', 'Perlis': 'PLS', 'Pulau Pinang': 'PNG',
  'Sabah': 'SBH', 'Sarawak': 'SWK', 'Selangor': 'SGR',
  'Terengganu': 'TRG', 'Kuala Lumpur': 'KUL', 'Putrajaya': 'PJY', 'Labuan': 'LBN',
}

const DATE_PRESETS = [
  { label: 'Today',        fn: () => { const d = new Date(); return { from: format(d,'yyyy-MM-dd'), to: format(d,'yyyy-MM-dd') } } },
  { label: 'Yesterday',    fn: () => { const d = subDays(new Date(),1); return { from: format(d,'yyyy-MM-dd'), to: format(d,'yyyy-MM-dd') } } },
  { label: 'Last 7 days',  fn: () => ({ from: format(subDays(new Date(),6),'yyyy-MM-dd'), to: format(new Date(),'yyyy-MM-dd') }) },
  { label: 'Last 30 days', fn: () => ({ from: format(subDays(new Date(),29),'yyyy-MM-dd'), to: format(new Date(),'yyyy-MM-dd') }) },
  { label: 'This month',   fn: () => ({ from: format(startOfMonth(new Date()),'yyyy-MM-dd'), to: format(endOfMonth(new Date()),'yyyy-MM-dd') }) },
  { label: 'Last month',   fn: () => ({ from: format(startOfMonth(subMonths(new Date(),1)),'yyyy-MM-dd'), to: format(endOfMonth(subMonths(new Date(),1)),'yyyy-MM-dd') }) },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rm(v: number) { return `RM ${Number(v ?? 0).toFixed(2)}` }

function ChangePill({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-gray-300">—</span>
  const pos = value >= 0
  const isNaNValue = isNaN(value)
  if (isNaNValue) return <span className="text-xs text-gray-300">—</span>
  
  return (
    <span className={cn('flex items-center gap-0.5 text-xs font-semibold',
      pos ? 'text-green-600' : 'text-red-500')}>
      {pos ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {pos ? '+' : ''}{value.toFixed(1)}%
    </span>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ title, value, sub, change, icon, iconBg, iconColor, highlight }: {
  title: string; value: string; sub?: string; change: number | null
  icon: React.ReactNode; iconBg: string; iconColor: string; highlight?: boolean
}) {
  return (
    <div className={cn('bg-white rounded-2xl border p-5',
      highlight ? 'border-blue-200 ring-1 ring-blue-100' : 'border-gray-100')}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-400 font-medium">{title}</p>
          <p className="text-xl font-bold text-gray-900 mt-1 truncate">{value}</p>
          {sub  && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          <div className="mt-1.5"><ChangePill value={change} /></div>
        </div>
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ml-3', iconBg, iconColor)}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(rows: any[][], filename: string) {
  const csv  = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReportsClient({
  merchantId, dateRange, summary, changes,
  dailyRevenue, regionSales, statusBreakdown, couponUsage, refunds: initRefunds,
}: {
  merchantId:     string
  dateRange:      { from: string; to: string }
  summary:        any
  changes:        Record<string, number | null>
  dailyRevenue:   any[]
  regionSales:    any[]
  statusBreakdown: any[]
  couponUsage:    any[]
  refunds:        any[]
}) {
  const router  = useRouter()
  const supabase = createClient()

  const [customFrom, setCustomFrom] = useState(dateRange.from)
  const [customTo,   setCustomTo]   = useState(dateRange.to)
  const [showPresets, setShowPresets] = useState(false)
  const [refunds, setRefunds]       = useState(initRefunds)
  const [refundModal, setRefundModal] = useState<any>(null)
  const [tab, setTab] = useState<'overview' | 'orders' | 'regions' | 'coupons' | 'refunds'>('overview')

  const applyRange = (from: string, to: string) => {
    router.push(`/reports?from=${from}&to=${to}`)
    setShowPresets(false)
  }

  // Revenue chart data
  const revenueData = dailyRevenue.map(d => ({
    date:     format(parseISO(d.date), 'd MMM'),
    revenue:  Number(d.revenue),
    orders:   Number(d.orders),
    shipping: Number(d.shipping),
  }))

  // Region chart — normalise state names
  const regionData = regionSales.map(r => ({
    region:  MY_STATES[r.region] ?? r.region ?? 'Unknown',
    revenue: Number(r.total_revenue),
    orders:  Number(r.order_count),
  })).slice(0, 12)

  // Status pie
  const statusData = statusBreakdown.map(s => ({
    name:    s.status.replace(/_/g,' '),
    value:   Number(s.order_count),
    revenue: Number(s.total_revenue),
    color:   STATUS_COLOR[s.status] ?? '#9ca3af',
  }))

  // ── Refund helpers ──────────────────────────────────────────────────────
  const handleRefundStatus = async (refundId: string, newStatus: string) => {
    const { error } = await supabase.from('refunds')
      .update({ status: newStatus, processed_at: newStatus !== 'pending' ? new Date().toISOString() : null })
      .eq('id', refundId)
    if (error) { toast.error(error.message); return }
    setRefunds(prev => prev.map(r => r.id === refundId ? { ...r, status: newStatus } : r))
    toast.success(`Refund ${newStatus}`)
  }

  const handleCreateRefund = async (data: any) => {
    const { error, data: created } = await supabase.from('refunds')
      .insert({ ...data, merchant_id: merchantId })
      .select('*, order:orders(order_number, total_amount), customer:profiles(full_name)')
      .single()
    if (error) { toast.error(error.message); return }
    setRefunds(prev => [created, ...(prev ?? [])])
    setRefundModal(null)
    toast.success('Refund created')
  }

  // ── CSV exports ─────────────────────────────────────────────────────────
  const exportRevenue = () => exportCSV([
    ['Date', 'Revenue (RM)', 'Orders', 'Shipping (RM)'],
    ...dailyRevenue.map(d => [d.date, d.revenue, d.orders, d.shipping]),
  ], `revenue-${dateRange.from}-${dateRange.to}.csv`)

  const exportRegions = () => exportCSV([
    ['Region', 'Orders', 'Revenue (RM)', 'Shipping (RM)'],
    ...regionSales.map(r => [r.region, r.order_count, r.total_revenue, r.total_shipping]),
  ], `regions-${dateRange.from}-${dateRange.to}.csv`)

  const exportCoupons = () => exportCSV([
    ['Coupon Code', 'Uses', 'Total Discount (RM)', 'Total Order Value (RM)', 'Avg Order Value (RM)'],
    ...couponUsage.map(c => [c.coupon_code, c.usage_count, c.total_discount, c.total_order_value, c.avg_order_value]),
  ], `coupons-${dateRange.from}-${dateRange.to}.csv`)

  const exportRefunds = () => exportCSV([
    ['Order', 'Customer', 'Amount (RM)', 'Reason', 'Status', 'Date'],
    ...refunds.map(r => [r.order?.order_number ?? '—', r.customer?.full_name ?? '—', r.amount, r.reason, r.status, r.created_at]),
  ], `refunds-${dateRange.from}-${dateRange.to}.csv`)

  const totalDays = Math.round((new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / 86400000) + 1

  return (
    <div className="space-y-5">

      {/* ── Date range picker ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
        <div className="relative">
          <Button variant="outline" size="sm" onClick={() => setShowPresets(v => !v)}
            className="flex items-center gap-2">
            <span>📅</span>
            {dateRange.from} → {dateRange.to}
            <span className="text-gray-400">({totalDays}d)</span>
            <ChevronDown size={14} />
          </Button>
          {showPresets && (
            <div className="absolute top-10 left-0 z-20 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 min-w-[180px]">
              {DATE_PRESETS.map(p => (
                <button key={p.label}
                  onClick={() => { const r = p.fn(); applyRange(r.from, r.to) }}
                  className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-gray-50 text-gray-700 transition-colors">
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Custom range */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="text-xs">Custom:</span>
          <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-36 h-8 text-xs" />
          <span>→</span>
          <Input type="date" value={customTo}   onChange={e => setCustomTo(e.target.value)}   className="w-36 h-8 text-xs" />
          <Button size="sm" variant="outline"
            onClick={() => applyRange(customFrom, customTo)}
            disabled={!customFrom || !customTo || customFrom > customTo}>
            Apply
          </Button>
        </div>
      </div>

      {/* ── Metric cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Card title="Total Revenue"      value={rm(summary.total_revenue)}    change={changes.revenue}   highlight
          icon={<TrendingUp  size={16} />} iconBg="bg-blue-100"   iconColor="text-blue-600"
          sub={`Net: ${rm(summary.net_revenue)}`} />
        <Card title="Total Orders"       value={String(summary.total_orders ?? 0)} change={changes.orders}
          icon={<ShoppingBag size={16} />} iconBg="bg-purple-100" iconColor="text-purple-600"
          sub={`${summary.unique_customers ?? 0} customers`} />
        <Card title="Avg Order Value"    value={rm(summary.avg_order_value)}  change={changes.aov}
          icon={<DollarSign  size={16} />} iconBg="bg-cyan-100"   iconColor="text-cyan-600" />
        <Card title="Shipping Collected" value={rm(summary.total_shipping)}   change={changes.shipping}
          icon={<Truck       size={16} />} iconBg="bg-sky-100"    iconColor="text-sky-600" />
        <Card title="Tax Collected"      value={rm(summary.total_tax)}        change={changes.tax}
          icon={<Percent     size={16} />} iconBg="bg-indigo-100" iconColor="text-indigo-600" />
        <Card title="Discounts Given"    value={rm(summary.total_discounts)}  change={changes.discounts}
          icon={<Tag         size={16} />} iconBg="bg-amber-100"  iconColor="text-amber-600" />
        <Card title="Refunds Issued"     value={rm(summary.total_refunds)}    change={changes.refunds}
          icon={<RotateCcw   size={16} />} iconBg="bg-red-100"    iconColor="text-red-600" />
        <Card title="Unique Customers"   value={String(summary.unique_customers ?? 0)} change={changes.customers}
          icon={<Users       size={16} />} iconBg="bg-green-100"  iconColor="text-green-600" />
      </div>

      {/* ── Section tabs ──────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit flex-wrap">
        {[
          { key: 'overview', label: '📊 Revenue'  },
          { key: 'orders',   label: '📦 Orders'   },
          { key: 'regions',  label: '🗺️ Regions'  },
          { key: 'coupons',  label: '🏷️ Coupons'  },
          { key: 'refunds',  label: '↩️ Refunds'  },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════ OVERVIEW TAB ════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Revenue + orders dual-axis chart */}
          <Section title="Revenue & Orders Over Time"
            action={
              <Button variant="outline" size="sm" onClick={exportRevenue}>
                <Download size={13} className="mr-1" /> Export
              </Button>
            }>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={revenueData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="ship" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#0891b2" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#0891b2" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                  interval={Math.ceil(revenueData.length / 8)} />
                <YAxis yAxisId="left"  tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                  tickFormatter={v => `RM${v}`} width={56} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickLine={false} axisLine={false} width={30} />
                <Tooltip
                  formatter={(v: any, name: any) =>
                    name === 'orders' ? [v, 'Orders'] : [`RM ${Number(v ?? 0).toFixed(2)}`, name === 'revenue' ? 'Revenue' : 'Shipping']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area yAxisId="left"  type="monotone" dataKey="revenue"  stroke="#2563eb" strokeWidth={2}
                  fill="url(#rev)"  dot={false} name="revenue" />
                <Area yAxisId="left"  type="monotone" dataKey="shipping" stroke="#0891b2" strokeWidth={1.5}
                  fill="url(#ship)" dot={false} name="shipping" strokeDasharray="4 2" />
                <Bar  yAxisId="right" dataKey="orders" fill="#e0e7ff" radius={[3,3,0,0]} name="orders" />
              </AreaChart>
            </ResponsiveContainer>
          </Section>

          {/* Summary table */}
          <Section title="Period Summary">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {[
                    ['Gross Revenue',     rm(summary.total_revenue),   'Total before deductions'],
                    ['Shipping Fees',     rm(summary.total_shipping),  'Delivery fees collected from customers'],
                    ['Tax Collected',     rm(summary.total_tax),       'SST / tax billed to customers'],
                    ['Discounts Given',   `−${rm(summary.total_discounts)}`, 'Promo codes, points, manual discounts'],
                    ['Refunds Issued',    `−${rm(summary.total_refunds)}`,   'Approved refunds in period'],
                    ['Net Revenue',       rm(summary.net_revenue),     'Revenue − shipping − tax − refunds'],
                    ['Orders',            String(summary.total_orders ?? 0),  ''],
                    ['Avg Order Value',   rm(summary.avg_order_value), 'Gross revenue ÷ orders'],
                    ['Unique Customers',  String(summary.unique_customers ?? 0), ''],
                  ].map(([label, value, hint]) => (
                    <tr key={label} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap">{label}</td>
                      <td className="py-2.5 font-bold text-gray-900 whitespace-nowrap">{value}</td>
                      <td className="py-2.5 text-xs text-gray-400 hidden sm:table-cell">{hint}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}

      {/* ════════ ORDERS TAB ══════════════════════════════════════════════ */}
      {tab === 'orders' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Status breakdown pie */}
          <Section title="Order Status Breakdown">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={85} innerRadius={45}
                  label={({ name, percent }) => `${name} ${((percent ?? 0)*100).toFixed(0)}%`}
                  labelLine={false} style={{ fontSize: 10 }}>
                  {statusData.map((s, i) => (
                    <Cell key={i} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => [v, 'orders']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            {/* Table alongside */}
            <div className="mt-3 space-y-0">
              {statusData.map(s => (
                <div key={s.name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-sm capitalize text-gray-700">{s.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-gray-900">{s.value}</span>
                    <span className="text-xs text-gray-400 ml-2">{rm(s.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Orders bar chart by day */}
          <Section title="Daily Order Volume">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                  interval={Math.ceil(revenueData.length / 8)} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }} />
                <Bar dataKey="orders" fill="#7c3aed" radius={[4,4,0,0]} name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        </div>
      )}

      {/* ════════ REGIONS TAB ═════════════════════════════════════════════ */}
      {tab === 'regions' && (
        <div className="space-y-4">
          <Section title="Sales by Shipping Region (State)"
            action={
              <Button variant="outline" size="sm" onClick={exportRegions}>
                <Download size={13} className="mr-1" /> Export
              </Button>
            }>
            {regionData.length === 0 ? (
              <p className="text-gray-400 text-sm py-8 text-center">No region data — orders may have no address state set</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={Math.max(regionData.length * 44, 200)}>
                  <BarChart data={regionData} layout="vertical" margin={{ left: 8, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false}
                      axisLine={false} tickFormatter={v => `RM${v}`} />
                    <YAxis type="category" dataKey="region" tick={{ fontSize: 11, fill: '#374151' }}
                      tickLine={false} axisLine={false} width={40} />
                    <Tooltip formatter={(v: any) => [`RM ${Number(v ?? 0).toFixed(2)}`, 'Revenue']}
                      contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }} />
                    <Bar dataKey="revenue" fill="#2563eb" radius={[0,6,6,0]}
                      label={{ position: 'right', fontSize: 11, fill: '#6b7280',
                        formatter: (v: any) => `RM ${Number(v ?? 0).toFixed(0)}` }} />
                  </BarChart>
                </ResponsiveContainer>

                {/* Detailed table */}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-50">
                        {['State', 'Orders', 'Revenue', 'Shipping', 'Avg Order'].map(h => (
                          <th key={h} className="text-left text-xs font-semibold text-gray-400 pb-2 pr-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {regionSales.map(r => (
                        <tr key={r.region} className="border-b border-gray-50 last:border-0">
                          <td className="py-2.5 pr-4 font-semibold text-gray-800">{r.region || 'Unknown'}</td>
                          <td className="py-2.5 pr-4 text-gray-600">{r.order_count}</td>
                          <td className="py-2.5 pr-4 font-bold text-gray-900">{rm(r.total_revenue)}</td>
                          <td className="py-2.5 pr-4 text-gray-600">{rm(r.total_shipping)}</td>
                          <td className="py-2.5 text-gray-600">
                            {rm(r.order_count > 0 ? r.total_revenue / r.order_count : 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Section>
        </div>
      )}

      {/* ════════ COUPONS TAB ═════════════════════════════════════════════ */}
      {tab === 'coupons' && (
        <Section title="Coupon Usage"
          action={
            couponUsage.length > 0
              ? <Button variant="outline" size="sm" onClick={exportCoupons}>
                  <Download size={13} className="mr-1" /> Export
                </Button>
              : undefined
          }>
          {couponUsage.length === 0 ? (
            <div className="text-center py-12">
              <Tag size={32} className="mx-auto text-gray-200 mb-3" />
              <p className="text-gray-400 text-sm">No coupons used in this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50">
                    {['Coupon Code', 'Uses', 'Total Discount', 'Total Order Value', 'Avg Order Value', 'Discount Rate'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {couponUsage.map(c => {
                    const discountRate = c.total_order_value > 0
                      ? (c.total_discount / c.total_order_value) * 100
                      : 0
                    return (
                      <tr key={c.coupon_code} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                        <td className="py-3 pr-4">
                          <span className="font-mono font-bold text-sm bg-gray-100 text-gray-800 px-2.5 py-1 rounded-lg">
                            {c.coupon_code}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-sm font-semibold text-gray-800">{c.usage_count}×</td>
                        <td className="py-3 pr-4 text-sm font-bold text-red-600">−{rm(c.total_discount)}</td>
                        <td className="py-3 pr-4 text-sm text-gray-700">{rm(c.total_order_value)}</td>
                        <td className="py-3 pr-4 text-sm text-gray-700">{rm(c.avg_order_value)}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-amber-400 rounded-full"
                                style={{ width: `${Math.min(discountRate, 100)}%` }} />
                            </div>
                            <span className="text-xs text-gray-500">{discountRate.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-100">
                    <td className="pt-3 text-xs font-bold text-gray-600">TOTAL</td>
                    <td className="pt-3 text-sm font-bold">
                      {couponUsage.reduce((s, c) => s + Number(c.usage_count), 0)}×
                    </td>
                    <td className="pt-3 text-sm font-bold text-red-600">
                      −{rm(couponUsage.reduce((s, c) => s + Number(c.total_discount), 0))}
                    </td>
                    <td className="pt-3 text-sm font-bold">
                      {rm(couponUsage.reduce((s, c) => s + Number(c.total_order_value), 0))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Section>
      )}

      {/* ════════ REFUNDS TAB ═════════════════════════════════════════════ */}
      {tab === 'refunds' && (
        <Section title="Refunds"
          action={
            <div className="flex gap-2">
              {refunds.length > 0 && (
                <Button variant="outline" size="sm" onClick={exportRefunds}>
                  <Download size={13} className="mr-1" /> Export
                </Button>
              )}
              <Button size="sm" onClick={() => setRefundModal({})}>
                + New Refund
              </Button>
            </div>
          }>

          {refunds.length === 0 ? (
            <div className="text-center py-12">
              <RotateCcw size={32} className="mx-auto text-gray-200 mb-3" />
              <p className="text-gray-400 text-sm">No refunds in this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50">
                    {['Order', 'Customer', 'Amount', 'Reason', 'Method', 'Status', 'Date', ''].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-400 pb-3 pr-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {refunds.map(r => (
                    <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="py-3 pr-3">
                        <span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-lg">
                          {r.order?.order_number ?? '—'}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-sm text-gray-700">{r.customer?.full_name ?? '—'}</td>
                      <td className="py-3 pr-3 text-sm font-bold text-red-600">−{rm(r.amount)}</td>
                      <td className="py-3 pr-3 text-sm text-gray-500 max-w-[160px] truncate">{r.reason ?? '—'}</td>
                      <td className="py-3 pr-3 text-sm text-gray-500 capitalize">{r.refund_method?.replace(/_/g,' ')}</td>
                      <td className="py-3 pr-3">
                        <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full capitalize',
                          r.status === 'approved' ? 'bg-green-100 text-green-700' :
                          r.status === 'rejected' ? 'bg-red-100 text-red-600'    : 'bg-amber-100 text-amber-700')}>
                          {r.status === 'approved' ? '✓ ' : r.status === 'rejected' ? '✕ ' : '⏳ '}
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-xs text-gray-400 whitespace-nowrap">
                        {format(new Date(r.created_at), 'd MMM yyyy')}
                      </td>
                      <td className="py-3">
                        {r.status === 'pending' && (
                          <div className="flex gap-1">
                            <button onClick={() => handleRefundStatus(r.id, 'approved')}
                              className="w-7 h-7 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg flex items-center justify-center transition-colors">
                              <CheckCircle2 size={14} />
                            </button>
                            <button onClick={() => handleRefundStatus(r.id, 'rejected')}
                              className="w-7 h-7 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg flex items-center justify-center transition-colors">
                              <XCircle size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-100">
                    <td colSpan={2} className="pt-3 text-xs font-bold text-gray-600">TOTAL APPROVED</td>
                    <td className="pt-3 text-sm font-bold text-red-600">
                      −{rm(refunds.filter(r => r.status === 'approved').reduce((s, r) => s + Number(r.amount), 0))}
                    </td>
                    <td colSpan={5} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Section>
      )}

      {/* ── Create Refund Modal ────────────────────────────────────────── */}
      {refundModal !== null && (
        <RefundModal
          onClose={() => setRefundModal(null)}
          onCreate={handleCreateRefund}
          merchantId={merchantId}
        />
      )}
    </div>
  )
}

// ─── Refund creation modal ────────────────────────────────────────────────────

function RefundModal({ onClose, onCreate, merchantId }: {
  onClose: () => void; onCreate: (data: any) => void; merchantId: string
}) {
  const supabase = createClient()
  const [form, setForm] = useState({ order_id: '', amount: '', reason: '', refund_method: 'manual', notes: '' })
  const [orderSearch, setOrderSearch] = useState('')
  const [orders, setOrders] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const searchOrders = async (q: string) => {
    if (q.length < 2) { setOrders([]); return }
    const { data } = await supabase
      .from('orders').select('id, order_number, total_amount, customer_id, profiles(full_name)')
      .eq('merchant_id', merchantId)
      .ilike('order_number', `%${q}%`)
      .limit(5)
    setOrders(data ?? [])
  }

  const handleSubmit = async () => {
    if (!form.order_id || !form.amount) { toast.error('Order and amount are required'); return }
    setSaving(true)
    // Get customer_id from selected order
    const order = orders.find(o => o.id === form.order_id)
    await onCreate({ ...form, amount: Number(form.amount), customer_id: order?.customer_id ?? null })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Create Refund</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {/* Order search */}
        <div>
          <label className="text-sm font-medium text-gray-700">Order *</label>
          <Input className="mt-1" placeholder="Search by order number..."
            value={orderSearch}
            onChange={e => { setOrderSearch(e.target.value); searchOrders(e.target.value) }} />
          {orders.length > 0 && (
            <div className="mt-1 border border-gray-100 rounded-xl overflow-hidden shadow-sm">
              {orders.map(o => (
                <button key={o.id}
                  onClick={() => { set('order_id', o.id); setOrderSearch(o.order_number); setOrders([]) }}
                  className={cn('w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 transition-colors border-b last:border-0',
                    form.order_id === o.id && 'bg-blue-50')}>
                  <span className="font-mono font-bold text-gray-800">{o.order_number}</span>
                  <span className="text-gray-400 ml-2">RM {Number(o.total_amount).toFixed(2)}</span>
                  <span className="text-gray-400 ml-2 text-xs">{o.profiles?.full_name ?? ''}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Refund Amount (RM) *</label>
          <Input type="number" min="0.01" step="0.01" className="mt-1"
            value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Reason</label>
          <Input className="mt-1" value={form.reason} onChange={e => set('reason', e.target.value)}
            placeholder="e.g. Wrong item delivered" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Refund Method</label>
          <select value={form.refund_method} onChange={e => set('refund_method', e.target.value)}
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="manual">Manual (Cash / Transfer)</option>
            <option value="original_payment">Original Payment Method</option>
            <option value="wallet">Store Wallet Credit</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Internal Notes</label>
          <Input className="mt-1" value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Optional notes for your team" />
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
            Create Refund
          </Button>
        </div>
      </div>
    </div>
  )
}
