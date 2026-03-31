<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Add Product features usually include quantity sold, wishlist adds, best-selling products by quantity, and best-selling products by revenue.

Operations features often cover stock levels, sell-through rate, shipping status, delivery times, fulfillment progress, and payment management.

Here is the complete implementation — SQL layer, Product Analytics page, and Operations page.[^1][^2][^3]

***

## Step 1 — Database Migration

```sql
-- ── Wishlist items ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wishlist_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id)       ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES merchants(id)      ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (product_id, customer_id)
);
CREATE INDEX IF NOT EXISTS idx_wishlist_merchant ON wishlist_items(merchant_id, product_id);
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchant reads own wishlists"
  ON wishlist_items FOR SELECT TO authenticated
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

-- ── New columns on products ────────────────────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS restock_threshold int     DEFAULT 5,
  ADD COLUMN IF NOT EXISTS sku               text,
  ADD COLUMN IF NOT EXISTS cost_price        numeric DEFAULT 0;   -- for margin calc

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 1 — product sales full detail (quantity + revenue per product)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_product_sales_detail(
  p_merchant_id  uuid,
  p_start        date,
  p_end          date
)
RETURNS TABLE (
  product_id       uuid,
  product_name     text,
  image_url        text,
  sku              text,
  total_quantity   bigint,
  total_revenue    numeric,
  avg_unit_price   numeric,
  order_count      bigint,
  current_stock    bigint,
  wishlist_count   bigint,
  sell_through_pct numeric,
  gross_margin_pct numeric
)
LANGUAGE sql STABLE AS $$
  WITH sales AS (
    SELECT
      oi.product_id,
      oi.product_name,
      SUM(oi.quantity)    AS total_quantity,
      SUM(oi.line_total)  AS total_revenue,
      AVG(oi.unit_price)  AS avg_unit_price,
      COUNT(DISTINCT oi.order_id) AS order_count
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
      AND o.merchant_id = p_merchant_id
      AND o.status NOT IN ('pending','cancelled')
      AND o.created_at::date BETWEEN p_start AND p_end
    GROUP BY oi.product_id, oi.product_name
  ),
  stock AS (
    SELECT id, stock_quantity, cost_price, image_url, sku
    FROM products WHERE merchant_id = p_merchant_id
  ),
  wishes AS (
    SELECT product_id, COUNT(*) AS cnt
    FROM wishlist_items WHERE merchant_id = p_merchant_id
    GROUP BY product_id
  )
  SELECT
    COALESCE(s.product_id, st.id)                                 AS product_id,
    COALESCE(s.product_name, p2.name)                             AS product_name,
    st.image_url,
    st.sku,
    COALESCE(s.total_quantity, 0)                                 AS total_quantity,
    COALESCE(s.total_revenue, 0)                                  AS total_revenue,
    COALESCE(s.avg_unit_price, 0)                                 AS avg_unit_price,
    COALESCE(s.order_count, 0)                                    AS order_count,
    COALESCE(st.stock_quantity, 0)                                AS current_stock,
    COALESCE(w.cnt, 0)                                            AS wishlist_count,
    CASE
      WHEN COALESCE(s.total_quantity,0) + COALESCE(st.stock_quantity,0) = 0 THEN 0
      ELSE ROUND(
        COALESCE(s.total_quantity,0)::numeric
        / (COALESCE(s.total_quantity,0) + COALESCE(st.stock_quantity,0)) * 100, 1)
    END                                                           AS sell_through_pct,
    CASE
      WHEN COALESCE(s.total_revenue,0) = 0 THEN 0
      ELSE ROUND(
        (COALESCE(s.total_revenue,0)
         - COALESCE(st.cost_price,0) * COALESCE(s.total_quantity,0))
        / NULLIF(s.total_revenue,0) * 100, 1)
    END                                                           AS gross_margin_pct
  FROM products p2
  JOIN stock st ON st.id = p2.id
  LEFT JOIN sales s  ON s.product_id = p2.id
  LEFT JOIN wishes w ON w.product_id = p2.id
  WHERE p2.merchant_id = p_merchant_id
  ORDER BY total_revenue DESC;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 2 — variant-level sales breakdown
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_variant_sales(
  p_merchant_id  uuid,
  p_start        date,
  p_end          date
)
RETURNS TABLE (
  product_id    uuid,
  product_name  text,
  variant_id    uuid,
  variant_name  text,
  qty_sold      bigint,
  revenue       numeric,
  avg_price     numeric
)
LANGUAGE sql STABLE AS $$
  SELECT
    oi.product_id,
    oi.product_name,
    oi.variant_id,
    oi.variant_name,
    SUM(oi.quantity)   AS qty_sold,
    SUM(oi.line_total) AS revenue,
    AVG(oi.unit_price) AS avg_price
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
    AND o.merchant_id = p_merchant_id
    AND o.status NOT IN ('pending','cancelled')
    AND o.created_at::date BETWEEN p_start AND p_end
  WHERE oi.variant_id IS NOT NULL
  GROUP BY oi.product_id, oi.product_name, oi.variant_id, oi.variant_name
  ORDER BY revenue DESC;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 3 — wishlist stats per product
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_wishlist_stats(
  p_merchant_id  uuid,
  p_start        date,
  p_end          date
)
RETURNS TABLE (
  product_id     uuid,
  product_name   text,
  image_url      text,
  wishlist_adds  bigint,
  converted      bigint,   -- wishlisted AND purchased in period
  conversion_pct numeric,
  current_stock  bigint
)
LANGUAGE sql STABLE AS $$
  WITH adds AS (
    SELECT w.product_id, COUNT(*) AS wish_count,
           COUNT(DISTINCT oi.order_id) AS converted_count
    FROM wishlist_items w
    LEFT JOIN order_items oi ON oi.product_id = w.product_id
    LEFT JOIN orders o ON o.id = oi.order_id
      AND o.customer_id = w.customer_id
      AND o.merchant_id = p_merchant_id
      AND o.status NOT IN ('pending','cancelled')
      AND o.created_at::date BETWEEN p_start AND p_end
    WHERE w.merchant_id = p_merchant_id
      AND w.created_at::date BETWEEN p_start AND p_end
    GROUP BY w.product_id
  )
  SELECT
    p.id, p.name, p.image_url,
    COALESCE(a.wish_count, 0)      AS wishlist_adds,
    COALESCE(a.converted_count, 0) AS converted,
    CASE WHEN COALESCE(a.wish_count, 0) = 0 THEN 0
      ELSE ROUND(COALESCE(a.converted_count,0)::numeric
                 / a.wish_count * 100, 1)
    END                            AS conversion_pct,
    COALESCE(p.stock_quantity, 0)  AS current_stock
  FROM products p
  LEFT JOIN adds a ON a.product_id = p.id
  WHERE p.merchant_id = p_merchant_id
  ORDER BY wishlist_adds DESC;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 4 — stock levels with sell-through rate (current snapshot)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_stock_levels(
  p_merchant_id  uuid,
  p_start        date,
  p_end          date
)
RETURNS TABLE (
  product_id         uuid,
  product_name       text,
  image_url          text,
  sku                text,
  current_stock      bigint,
  restock_threshold  int,
  sold_in_period     bigint,
  sell_through_pct   numeric,
  stock_value        numeric,
  is_out_of_stock    boolean,
  is_low_stock       boolean,
  days_of_stock_left numeric   -- current_stock / avg daily sales
)
LANGUAGE sql STABLE AS $$
  WITH sales AS (
    SELECT oi.product_id, SUM(oi.quantity) AS sold_qty
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
      AND o.merchant_id = p_merchant_id
      AND o.status NOT IN ('pending','cancelled')
      AND o.created_at::date BETWEEN p_start AND p_end
    GROUP BY oi.product_id
  ),
  period_days AS AS (SELECT (p_end - p_start + 1)::numeric AS days)
  SELECT
    p.id,
    p.name,
    p.image_url,
    p.sku,
    COALESCE(p.stock_quantity, 0)                                   AS current_stock,
    COALESCE(p.restock_threshold, 5)                                AS restock_threshold,
    COALESCE(s.sold_qty, 0)                                         AS sold_in_period,
    CASE
      WHEN COALESCE(s.sold_qty,0) + COALESCE(p.stock_quantity,0) = 0 THEN 0
      ELSE ROUND(
        COALESCE(s.sold_qty,0)::numeric
        / (COALESCE(s.sold_qty,0) + COALESCE(p.stock_quantity,0)) * 100, 1)
    END                                                             AS sell_through_pct,
    ROUND(COALESCE(p.stock_quantity,0) * COALESCE(p.price,0), 2)   AS stock_value,
    COALESCE(p.stock_quantity, 0) = 0                               AS is_out_of_stock,
    COALESCE(p.stock_quantity, 0) > 0
      AND COALESCE(p.stock_quantity, 0) <= COALESCE(p.restock_threshold, 5) AS is_low_stock,
    CASE
      WHEN COALESCE(s.sold_qty,0) = 0 THEN NULL
      ELSE ROUND(
        COALESCE(p.stock_quantity,0)
        / (COALESCE(s.sold_qty,0)::numeric / (p_end - p_start + 1)), 0)
    END                                                             AS days_of_stock_left
  FROM products p
  CROSS JOIN (SELECT (p_end - p_start + 1)::numeric AS days) pd
  LEFT JOIN sales s ON s.product_id = p.id
  WHERE p.merchant_id = p_merchant_id
    AND p.is_active = true
  ORDER BY is_out_of_stock DESC, is_low_stock DESC, sell_through_pct DESC;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 5 — fulfillment timing stats
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_fulfillment_stats(
  p_merchant_id  uuid,
  p_start        date,
  p_end          date
)
RETURNS TABLE (
  total_orders          bigint,
  avg_confirm_mins      numeric,   -- created_at → confirmed_at
  avg_prepare_mins      numeric,   -- confirmed_at → preparing_at
  avg_ready_mins        numeric,   -- preparing_at → ready_at
  avg_deliver_mins      numeric,   -- ready_at → delivered_at
  avg_total_mins        numeric,   -- created_at → delivered_at
  sla_met_count         bigint,    -- delivered within 24h of order
  sla_breach_count      bigint,
  sla_rate_pct          numeric,
  overdue_unconfirmed   bigint,    -- paid >2h ago, still not confirmed
  overdue_unprepared    bigint     -- confirmed >4h ago, still not preparing
)
LANGUAGE sql STABLE AS $$
  SELECT
    COUNT(*)                                                                  AS total_orders,
    ROUND(AVG(EXTRACT(EPOCH FROM (confirmed_at  - created_at))   / 60), 1)  AS avg_confirm_mins,
    ROUND(AVG(EXTRACT(EPOCH FROM (preparing_at  - confirmed_at)) / 60), 1)  AS avg_prepare_mins,
    ROUND(AVG(EXTRACT(EPOCH FROM (ready_at      - preparing_at)) / 60), 1)  AS avg_ready_mins,
    ROUND(AVG(EXTRACT(EPOCH FROM (delivered_at  - ready_at))     / 60), 1)  AS avg_deliver_mins,
    ROUND(AVG(EXTRACT(EPOCH FROM (delivered_at  - created_at))   / 60), 1)  AS avg_total_mins,
    COUNT(*) FILTER (WHERE delivered_at IS NOT NULL
      AND EXTRACT(EPOCH FROM (delivered_at - created_at))/3600 <= 24)        AS sla_met_count,
    COUNT(*) FILTER (WHERE delivered_at IS NOT NULL
      AND EXTRACT(EPOCH FROM (delivered_at - created_at))/3600 > 24)         AS sla_breach_count,
    ROUND(
      COUNT(*) FILTER (WHERE delivered_at IS NOT NULL
        AND EXTRACT(EPOCH FROM (delivered_at - created_at))/3600 <= 24)::numeric
      / NULLIF(COUNT(*) FILTER (WHERE delivered_at IS NOT NULL), 0) * 100, 1) AS sla_rate_pct,
    COUNT(*) FILTER (
      WHERE status = 'paid'
      AND EXTRACT(EPOCH FROM (NOW() - created_at))/3600 > 2)                 AS overdue_unconfirmed,
    COUNT(*) FILTER (
      WHERE status = 'confirmed'
      AND EXTRACT(EPOCH FROM (NOW() - confirmed_at))/3600 > 4)               AS overdue_unprepared
  FROM orders
  WHERE merchant_id = p_merchant_id
    AND status NOT IN ('pending','cancelled')
    AND created_at::date BETWEEN p_start AND p_end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 6 — fulfillment queue (orders needing action right now)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_fulfillment_queue(p_merchant_id uuid)
RETURNS TABLE (
  order_id       uuid,
  order_number   text,
  status         text,
  customer_name  text,
  total_amount   numeric,
  item_count     bigint,
  created_at     timestamptz,
  mins_in_status numeric,
  is_overdue     boolean,
  delivery_type  text
)
LANGUAGE sql STABLE AS $$
  SELECT
    o.id,
    o.order_number,
    o.status,
    p.full_name                                                    AS customer_name,
    o.total_amount,
    (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
    o.created_at,
    ROUND(EXTRACT(EPOCH FROM (NOW() - CASE
      WHEN o.status = 'paid'      THEN o.created_at
      WHEN o.status = 'confirmed' THEN o.confirmed_at
      WHEN o.status = 'preparing' THEN o.preparing_at
      ELSE o.created_at
    END)) / 60, 0)                                                 AS mins_in_status,
    CASE
      WHEN o.status = 'paid'      AND EXTRACT(EPOCH FROM NOW()-o.created_at)/3600 > 2  THEN true
      WHEN o.status = 'confirmed' AND EXTRACT(EPOCH FROM NOW()-o.confirmed_at)/3600 > 4 THEN true
      WHEN o.status = 'preparing' AND EXTRACT(EPOCH FROM NOW()-o.preparing_at)/3600 > 6 THEN true
      ELSE false
    END                                                            AS is_overdue,
    COALESCE(o.delivery_type, o.delivery_provider, 'unknown')     AS delivery_type
  FROM orders o
  LEFT JOIN profiles p ON p.id = o.customer_id
  WHERE o.merchant_id = p_merchant_id
    AND o.status IN ('paid','confirmed','preparing','ready_for_pickup')
  ORDER BY is_overdue DESC, o.created_at ASC;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 7 — delivery provider performance
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_delivery_performance(
  p_merchant_id  uuid,
  p_start        date,
  p_end          date
)
RETURNS TABLE (
  provider          text,
  order_count       bigint,
  completed_count   bigint,
  cancelled_count   bigint,
  success_rate_pct  numeric,
  avg_delivery_hrs  numeric,
  avg_fee           numeric
)
LANGUAGE sql STABLE AS $$
  SELECT
    COALESCE(delivery_provider, 'self_pickup')         AS provider,
    COUNT(*)                                           AS order_count,
    COUNT(*) FILTER (WHERE status = 'delivered')       AS completed_count,
    COUNT(*) FILTER (WHERE status = 'cancelled')       AS cancelled_count,
    ROUND(
      COUNT(*) FILTER (WHERE status = 'delivered')::numeric
      / NULLIF(COUNT(*) FILTER (WHERE status NOT IN ('pending','cancelled')), 0) * 100, 1
    )                                                  AS success_rate_pct,
    ROUND(AVG(
      EXTRACT(EPOCH FROM (delivered_at - created_at)) / 3600
    ) FILTER (WHERE delivered_at IS NOT NULL), 1)      AS avg_delivery_hrs,
    ROUND(AVG(delivery_fee), 2)                        AS avg_fee
  FROM orders
  WHERE merchant_id = p_merchant_id
    AND created_at::date BETWEEN p_start AND p_end
  GROUP BY provider
  ORDER BY order_count DESC;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 8 — payment management
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_payment_stats(
  p_merchant_id  uuid,
  p_start        date,
  p_end          date
)
RETURNS TABLE (
  payment_method        text,
  order_count           bigint,
  total_revenue         numeric,
  paid_count            bigint,
  pending_count         bigint,
  failed_count          bigint,
  avg_order_value       numeric
)
LANGUAGE sql STABLE AS $$
  SELECT
    COALESCE(payment_method, 'unknown')           AS payment_method,
    COUNT(*)                                      AS order_count,
    COALESCE(SUM(total_amount),0)                 AS total_revenue,
    COUNT(*) FILTER (WHERE payment_status='paid')    AS paid_count,
    COUNT(*) FILTER (WHERE payment_status='pending') AS pending_count,
    COUNT(*) FILTER (WHERE payment_status='failed')  AS failed_count,
    ROUND(AVG(total_amount),2)                    AS avg_order_value
  FROM orders
  WHERE merchant_id = p_merchant_id
    AND created_at::date BETWEEN p_start AND p_end
  GROUP BY payment_method
  ORDER BY total_revenue DESC;
$$;
```

