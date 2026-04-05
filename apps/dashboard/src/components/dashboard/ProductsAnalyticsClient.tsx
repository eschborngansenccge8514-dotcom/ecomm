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
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false })
import { Button }  from '@/components/ui/button'
import { Input }   from '@/components/ui/input'
import { cn }      from '@/lib/utils'
import { Package, Heart, TrendingUp, ChevronDown, Download, Star } from 'lucide-react'

const COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#be185d','#65a30d','#ea580c','#6366f1']

function exportCSV(rows: any[][], filename: string) {
  const csv  = rows.map(r => r.map(c => `"${String(c??'').replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename })
  a.click()
}

function StockBadge({ stock, threshold }: { stock: number; threshold: number }) {
  if (stock === 0)         return <span className="text-xs bg-red-100    text-red-700    font-bold px-2 py-0.5 rounded-full">Out of stock</span>
  if (stock <= threshold)  return <span className="text-xs bg-amber-100  text-amber-700  font-bold px-2 py-0.5 rounded-full">Low stock</span>
  return                          <span className="text-xs bg-green-100  text-green-700  font-bold px-2 py-0.5 rounded-full">{stock} in stock</span>
}

function SellThroughBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all',
          pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : pct >= 20 ? 'bg-amber-400' : 'bg-red-400')}
          style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs text-gray-500">{pct}%</span>
    </div>
  )
}

const DATE_PRESETS = [
  { label: 'Last 7 days',   fn: () => ({ from: format(subDays(new Date(),6),'yyyy-MM-dd'),  to: format(new Date(),'yyyy-MM-dd') }) },
  { label: 'Last 30 days',  fn: () => ({ from: format(subDays(new Date(),29),'yyyy-MM-dd'), to: format(new Date(),'yyyy-MM-dd') }) },
  { label: 'Last 90 days',  fn: () => ({ from: format(subDays(new Date(),89),'yyyy-MM-dd'), to: format(new Date(),'yyyy-MM-dd') }) },
]

export function ProductsAnalyticsClient({ merchantId, dateRange, productSales, variantSales, wishlistStats }: {
  merchantId: string; dateRange: { from: string; to: string }
  productSales: any[]; variantSales: any[]; wishlistStats: any[]
}) {
  const router = useRouter()
  const [tab,  setTab]  = useState<'qty'|'revenue'|'all'|'variants'|'wishlist'>('qty')
  const [q,    setQ]    = useState('')
  const [show, setShow] = useState(false)
  const [from, setFrom] = useState(dateRange.from)
  const [to,   setTo]   = useState(dateRange.to)

  const apply = (f: string, t: string) => { router.push(`/reports/products?from=${f}&to=${t}`); setShow(false) }
  const rm = (v: number) => `RM ${Number(v ?? 0).toFixed(2)}`
  const n  = (v: number) => Number(v ?? 0)

  const filtered = productSales.filter(p =>
    !q || p.product_name?.toLowerCase().includes(q.toLowerCase()) || p.sku?.toLowerCase().includes(q.toLowerCase()))

  const topByQty     = [...productSales].sort((a,b) => n(b.total_quantity) - n(a.total_quantity)).slice(0, 15)
  const topByRevenue = [...productSales].sort((a,b) => n(b.total_revenue)  - n(a.total_revenue)).slice(0, 15)

  const totalQty      = productSales.reduce((s,p) => s + n(p.total_quantity), 0)
  const totalRevenue  = productSales.reduce((s,p) => s + n(p.total_revenue),  0)
  const totalWishlist = wishlistStats.reduce((s,p) => s + n(p.wishlist_adds), 0)

  return (
    <div className="space-y-5">

      {/* ── Date range ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Button variant="outline" size="sm" onClick={() => setShow(v => !v)}
            className="flex items-center gap-2">
            📅 {dateRange.from} → {dateRange.to}
            <ChevronDown size={14} />
          </Button>
          {show && (
            <div className="absolute top-10 left-0 z-20 bg-white rounded-2xl shadow-xl border p-2 min-w-[160px]">
              {DATE_PRESETS.map(p => (
                <button key={p.label} onClick={() => { const r = p.fn(); apply(r.from, r.to) }}
                  className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-gray-50">{p.label}</button>
              ))}
            </div>
          )}
        </div>
        <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36 h-8 text-xs" />
        <span className="text-gray-400">→</span>
        <Input type="date" value={to}   onChange={e => setTo(e.target.value)}   className="w-36 h-8 text-xs" />
        <Button size="sm" variant="outline" onClick={() => apply(from, to)} disabled={from > to}>Apply</Button>
      </div>

      {/* ── Headline cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400">Units Sold</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalQty.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">{productSales.length} products</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400">Product Revenue</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{rm(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400">Total Wishlist Adds</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalWishlist.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">{wishlistStats.length} products wishlisted</p>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit flex-wrap">
        {[
          { key: 'qty',      label: '📦 By Quantity'  },
          { key: 'revenue',  label: '💰 By Revenue'   },
          { key: 'all',      label: '📋 All Products' },
          { key: 'variants', label: '🎨 Variants'     },
          { key: 'wishlist', label: '❤️ Wishlist'     },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ BY QUANTITY ══════════════════════════════════════════════════ */}
      {tab === 'qty' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Best Sellers by Quantity Sold</h3>
            <Button variant="outline" size="sm" onClick={() =>
              exportCSV([['Product','Units Sold','Revenue','Orders','Avg Price'],
                ...topByQty.map(p => [p.product_name, p.total_quantity, rm(p.total_revenue), p.order_count, rm(p.avg_unit_price)])],
                `best-sellers-qty-${dateRange.from}.csv`)}>
              <Download size={13} className="mr-1" /> Export
            </Button>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(topByQty.length * 44, 200)}>
            <BarChart data={topByQty.map(p => ({
              name:    p.product_name?.length > 22 ? p.product_name.slice(0,22)+'…' : p.product_name,
              qty:     n(p.total_quantity),
              revenue: n(p.total_revenue),
            }))} layout="vertical" margin={{ left: 8, right: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }}
                tickLine={false} axisLine={false} width={150} />
              <Tooltip formatter={(v: any, name: any) =>
                name === 'qty' ? [v, 'Units'] : [`RM ${Number(v ?? 0).toFixed(2)}`, 'Revenue']}
                contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }} />
              <Bar dataKey="qty" radius={[0,6,6,0]}
                label={{ position: 'right', fontSize: 11, fill: '#6b7280', formatter: (v: any) => `${v} units` }}>
                {topByQty.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Rank table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-50">
                {['#','Product','Units Sold','Revenue','Orders','Avg Price','Stock'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-400 pb-2 pr-4">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {topByQty.map((p, i) => (
                  <tr key={p.product_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="py-2.5 pr-4 text-gray-400 font-bold">#{i+1}</td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        {p.image_url
                          ? (
                            <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0">
                              <Image src={p.image_url} fill className="object-cover" alt="" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                              <Package size={14} className="text-gray-400" />
                            </div>
                          )
                        }
                        <div>
                          <p className="font-semibold text-gray-800 max-w-[160px] truncate">{p.product_name}</p>
                          {p.sku && <p className="text-xs text-gray-400 font-mono">{p.sku}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 font-bold text-gray-900">{n(p.total_quantity).toLocaleString()}</td>
                    <td className="py-2.5 pr-4 font-bold text-blue-600">{rm(p.total_revenue)}</td>
                    <td className="py-2.5 pr-4 text-gray-600">{p.order_count}</td>
                    <td className="py-2.5 pr-4 text-gray-600">{rm(p.avg_unit_price)}</td>
                    <td className="py-2.5"><StockBadge stock={n(p.current_stock)} threshold={5} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ BY REVENUE ═══════════════════════════════════════════════════ */}
      {tab === 'revenue' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Best Sellers by Revenue</h3>
            <Button variant="outline" size="sm" onClick={() =>
              exportCSV([['Product','Revenue','Units','Orders','Margin %','Sell-Through %'],
                ...topByRevenue.map(p => [p.product_name, rm(p.total_revenue), p.total_quantity,
                  p.order_count, `${p.gross_margin_pct}%`, `${p.sell_through_pct}%`])],
                `best-sellers-revenue-${dateRange.from}.csv`)}>
              <Download size={13} className="mr-1" /> Export
            </Button>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(topByRevenue.length * 44, 200)}>
            <BarChart data={topByRevenue.map(p => ({
              name:    p.product_name?.length > 22 ? p.product_name.slice(0,22)+'…' : p.product_name,
              revenue: n(p.total_revenue),
              qty:     n(p.total_quantity),
            }))} layout="vertical" margin={{ left: 8, right: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                tickFormatter={v => `RM${v}`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }}
                tickLine={false} axisLine={false} width={150} />
              <Tooltip formatter={(v: any, name: any) =>
                name === 'revenue' ? [`RM ${Number(v ?? 0).toFixed(2)}`, 'Revenue'] : [v, 'Units']}
                contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }} />
              <Bar dataKey="revenue" radius={[0,6,6,0]}
                label={{ position: 'right', fontSize: 11, fill: '#6b7280', formatter: (v: any) => `RM ${Number(v ?? 0).toFixed(0)}` }}>
                {topByRevenue.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ══ ALL PRODUCTS ═════════════════════════════════════════════════ */}
      {tab === 'all' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">All Products</h3>
            <div className="flex gap-2">
              <Input placeholder="Search products..." value={q} onChange={e => setQ(e.target.value)}
                className="h-8 text-xs w-40" />
              <Button variant="outline" size="sm" onClick={() =>
                exportCSV([['Product','SKU','Units Sold','Revenue','Orders','Avg Price','Sell-Through %','Margin %','Stock','Wishlist'],
                  ...productSales.map(p => [p.product_name, p.sku, p.total_quantity, rm(p.total_revenue),
                    p.order_count, rm(p.avg_unit_price), `${p.sell_through_pct}%`, `${p.gross_margin_pct}%`,
                    p.current_stock, p.wishlist_count])],
                  `all-products-${dateRange.from}.csv`)}>
                <Download size={13} className="mr-1" /> Export
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-50">
                {['Product','Units','Revenue','Orders','Avg Price','Sell-Through','Margin','Stock','❤️'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-400 pb-2 pr-4 whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.product_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        {p.image_url
                          ? (
                            <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0">
                              <Image src={p.image_url} fill className="object-cover" alt="" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                              <Package size={14} className="text-gray-400" />
                            </div>
                          )
                        }
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 truncate max-w-[140px]">{p.product_name}</p>
                          {p.sku && <p className="text-xs text-gray-400 font-mono">{p.sku}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 font-bold text-gray-900">{n(p.total_quantity)}</td>
                    <td className="py-2.5 pr-4 font-bold text-blue-600">{rm(p.total_revenue)}</td>
                    <td className="py-2.5 pr-4 text-gray-600">{p.order_count}</td>
                    <td className="py-2.5 pr-4 text-gray-600">{rm(p.avg_unit_price)}</td>
                    <td className="py-2.5 pr-4"><SellThroughBar pct={n(p.sell_through_pct)} /></td>
                    <td className="py-2.5 pr-4">
                      <span className={cn('text-xs font-semibold',
                        n(p.gross_margin_pct) >= 50 ? 'text-green-600' :
                        n(p.gross_margin_pct) >= 20 ? 'text-amber-600' : 'text-red-500')}>
                        {n(p.gross_margin_pct) > 0 ? `${p.gross_margin_pct}%` : '—'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4"><StockBadge stock={n(p.current_stock)} threshold={5} /></td>
                    <td className="py-2.5 text-gray-500">
                      {n(p.wishlist_count) > 0
                        ? <span className="flex items-center gap-1 text-xs"><Heart size={11} className="text-red-400 fill-red-400" />{p.wishlist_count}</span>
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ VARIANTS ═════════════════════════════════════════════════════ */}
      {tab === 'variants' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Variant Sales Breakdown</h3>
            <Button variant="outline" size="sm" onClick={() =>
              exportCSV([['Product','Variant','Qty Sold','Revenue','Avg Price'],
                ...variantSales.map(v => [v.product_name, v.variant_name, v.qty_sold, rm(v.revenue), rm(v.avg_price)])],
                `variants-${dateRange.from}.csv`)}>
              <Download size={13} className="mr-1" /> Export
            </Button>
          </div>
          {variantSales.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No variant data in this period</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-50">
                  {['Product','Variant','Qty Sold','Revenue','Avg Price'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-400 pb-2 pr-4">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {variantSales.map((v, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="py-2.5 pr-4 text-gray-600 truncate max-w-[140px]">{v.product_name}</td>
                      <td className="py-2.5 pr-4">
                        <span className="bg-gray-100 text-gray-700 text-xs font-medium px-2.5 py-1 rounded-full">
                          {v.variant_name}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 font-bold text-gray-900">{n(v.qty_sold)}</td>
                      <td className="py-2.5 pr-4 font-bold text-blue-600">{rm(v.revenue)}</td>
                      <td className="py-2.5 text-gray-600">{rm(v.avg_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ WISHLIST ══════════════════════════════════════════════════════ */}
      {tab === 'wishlist' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Most Wishlisted Products</h3>
            <Button variant="outline" size="sm" onClick={() =>
              exportCSV([['Product','Wishlist Adds','Converted to Purchase','Conversion %','Stock'],
                ...wishlistStats.map(p => [p.product_name, p.wishlist_adds, p.converted, `${p.conversion_pct}%`, p.current_stock])],
                `wishlist-${dateRange.from}.csv`)}>
              <Download size={13} className="mr-1" /> Export
            </Button>
          </div>
          {wishlistStats.length === 0 ? (
            <div className="text-center py-12">
              <Heart size={32} className="mx-auto text-gray-200 mb-3" />
              <p className="text-gray-400 text-sm">No wishlist activity in this period</p>
            </div>
          ) : (
            <div className="space-y-3">
              {wishlistStats.filter(p => n(p.wishlist_adds) > 0).map((p, i) => (
                <div key={p.product_id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-400 font-bold w-5 shrink-0">#{i+1}</span>
                  {p.image_url
                    ? (
                      <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0">
                        <Image src={p.image_url} fill className="object-cover" alt="" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                        <Package size={16} className="text-gray-400" />
                      </div>
                    )
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{p.product_name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-400">
                        <span className="text-red-400 font-bold">{p.wishlist_adds}</span> wishlist adds
                      </span>
                      <span className="text-xs text-gray-400">
                        <span className="text-green-600 font-bold">{p.converted}</span> converted ({p.conversion_pct}%)
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <StockBadge stock={n(p.current_stock)} threshold={5} />
                    {n(p.current_stock) === 0 && (
                      <p className="text-xs text-red-500 mt-0.5 font-medium">{p.wishlist_adds} waiting</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
