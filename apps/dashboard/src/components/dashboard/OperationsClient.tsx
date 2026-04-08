'use client'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useState }    from 'react'
import { useRouter }   from 'next/navigation'
import { format, subDays } from 'date-fns'

const BarChart = dynamic(() => import('recharts').then(mod => mod.BarChart), { ssr: false })
const Bar = dynamic(() => import('recharts').then(mod => mod.Bar), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false })
const Cell = dynamic(() => import('recharts').then(mod => mod.Cell), { ssr: false })
const PieChart = dynamic(() => import('recharts').then(mod => mod.PieChart), { ssr: false })
const Pie = dynamic(() => import('recharts').then(mod => mod.Pie), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false })
import { Button }  from '@/components/ui/button'
import { Input }   from '@/components/ui/input'
import { cn }      from '@/lib/utils'
import {
  AlertCircle, CheckCircle2, Clock, Truck,
  CreditCard, Package, Download, ChevronDown,
  Timer, MapPin, Search, Filter,
} from 'lucide-react'

const COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#be185d','#65a30d','#ea580c','#6366f1']

function exportCSV(rows: any[][], filename: string) {
  const csv  = rows.map(r => r.map(c => `"${String(c??'').replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename })
  a.click()
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase()
  if (s === 'paid')               return <span className="bg-blue-50   text-blue-600   px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">Paid</span>
  if (s === 'confirmed')          return <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">Confirmed</span>
  if (s === 'preparing')          return <span className="bg-amber-50  text-amber-600  px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">Preparing</span>
  if (s === 'ready_for_pickup')   return <span className="bg-green-50  text-green-600  px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">Ready</span>
  return                                 <span className="bg-gray-50   text-gray-500   px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">{status}</span>
}

export function OperationsClient({ merchantId, dateRange, stockLevels, fulfillmentStats, fulfillmentQueue, deliveryStats, paymentStats }: {
  merchantId: string; dateRange: { from: string; to: string }
  stockLevels: any[]; fulfillmentStats: any; fulfillmentQueue: any[]; deliveryStats: any[]; paymentStats: any[]
}) {
  const router = useRouter()
  const [tab,  setTab]  = useState<'fulfillment'|'stock'|'logistics'|'payments'>('fulfillment')
  const [q,    setQ]    = useState('')
  const [show, setShow] = useState(false)
  const [from, setFrom] = useState(dateRange.from)
  const [to,   setTo]   = useState(dateRange.to)

  const apply = (f: string, t: string) => { router.push(`/operations?from=${f}&to=${t}`); setShow(false) }
  const rm = (v: number) => `RM ${Number(v??0).toFixed(2)}`
  const n  = (v: number) => Number(v??0)

  const lowStock = stockLevels.filter(s => s.is_low_stock && !s.is_out_of_stock)
  const outOfStock = stockLevels.filter(s => s.is_out_of_stock)

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 shrink-0">
          {[
            { key: 'fulfillment', label: '🚚 Fulfillment', icon: Truck },
            { key: 'stock',       label: '📦 Stock',       icon: Package },
            { key: 'logistics',   label: '📍 Logistics',   icon: MapPin },
            { key: 'payments',    label: '💳 Payments',    icon: CreditCard },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2',
                tab === t.key ? 'bg-white shadow text-gray-900 scale-[1.02]' : 'text-gray-500 hover:text-gray-700')}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-1.5 flex items-center gap-2">
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-32 h-8 text-xs border-0 focus-visible:ring-0" />
          <span className="text-gray-300 text-xs text-center w-4">→</span>
          <Input type="date" value={to}   onChange={e => setTo(e.target.value)}   className="w-32 h-8 text-xs border-0 focus-visible:ring-0" />
          <Button size="sm" variant="ghost" onClick={() => apply(from, to)} className="h-8 rounded-xl px-4 hover:bg-gray-50 font-bold">Apply</Button>
        </div>
      </div>

      {/* ══ FULFILLMENT TAB ══════════════════════════════════════════════ */}
      {tab === 'fulfillment' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 group transition-all hover:border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><CheckCircle2 size={20} /></div>
                <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg font-bold">SLA Rate</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{fulfillmentStats.sla_rate_pct ?? 0}%</p>
              <p className="text-xs text-gray-400 mt-1">{fulfillmentStats.sla_met_count} of {fulfillmentStats.total_orders} met SLA</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 group transition-all hover:border-purple-200">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600"><Timer size={20} /></div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{fulfillmentStats.avg_total_mins ?? 0}m</p>
              <p className="text-xs text-gray-400 mt-1">Avg total fulfillment time</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 group transition-all hover:border-amber-200">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600"><Clock size={20} /></div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{fulfillmentStats.avg_confirm_mins ?? 0}m</p>
              <p className="text-xs text-gray-400 mt-1">Avg confirmation speed</p>
            </div>
            <div className="bg-white rounded-2xl border border-red-100 bg-red-50/20 p-5 group transition-all hover:bg-red-50/50">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600"><AlertCircle size={20} /></div>
                {n(fulfillmentStats.overdue_unconfirmed) > 0 && <span className="animate-pulse bg-red-500 w-2 h-2 rounded-full" />}
              </div>
              <p className="text-2xl font-bold text-red-600">{fulfillmentStats.overdue_unconfirmed ?? 0}</p>
              <p className="text-xs text-red-400 mt-1">Orders overdue confirmation</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Active Fulfillment Queue</h3>
                <p className="text-xs text-gray-400 mt-0.5">{fulfillmentQueue.length} orders need your attention</p>
              </div>
              <Button variant="outline" size="sm" className="rounded-xl px-4" onClick={() =>
                exportCSV([['ID','Order Number','Status','Customer','Amount','Mins In Status','Overdue'],
                  ...fulfillmentQueue.map(o => [o.order_id, o.order_number, o.status, o.customer_name, o.total_amount, o.mins_in_status, o.is_overdue])],
                  `fulfillment-queue-${dateRange.from}.csv`)}>
                <Download size={13} className="mr-1" /> Export Queue
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50/50"><th className="text-left py-3 px-5 text-xs text-gray-400 uppercase tracking-wider font-bold">Order info</th><th className="text-left py-3 px-5 text-xs text-gray-400 uppercase tracking-wider font-bold">Customer</th><th className="text-left py-3 px-5 text-xs text-gray-400 uppercase tracking-wider font-bold">Status</th><th className="text-left py-3 px-5 text-xs text-gray-400 uppercase tracking-wider font-bold">Time in status</th><th className="text-left py-3 px-5 text-xs text-gray-400 uppercase tracking-wider font-bold">Priority</th></tr></thead>
                <tbody>
                  {fulfillmentQueue.length === 0 ? (
                    <tr><td colSpan={5} className="py-20 text-center text-gray-400 bg-gray-50/10">Queue is empty! All orders fulfilled. ✨</td></tr>
                  ) : (
                    fulfillmentQueue.map(o => (
                      <tr key={o.order_id} className={cn('border-b border-gray-50 last:border-0 hover:bg-gray-50/50', o.is_overdue && 'bg-red-50/10')}>
                        <td className="py-4 px-5">
                          <p className="font-bold text-gray-900">{o.order_number}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{rm(o.total_amount)} — {o.item_count} items</p>
                        </td>
                        <td className="py-4 px-5 text-gray-600 font-medium">{o.customer_name}</td>
                        <td className="py-4 px-5"><StatusBadge status={o.status} /></td>
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-1.5 text-gray-600 font-mono">
                            <Clock size={12} className={o.is_overdue ? 'text-red-500' : 'text-gray-400'} />
                            {o.mins_in_status}m
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          {o.is_overdue
                            ? <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-[10px] font-bold animate-pulse uppercase tracking-wider">Overdue</span>
                            : <span className="bg-green-100 text-green-600 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">On track</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ STOCK TAB ═════════════════════════════════════════════════════ */}
      {tab === 'stock' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-xs text-gray-400">Total Catalog Items</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stockLevels.length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-amber-100 bg-amber-50/10 p-5">
              <p className="text-xs text-amber-500">Low Stock Alert</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{lowStock.length}</p>
              <p className="text-[10px] text-amber-400 mt-1 font-medium">ACTION REQUIRED</p>
            </div>
            <div className="bg-white rounded-2xl border border-red-100 bg-red-50/10 p-5">
              <p className="text-xs text-red-500">Out of Stock</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{outOfStock.length}</p>
              <p className="text-[10px] text-red-400 mt-1 font-medium font-bold">REVENUE LOSS RISK</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900">Inventory Status</h3>
              <Input placeholder="Search SKU or name..." value={q} onChange={e => setQ(e.target.value)} className="h-8 max-w-[200px] text-xs rounded-xl" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-50"><th className="text-left pb-3 text-xs text-gray-400 uppercase tracking-wider font-bold">Product</th><th className="text-left pb-3 text-xs text-gray-400 uppercase tracking-wider font-bold">Stock</th><th className="text-left pb-3 text-xs text-gray-400 uppercase tracking-wider font-bold">Sold Period</th><th className="text-left pb-3 text-xs text-gray-400 uppercase tracking-wider font-bold">Sell-Through</th><th className="text-left pb-3 text-xs text-gray-400 uppercase tracking-wider font-bold">Est. Runaway</th></tr></thead>
                <tbody>
                  {stockLevels.filter(s => !q || s.product_name.toLowerCase().includes(q.toLowerCase()) || s.sku?.toLowerCase().includes(q.toLowerCase())).map(s => (
                    <tr key={s.product_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-gray-50 flex items-center justify-center">
                          {s.image_url ? (
                            <Image src={s.image_url} fill className="object-cover" alt="" />
                          ) : (
                            <Package size={16} className="text-gray-400" />
                          )}
                        </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 truncate max-w-[180px]">{s.product_name}</p>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">{s.sku || 'No SKU'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex flex-col">
                          <span className={cn('text-sm font-bold', s.is_out_of_stock ? 'text-red-600' : s.is_low_stock ? 'text-amber-600' : 'text-gray-900')}>
                            {s.current_stock} units
                          </span>
                          <span className="text-[10px] text-gray-400">Threshold: {s.restock_threshold}</span>
                        </div>
                      </td>
                      <td className="py-4 text-gray-600 font-medium">{s.sold_in_period} units</td>
                      <td className="py-4">
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                          <div className={cn('h-full', n(s.sell_through_pct) > 50 ? 'bg-green-500' : 'bg-blue-500')} style={{ width: `${Math.min(n(s.sell_through_pct),100)}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-400 font-bold">{s.sell_through_pct}% moved</span>
                      </td>
                      <td className="py-4">
                        {s.days_of_stock_left
                          ? <span className={cn('text-xs font-bold px-2 py-1 rounded-lg', n(s.days_of_stock_left) < 7 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-600')}>
                              {s.days_of_stock_left} days left
                            </span>
                          : <span className="text-xs text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ LOGISTICS TAB ═════════════════════════════════════════════════ */}
      {tab === 'logistics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl border border-gray-100 p-6 flex flex-col items-center justify-center text-center">
               <h3 className="font-bold text-gray-900 mb-6">Orders by Delivery Method</h3>
               <ResponsiveContainer width="100%" height={240}>
                 <PieChart>
                    <Pie data={deliveryStats} dataKey="order_count" nameKey="provider" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                      {deliveryStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} strokeWidth={0} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                 </PieChart>
               </ResponsiveContainer>
               <div className="flex flex-wrap justify-center gap-4 mt-4">
                 {deliveryStats.map((d, i) => (
                   <div key={d.provider} className="flex items-center gap-1.5">
                     <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                     <span className="text-[10px] font-bold text-gray-600 uppercase">{d.provider}</span>
                   </div>
                 ))}
               </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 p-6">
               <h3 className="font-bold text-gray-900 mb-4 text-center">Provider Performance Metrics</h3>
               <div className="space-y-5 mt-8">
                 {deliveryStats.map((d, i) => (
                   <div key={d.provider} className="space-y-2">
                     <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 uppercase tracking-tight">{d.provider}</span>
                        <span className="text-xs font-bold text-gray-400">{d.avg_delivery_hrs ?? 0}h avg</span>
                     </div>
                     <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
                        <div className="bg-green-500 h-full" style={{ width: `${d.success_rate_pct}%` }} title="Success" />
                        <div className="bg-red-400 h-full" style={{ flex: 1 }} title="Failure" />
                     </div>
                     <div className="flex justify-between text-[10px] font-medium uppercase">
                        <span className="text-green-600">{d.success_rate_pct}% success</span>
                        <span className="text-gray-400">{d.order_count} total orders</span>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ PAYMENTS TAB ══════════════════════════════════════════════════ */}
      {tab === 'payments' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {paymentStats.map((p, i) => (
              <div key={p.payment_method} className="bg-white rounded-2xl border border-gray-100 p-5 overflow-hidden relative">
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center -rotate-12 opacity-50"><CreditCard className="text-gray-200" size={40} /></div>
                <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">{p.payment_method}</p>
                <p className="text-xl font-bold text-gray-900 mt-2">{rm(p.total_revenue)}</p>
                <div className="flex items-center gap-3 mt-3">
                   <div className="flex items-center gap-1 text-[10px] font-bold text-green-600">
                      <div className="w-1 h-1 rounded-full bg-green-500" /> {p.paid_count} PAID
                   </div>
                   <div className="flex items-center gap-1 text-[10px] font-bold text-amber-500">
                      <div className="w-1 h-1 rounded-full bg-amber-500" /> {p.pending_count} PENDING
                   </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 mb-6">Payment Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={paymentStats}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                 <XAxis dataKey="payment_method" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                 <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `RM${v}`} />
                 <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                 <Bar dataKey="total_revenue" radius={[6,6,0,0]} barSize={40}>
                    {paymentStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                 </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

    </div>
  )
}