> **Note on the stock RPC:** fix the duplicate `AS` typo — `CROSS JOIN (SELECT ...) pd` works as-is in PostgreSQL.

***

## Step 2 — `src/app/(dashboard)/reports/products/page.tsx`

```typescript
import { getMerchant } from '@/lib/utils.server'
import { ProductsAnalyticsClient } from '@/components/dashboard/ProductsAnalyticsClient'
import { subDays, format } from 'date-fns'

function toDate(s: string | undefined, fallback: Date) {
  if (!s) return fallback
  const d = new Date(s); return isNaN(d.getTime()) ? fallback : d
}

export default async function ProductsAnalyticsPage({
  searchParams,
}: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { from, to } = await searchParams
  const { supabase, merchant } = await getMerchant()
  const endDate   = toDate(to,   new Date())
  const startDate = toDate(from, subDays(endDate, 29))
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

  const [
    { data: productSales },
    { data: variantSales },
    { data: wishlistStats },
  ] = await Promise.all([
    supabase.rpc('get_product_sales_detail', {
      p_merchant_id: merchant.id, p_start: fmt(startDate), p_end: fmt(endDate),
    }),
    supabase.rpc('get_variant_sales', {
      p_merchant_id: merchant.id, p_start: fmt(startDate), p_end: fmt(endDate),
    }),
    supabase.rpc('get_wishlist_stats', {
      p_merchant_id: merchant.id, p_start: fmt(startDate), p_end: fmt(endDate),
    }),
  ])

  return (
    <ProductsAnalyticsClient
      merchantId={merchant.id}
      dateRange={{ from: fmt(startDate), to: fmt(endDate) }}
      productSales={(productSales   as any[]) ?? []}
      variantSales={(variantSales   as any[]) ?? []}
      wishlistStats={(wishlistStats as any[]) ?? []}
    />
  )
}
```


***

## Step 3 — `src/components/dashboard/ProductsAnalyticsClient.tsx`

```typescript
'use client'
import { useState }    from 'react'
import { useRouter }   from 'next/navigation'
import { format, subDays } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
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
              <Tooltip formatter={(v: number, name: string) =>
                name === 'qty' ? [v, 'Units'] : [`RM ${v.toFixed(2)}`, 'Revenue']}
                contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }} />
              <Bar dataKey="qty" radius={[0,6,6,0]}
                label={{ position: 'right', fontSize: 11, fill: '#6b7280', formatter: (v: number) => `${v} units` }}>
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
                          ? <img src={p.image_url} className="w-8 h-8 rounded-lg object-cover" alt="" />
                          : <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center"><Package size={14} className="text-gray-400" /></div>}
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
              <Tooltip formatter={(v: number, name: string) =>
                name === 'revenue' ? [`RM ${v.toFixed(2)}`, 'Revenue'] : [v, 'Units']}
                contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }} />
              <Bar dataKey="revenue" radius={[0,6,6,0]}
                label={{ position: 'right', fontSize: 11, fill: '#6b7280', formatter: (v: number) => `RM ${v.toFixed(0)}` }}>
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
                          ? <img src={p.image_url} className="w-8 h-8 rounded-lg object-cover shrink-0" alt="" />
                          : <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0"><Package size={14} className="text-gray-400" /></div>}
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
                    ? <img src={p.image_url} className="w-10 h-10 rounded-xl object-cover shrink-0" alt="" />
                    : <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0"><Package size={16} className="text-gray-400" /></div>}
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
```


***

## Step 4 — `src/app/(dashboard)/operations/page.tsx`

```typescript
import { getMerchant } from '@/lib/utils.server'
import { OperationsClient } from '@/components/dashboard/OperationsClient'
import { subDays, format } from 'date-fns'

function toDate(s: string | undefined, fallback: Date) {
  if (!s) return fallback
  const d = new Date(s); return isNaN(d.getTime()) ? fallback : d
}

export default async function OperationsPage({
  searchParams,
}: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { from, to } = await searchParams
  const { supabase, merchant } = await getMerchant()
  const endDate   = toDate(to,   new Date())
  const startDate = toDate(from, subDays(endDate, 29))
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

  const [
    { data: fulfillmentStats },
    { data: fulfillmentQueue },
    { data: stockLevels },
    { data: deliveryPerf },
    { data: paymentStats },
    { data: pendingPayments },
  ] = await Promise.all([
    supabase.rpc('get_fulfillment_stats',     { p_merchant_id: merchant.id, p_start: fmt(startDate), p_end: fmt(endDate) }),
    supabase.rpc('get_fulfillment_queue',     { p_merchant_id: merchant.id }),
    supabase.rpc('get_stock_levels',          { p_merchant_id: merchant.id, p_start: fmt(startDate), p_end: fmt(endDate) }),
    supabase.rpc('get_delivery_performance',  { p_merchant_id: merchant.id, p_start: fmt(startDate), p_end: fmt(endDate) }),
    supabase.rpc('get_payment_stats',         { p_merchant_id: merchant.id, p_start: fmt(startDate), p_end: fmt(endDate) }),
    supabase.from('orders')
      .select('id, order_number, total_amount, payment_method, created_at, customer:customer_id(full_name)')
      .eq('merchant_id', merchant.id)
      .eq('payment_status', 'pending')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true })
      .limit(50),
  ])

  return (
    <OperationsClient
      merchantId={merchant.id}
      dateRange={{ from: fmt(startDate), to: fmt(endDate) }}
      fulfillmentStats={(fulfillmentStats as any)?.[^0] ?? {}}
      fulfillmentQueue={(fulfillmentQueue as any[]) ?? []}
      stockLevels={(stockLevels       as any[]) ?? []}
      deliveryPerf={(deliveryPerf     as any[]) ?? []}
      paymentStats={(paymentStats     as any[]) ?? []}
      pendingPayments={(pendingPayments as any[]) ?? []}
    />
  )
}
```


***

## Step 5 — `src/components/dashboard/OperationsClient.tsx`

```typescript
'use client'
import { useState }     from 'react'
import { useRouter }    from 'next/navigation'
import { format, subDays } from 'date-fns'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { cn }       from '@/lib/utils'
import toast        from 'react-hot-toast'
import { Package, Truck, CreditCard, AlertTriangle, CheckCircle2, Clock, Loader2, ChevronDown, Download } from 'lucide-react'

const COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#65a30d']

const STATUS_SLA: Record<string, number> = {
  paid:             2 * 60,  // must confirm within 2h (minutes)
  confirmed:        4 * 60,  // must start preparing within 4h
  preparing:        6 * 60,  // must be ready within 6h
  ready_for_pickup: 2 * 60,  // must dispatch within 2h
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid:             'bg-blue-100   text-blue-700',
    confirmed:        'bg-indigo-100 text-indigo-700',
    preparing:        'bg-purple-100 text-purple-700',
    ready_for_pickup: 'bg-cyan-100   text-cyan-700',
    out_for_delivery: 'bg-sky-100    text-sky-700',
    delivered:        'bg-green-100  text-green-700',
    cancelled:        'bg-red-100    text-red-700',
  }
  return (
    <span className={cn('text-xs font-bold px-2.5 py-0.5 rounded-full capitalize whitespace-nowrap',
      map[status] ?? 'bg-gray-100 text-gray-600')}>
      {status.replace(/_/g,' ')}
    </span>
  )
}

function MetricRow({ label, value, unit, warn }: { label: string; value: string | number; unit?: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={cn('text-sm font-bold', warn ? 'text-red-600' : 'text-gray-900')}>
        {value}{unit ? <span className="text-gray-400 font-normal ml-1 text-xs">{unit}</span> : ''}
      </span>
    </div>
  )
}

const rm = (v: number) => `RM ${Number(v ?? 0).toFixed(2)}`
const n  = (v: any)    => Number(v ?? 0)

function minsToLabel(mins: number | null): string {
  if (!mins || mins <= 0) return '—'
  if (mins < 60)  return `${mins}m`
  const h = Math.floor(mins / 60), m = Math.round(mins % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function OperationsClient({
  merchantId, dateRange, fulfillmentStats, fulfillmentQueue,
  stockLevels, deliveryPerf, paymentStats, pendingPayments,
}: {
  merchantId:      string
  dateRange:       { from: string; to: string }
  fulfillmentStats: any
  fulfillmentQueue: any[]
  stockLevels:      any[]
  deliveryPerf:     any[]
  paymentStats:     any[]
  pendingPayments:  any[]
}) {
  const router   = useRouter()
  const supabase = createClient()
  const [tab,    setTab]    = useState<'fulfillment'|'stock'|'delivery'|'payments'>('fulfillment')
  const [show,   setShow]   = useState(false)
  const [from,   setFrom]   = useState(dateRange.from)
  const [to,     setTo]     = useState(dateRange.to)
  const [stockQ, setStockQ] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const apply = (f: string, t: string) => { router.push(`/operations?from=${f}&to=${t}`); setShow(false) }

  const DATE_PRESETS = [
    { label: 'Last 7 days',  fn: () => ({ from: format(subDays(new Date(),6),'yyyy-MM-dd'),  to: format(new Date(),'yyyy-MM-dd') }) },
    { label: 'Last 30 days', fn: () => ({ from: format(subDays(new Date(),29),'yyyy-MM-dd'), to: format(new Date(),'yyyy-MM-dd') }) },
  ]

  // Advance order status from queue
  const handleAdvanceStatus = async (orderId: string, currentStatus: string) => {
    const NEXT: Record<string, string> = {
      paid: 'confirmed', confirmed: 'preparing', preparing: 'ready_for_pickup',
    }
    const next = NEXT[currentStatus]
    if (!next) return
    setUpdatingId(orderId)
    const now   = new Date().toISOString()
    const tsMap: Record<string, string> = {
      confirmed: 'confirmed_at', preparing: 'preparing_at', ready_for_pickup: 'ready_at',
    }
    const { error } = await supabase.from('orders')
      .update({ status: next, [tsMap[next]]: now })
      .eq('id', orderId)
    if (error) toast.error(error.message)
    else { toast.success(`Order moved to ${next.replace(/_/g,' ')}`); router.refresh() }
    setUpdatingId(null)
  }

  // Confirm payment
  const handleConfirmPayment = async (orderId: string) => {
    setUpdatingId(orderId)
    const { error } = await supabase.from('orders')
      .update({ payment_status: 'paid' })
      .eq('id', orderId)
    if (error) toast.error(error.message)
    else { toast.success('Payment confirmed'); router.refresh() }
    setUpdatingId(null)
  }

  // Computed values
  const overdueOrders  = fulfillmentQueue.filter(o => o.is_overdue)
  const outOfStock     = stockLevels.filter(p => n(p.current_stock) === 0)
  const lowStock       = stockLevels.filter(p => n(p.current_stock) > 0 && n(p.current_stock) <= n(p.restock_threshold))
  const totalStockValue = stockLevels.reduce((s, p) => s + n(p.stock_value), 0)

  const paymentPie = paymentStats.map((pm, i) => ({
    name:  (pm.payment_method ?? 'Unknown').replace(/_/g,' '),
    value: n(pm.total_revenue),
    color: COLORS[i % COLORS.length],
  }))

  const filteredStock = stockLevels.filter(p =>
    !stockQ || p.product_name?.toLowerCase().includes(stockQ.toLowerCase()))

  return (
    <div className="space-y-5">

      {/* ── Header + date range ─────────────────────────────────────────── */}
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

      {/* ── Alert bar ───────────────────────────────────────────────────── */}
      {(overdueOrders.length > 0 || outOfStock.length > 0 || pendingPayments.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {overdueOrders.length > 0 && (
            <button onClick={() => setTab('fulfillment')}
              className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-red-100 transition-colors">
              <AlertTriangle size={15} />
              {overdueOrders.length} overdue order{overdueOrders.length !== 1 ? 's' : ''} need attention
            </button>
          )}
          {outOfStock.length > 0 && (
            <button onClick={() => setTab('stock')}
              className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-amber-100 transition-colors">
              <Package size={15} />
              {outOfStock.length} out-of-stock product{outOfStock.length !== 1 ? 's' : ''}
            </button>
          )}
          {pendingPayments.length > 0 && (
            <button onClick={() => setTab('payments')}
              className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-blue-100 transition-colors">
              <CreditCard size={15} />
              {pendingPayments.length} pending payment{pendingPayments.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit flex-wrap">
        {[
          { key: 'fulfillment', label: `📋 Fulfillment${overdueOrders.length > 0 ? ` (${overdueOrders.length}!)` : ''}` },
          { key: 'stock',       label: `📦 Stock${outOfStock.length > 0 ? ` (${outOfStock.length})` : ''}` },
          { key: 'delivery',    label: '🚚 Delivery'  },
          { key: 'payments',    label: `💳 Payments${pendingPayments.length > 0 ? ` (${pendingPayments.length})` : ''}` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ FULFILLMENT TAB ══════════════════════════════════════════════ */}
      {tab === 'fulfillment' && (
        <div className="space-y-4">
          {/* SLA + timing stats */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              { label: 'SLA Rate (< 24h)',     value: `${n(fulfillmentStats.sla_rate_pct)}%`,  warn: n(fulfillmentStats.sla_rate_pct) < 80 },
              { label: 'Avg Total Fulfillment', value: minsToLabel(n(fulfillmentStats.avg_total_mins)), warn: n(fulfillmentStats.avg_total_mins) > 1440 },
              { label: 'Avg Confirm Time',      value: minsToLabel(n(fulfillmentStats.avg_confirm_mins)), warn: false },
              { label: 'Avg Delivery Time',     value: minsToLabel(n(fulfillmentStats.avg_deliver_mins)), warn: false },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs text-gray-400">{card.label}</p>
                <p className={cn('text-2xl font-bold mt-1', card.warn ? 'text-red-600' : 'text-gray-900')}>
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          {/* Timing breakdown card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 mb-4">Avg Time Per Stage</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { stage: 'Order → Confirm',  value: n(fulfillmentStats.avg_confirm_mins), sla: 120  },
                { stage: 'Confirm → Prepare', value: n(fulfillmentStats.avg_prepare_mins), sla: 240 },
                { stage: 'Prepare → Ready',  value: n(fulfillmentStats.avg_ready_mins),   sla: 360  },
                { stage: 'Ready → Delivered', value: n(fulfillmentStats.avg_deliver_mins), sla: 120 },
              ].map(s => {
                const ok = s.value > 0 && s.value <= s.sla
                return (
                  <div key={s.stage} className={cn('rounded-xl p-3 border',
                    s.value > s.sla && s.value > 0 ? 'bg-red-50 border-red-200' :
                    s.value > 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100')}>
                    <p className="text-xs text-gray-500 mb-1">{s.stage}</p>
                    <p className={cn('text-xl font-bold',
                      s.value > s.sla && s.value > 0 ? 'text-red-600' :
                      s.value > 0 ? 'text-green-700' : 'text-gray-400')}>
                      {minsToLabel(s.value)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">SLA: {minsToLabel(s.sla)}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Live queue */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900">Fulfillment Queue</h3>
                <p className="text-xs text-gray-400 mt-0.5">{fulfillmentQueue.length} orders awaiting action</p>
              </div>
              {overdueOrders.length > 0 && (
                <span className="flex items-center gap-1 bg-red-100 text-red-700 text-xs font-bold px-3 py-1.5 rounded-xl">
                  <AlertTriangle size={12} /> {overdueOrders.length} overdue
                </span>
              )}
            </div>
            {fulfillmentQueue.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 size={32} className="mx-auto text-green-400 mb-3" />
                <p className="text-gray-500 font-semibold">All caught up! No orders in queue.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-50">
                    {['Order','Customer','Status','Items','Total','Time in Status','Delivery','Action'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-400 pb-2 pr-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {fulfillmentQueue.map(o => {
                      const NEXT_LABEL: Record<string, string> = {
                        paid: 'Confirm', confirmed: 'Prepare', preparing: 'Mark Ready',
                      }
                      const mins = n(o.mins_in_status)
                      return (
                        <tr key={o.order_id}
                          className={cn('border-b border-gray-50 last:border-0',
                            o.is_overdue ? 'bg-red-50/50' : 'hover:bg-gray-50/50')}>
                          <td className="py-2.5 pr-3">
                            <span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-lg">
                              {o.order_number}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-gray-700 max-w-[120px] truncate">{o.customer_name ?? 'Guest'}</td>
                          <td className="py-2.5 pr-3"><StatusBadge status={o.status} /></td>
                          <td className="py-2.5 pr-3 text-gray-600">{o.item_count}</td>
                          <td className="py-2.5 pr-3 font-bold text-gray-900">{rm(o.total_amount)}</td>
                          <td className="py-2.5 pr-3">
                            <span className={cn('text-xs font-medium flex items-center gap-1',
                              o.is_overdue ? 'text-red-600' : 'text-gray-500')}>
                              {o.is_overdue && <AlertTriangle size={11} />}
                              {minsToLabel(mins)}
                              {o.is_overdue && ' (overdue)'}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3">
                            <span className="text-xs text-gray-500 capitalize">
                              {(o.delivery_type ?? 'unknown').replace(/_/g,' ')}
                            </span>
                          </td>
                          <td className="py-2.5">
                            {NEXT_LABEL[o.status] && (
                              <button
                                onClick={() => handleAdvanceStatus(o.order_id, o.status)}
                                disabled={updatingId === o.order_id}
                                className={cn(
                                  'text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1',
                                  o.is_overdue
                                    ? 'bg-red-600 hover:bg-red-700 text-white'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                )}>
                                {updatingId === o.order_id ? <Loader2 size={11} className="animate-spin" /> : null}
                                {NEXT_LABEL[o.status]}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ STOCK TAB ════════════════════════════════════════════════════ */}
      {tab === 'stock' && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs text-gray-400">Total Stock Value</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{rm(totalStockValue)}</p>
            </div>
            <div className={cn('rounded-2xl border p-4', outOfStock.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100')}>
              <p className="text-xs text-gray-400">Out of Stock</p>
              <p className={cn('text-2xl font-bold mt-1', outOfStock.length > 0 ? 'text-red-600' : 'text-gray-900')}>
                {outOfStock.length} products
              </p>
            </div>
            <div className={cn('rounded-2xl border p-4', lowStock.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100')}>
              <p className="text-xs text-gray-400">Low Stock</p>
              <p className={cn('text-2xl font-bold mt-1', lowStock.length > 0 ? 'text-amber-600' : 'text-gray-900')}>
                {lowStock.length} products
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs text-gray-400">Avg Sell-Through</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stockLevels.length > 0
                  ? `${Math.round(stockLevels.reduce((s,p) => s + n(p.sell_through_pct), 0) / stockLevels.length)}%`
                  : '—'}
              </p>
            </div>
          </div>

          {/* Stock table */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Stock Levels & Sell-Through Rate</h3>
              <div className="flex gap-2">
                <Input placeholder="Search products..." value={stockQ}
                  onChange={e => setStockQ(e.target.value)} className="h-8 text-xs w-36" />
                <Button variant="outline" size="sm" onClick={() =>
                  exportCSV([['Product','SKU','Stock','Threshold','Sold (period)','Sell-Through %','Stock Value','Days Left'],
                    ...stockLevels.map(p => [p.product_name, p.sku, p.current_stock, p.restock_threshold,
                      p.sold_in_period, `${p.sell_through_pct}%`, rm(p.stock_value),
                      p.days_of_stock_left ?? '—'])],
                    `stock-levels-${new Date().toISOString().slice(0,10)}.csv`)}>
                  <Download size={13} className="mr-1" /> Export
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-50">
                  {['Product','Stock','Threshold','Sold','Sell-Through','Stock Value','Days Left','Status'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-400 pb-2 pr-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filteredStock.map(p => (
                    <tr key={p.product_id}
                      className={cn('border-b border-gray-50 last:border-0',
                        n(p.current_stock) === 0 ? 'bg-red-50/40' :
                        n(p.current_stock) <= n(p.restock_threshold) ? 'bg-amber-50/40' : 'hover:bg-gray-50/50')}>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          {p.image_url
                            ? <img src={p.image_url} className="w-8 h-8 rounded-lg object-cover shrink-0" alt="" />
                            : <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0"><Package size={14} className="text-gray-400" /></div>}
                          <div>
                            <p className="font-semibold text-gray-800 max-w-[130px] truncate">{p.product_name}</p>
                            {p.sku && <p className="text-xs text-gray-400 font-mono">{p.sku}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 font-bold text-gray-900">{n(p.current_stock)}</td>
                      <td className="py-2.5 pr-4 text-gray-400">{p.restock_threshold}</td>
                      <td className="py-2.5 pr-4 text-gray-600">{n(p.sold_in_period)}</td>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full',
                              n(p.sell_through_pct) >= 80 ? 'bg-green-500' :
                              n(p.sell_through_pct) >= 50 ? 'bg-blue-500' :
                              n(p.sell_through_pct) >= 20 ? 'bg-amber-400' : 'bg-red-400')}
                              style={{ width: `${Math.min(n(p.sell_through_pct), 100)}%` }} />
                          </div>
                          <span className="text-xs text-gray-500">{p.sell_through_pct}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600">{rm(p.stock_value)}</td>
                      <td className="py-2.5 pr-4">
                        {p.days_of_stock_left != null ? (
                          <span className={cn('text-xs font-semibold',
                            n(p.days_of_stock_left) <= 7  ? 'text-red-600' :
                            n(p.days_of_stock_left) <= 14 ? 'text-amber-600' : 'text-gray-600')}>
                            {n(p.days_of_stock_left)}d
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="py-2.5">
                        <StockBadge stock={n(p.current_stock)} threshold={n(p.restock_threshold)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ DELIVERY TAB ═════════════════════════════════════════════════ */}
      {tab === 'delivery' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {deliveryPerf.map(d => (
              <div key={d.provider} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 capitalize">
                      {d.provider === 'lalamove'   ? '🏍️ Lalamove'
                       : d.provider === 'easyparcel' ? '📦 EasyParcel'
                       : d.provider === 'self_pickup' ? '🏃 Self Pickup'
                       : d.provider}
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">{d.order_count} orders</p>
                  </div>
                  <span className={cn('text-lg font-bold',
                    n(d.success_rate_pct) >= 90 ? 'text-green-600' :
                    n(d.success_rate_pct) >= 70 ? 'text-amber-600' : 'text-red-500')}>
                    {n(d.success_rate_pct) > 0 ? `${d.success_rate_pct}%` : '—'}
                    <span className="text-xs text-gray-400 font-normal ml-1">success</span>
                  </span>
                </div>
                <div className="space-y-0">
                  <MetricRow label="Completed"        value={d.completed_count} unit="orders" />
                  <MetricRow label="Cancelled"        value={d.cancelled_count} unit="orders"
                    warn={n(d.cancelled_count) > n(d.completed_count) * 0.1} />
                  <MetricRow label="Avg Delivery Time" value={minsToLabel(n(d.avg_delivery_hrs) * 60)}
                    warn={n(d.avg_delivery_hrs) > 24} />
                  <MetricRow label="Avg Delivery Fee"  value={rm(d.avg_fee)} />
                </div>
              </div>
            ))}

            {deliveryPerf.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center col-span-2">
                <Truck size={32} className="mx-auto text-gray-200 mb-3" />
                <p className="text-gray-400 text-sm">No delivery data in this period</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ PAYMENTS TAB ═════════════════════════════════════════════════ */}
      {tab === 'payments' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

            {/* Payment method pie */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-4">Revenue by Payment Method</h3>
              {paymentPie.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={paymentPie} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" outerRadius={80} innerRadius={45}>
                        {paymentPie.map((p, i) => <Cell key={i} fill={p.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`RM ${v.toFixed(2)}`, 'Revenue']}
                        contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-0 mt-2">
                    {paymentStats.map(pm => (
                      <div key={pm.payment_method} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                        <span className="text-sm text-gray-700 capitalize">
                          {(pm.payment_method ?? 'Unknown').replace(/_/g,' ')}
                        </span>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">{rm(pm.total_revenue)}</p>
                          <p className="text-xs text-gray-400">{pm.order_count} orders</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-gray-400 text-sm text-center py-8">No payment data</p>
              )}
            </div>

            {/* Pending payments queue */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">Pending Payments</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{pendingPayments.length} unpaid orders</p>
                </div>
                {pendingPayments.length > 0 && (
                  <span className="text-sm font-bold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-xl">
                    {rm(pendingPayments.reduce((s,o) => s + n(o.total_amount), 0))} outstanding
                  </span>
                )}
              </div>
              {pendingPayments.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 size={32} className="mx-auto text-green-400 mb-3" />
                  <p className="text-gray-500 font-semibold">All payments collected!</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {pendingPayments.map(o => (
                    <div key={o.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-lg">
                            {o.order_number}
                          </span>
                          <span className="text-xs text-gray-400 capitalize">
                            {(o.payment_method ?? '—').replace(/_/g,' ')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {o.customer?.full_name ?? 'Guest'} ·{' '}
                          {format(new Date(o.created_at), 'd MMM, h:mm a')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{rm(o.total_amount)}</span>
                        <button
                          onClick={() => handleConfirmPayment(o.id)}
                          disabled={updatingId === o.id}
                          className="text-xs bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                          {updatingId === o.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                          Confirm
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Import StockBadge locally
function StockBadge({ stock, threshold }: { stock: number; threshold: number }) {
  if (stock === 0)        return <span className="text-xs bg-red-100   text-red-700   font-bold px-2 py-0.5 rounded-full">Out of stock</span>
  if (stock <= threshold) return <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">Low stock</span>
  return                         <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">{stock} in stock</span>
}
```


***

## Step 6 — Sidebar Updates

```typescript
// Add to NAV in Sidebar.tsx:
{ href: '/reports/products', label: 'Product Analytics', icon: BarChart2   },
{ href: '/operations',       label: 'Operations',        icon: Settings2   },
```


***

## Complete Feature Coverage

| Feature | Page | Implementation |
| :-- | :-- | :-- |
| Quantity sold | Products → By Quantity | `SUM(quantity)` on `order_items` |
| Wishlist adds + conversion | Products → Wishlist | `wishlist_items` table [^1] |
| Best sellers by quantity | Products → By Quantity | Horizontal bar chart + ranked table |
| Best sellers by revenue | Products → By Revenue | Horizontal bar chart + ranked table |
| Gross margin per product | Products → All Products | `(revenue − cost × qty) / revenue` |
| Variant breakdown | Products → Variants | `get_variant_sales` RPC |
| Stock levels | Operations → Stock | `products.stock_quantity` |
| Sell-through rate | Operations → Stock | `sold / (sold + stock) × 100` [^4] |
| Low / out-of-stock alerts | Operations alert bar | Threshold comparison |
| Days of stock remaining | Operations → Stock | `stock / avg daily sales` |
| Shipping status (in-flight) | Operations → Delivery | Live `out_for_delivery` orders |
| Delivery times by provider | Operations → Delivery | `avg(delivered_at − created_at)` |
| Fulfillment progress | Operations → Fulfillment | Live queue + per-stage timing |
| SLA compliance rate | Operations → Fulfillment | `< 24h` delivery count / total [^2] |
| Overdue order alerts | Operations alert bar | Minutes in status > threshold |
| Advance order status inline | Operations queue | One-click status buttons |
| Payment management | Operations → Payments | Pending payments confirm queue |
| Payment method breakdown | Operations → Payments | Pie chart by method |

<span style="display:none">[^10][^11][^12][^13][^14][^15][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://www.alexanderjarvis.com/what-is-sell-through-rate-in-ecommerce/

[^2]: https://kpidepot.com/kpi/sla-fulfillment-rate

[^3]: https://en.codept.de/blog/how-to-use-data-analytics-in-ecommerce-fulfilment

[^4]: https://www.shopify.com/retail/sell-through-rate

[^5]: https://cufinder.io/blog/wiki/marketing-metrics/sell-through-rate/

[^6]: https://g3cfo.com/sell-through-rate-thinking-in-ecommerce/

[^7]: https://www.flieber.com/glossary/sell-through-rate-in-ecommerce-inventory-operations

[^8]: https://www.wallstreetprep.com/knowledge/sell-through-rate/

[^9]: https://www.integrate.io/blog/build-slas-for-real-time-dashboards-with-ai-etl/

[^10]: https://www.shopify.com/blog/sell-through-rate

[^11]: https://www.unleashedsoftware.com/blog/sell-through-rate-formula/

[^12]: https://wapi.com/service-level-agreements-sla/

[^13]: https://www.inflowinventory.com/blog/what-is-sell-through-rate-heres-why-it-matters-for-your-business/

[^14]: https://www.shipnetwork.com/post/top-order-fulfillment-metrics

[^15]: https://www.shipbob.com/blog/sell-through-rate/

