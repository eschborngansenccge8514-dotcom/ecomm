<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# We also need admin panel to manage the merchants

Here is the complete platform admin panel — SQL, service-role client, middleware, layout, and all four core admin pages.[^1][^2][^3]

***

## Step 1 — Database Migration

```sql
-- ── Platform admin role on profiles ───────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'customer'; -- customer|merchant|platform_admin
  -- Grant admin: UPDATE profiles SET role = 'platform_admin' WHERE id = '<user_id>';

-- ── Extend merchants with admin fields ────────────────────────────────────
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS status          text    NOT NULL DEFAULT 'active',  -- pending|active|suspended|rejected
  ADD COLUMN IF NOT EXISTS commission_rate numeric NOT NULL DEFAULT 10,        -- %
  ADD COLUMN IF NOT EXISTS admin_notes     text,
  ADD COLUMN IF NOT EXISTS is_featured     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS features        jsonb   NOT NULL DEFAULT '{
    "analytics": true, "promotions": true, "max_products": 200,
    "verified_badge": false, "priority_support": false
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS approved_at     timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_at    timestamptz;

-- ── Admin audit log ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action      text NOT NULL,          -- approve_merchant|suspend_merchant|change_commission…
  target_type text,                   -- merchant|order|customer|payout
  target_id   uuid,
  before_data jsonb,
  after_data  jsonb,
  note        text,
  ip_address  text,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_admin     ON admin_audit_log(admin_id,    created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target    ON admin_audit_log(target_type, target_id);
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins only audit log"
  ON admin_audit_log FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'platform_admin');

-- ── Merchant payouts ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS merchant_payouts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id        uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  period_start       date NOT NULL,
  period_end         date NOT NULL,
  gross_sales        numeric NOT NULL DEFAULT 0,
  commission_rate    numeric NOT NULL DEFAULT 10,
  commission_amount  numeric NOT NULL DEFAULT 0,
  adjustments        numeric NOT NULL DEFAULT 0,   -- refunds, fees, credits
  net_payout         numeric NOT NULL DEFAULT 0,
  status             text    NOT NULL DEFAULT 'pending',  -- pending|processing|completed|failed
  payment_method     text    DEFAULT 'bank_transfer',
  payment_reference  text,
  processed_by       uuid REFERENCES auth.users(id),
  paid_at            timestamptz,
  notes              text,
  created_at         timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payouts_merchant ON merchant_payouts(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payouts_status   ON merchant_payouts(status);
ALTER TABLE merchant_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage all payouts"
  ON merchant_payouts FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'platform_admin');
CREATE POLICY "merchant reads own payouts"
  ON merchant_payouts FOR SELECT TO authenticated
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: admin_get_platform_overview
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_platform_overview(p_start date, p_end date)
RETURNS TABLE (
  total_gmv          numeric,
  platform_commission numeric,
  active_merchants   bigint,
  pending_merchants  bigint,
  suspended_merchants bigint,
  total_orders       bigint,
  total_customers    bigint,
  prev_gmv           numeric,
  prev_orders        bigint
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH cur AS (
    SELECT COALESCE(SUM(total_amount),0) AS gmv, COUNT(*) AS orders
    FROM orders WHERE status NOT IN ('pending','cancelled')
    AND created_at::date BETWEEN p_start AND p_end
  ),
  prev AS (
    SELECT COALESCE(SUM(total_amount),0) AS gmv, COUNT(*) AS orders
    FROM orders WHERE status NOT IN ('pending','cancelled')
    AND created_at::date BETWEEN (p_start - (p_end - p_start + 1)) AND p_start - 1
  )
  SELECT
    cur.gmv,
    ROUND(cur.gmv * (SELECT AVG(commission_rate) FROM merchants WHERE status = 'active') / 100, 2),
    (SELECT COUNT(*) FROM merchants WHERE status = 'active'),
    (SELECT COUNT(*) FROM merchants WHERE status = 'pending'),
    (SELECT COUNT(*) FROM merchants WHERE status = 'suspended'),
    cur.orders,
    (SELECT COUNT(DISTINCT customer_id) FROM orders WHERE created_at::date BETWEEN p_start AND p_end),
    prev.gmv,
    prev.orders
  FROM cur, prev;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: admin_get_daily_gmv
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_daily_gmv(p_start date, p_end date)
RETURNS TABLE (date text, gmv numeric, orders bigint, commission numeric)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    gs::date::text,
    COALESCE(SUM(o.total_amount), 0),
    COALESCE(COUNT(o.id), 0),
    COALESCE(SUM(o.total_amount * m.commission_rate / 100), 0)
  FROM generate_series(p_start, p_end, '1 day'::interval) gs
  LEFT JOIN orders o   ON o.created_at::date = gs::date AND o.status NOT IN ('pending','cancelled')
  LEFT JOIN merchants m ON m.id = o.merchant_id
  GROUP BY gs::date ORDER BY gs::date;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: admin_get_merchants_list
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_merchants_list(
  p_status    text    DEFAULT NULL,
  p_search    text    DEFAULT NULL,
  p_store_type text   DEFAULT NULL,
  p_limit     int     DEFAULT 50,
  p_offset    int     DEFAULT 0
)
RETURNS TABLE (
  merchant_id     uuid,
  store_name      text,
  store_type      text,
  store_slug      text,
  status          text,
  commission_rate numeric,
  is_featured     boolean,
  owner_name      text,
  owner_email     text,
  total_gmv       numeric,
  total_orders    bigint,
  total_products  bigint,
  commission_rate_pct numeric,
  registered_at   timestamptz,
  approved_at     timestamptz,
  logo_url        text
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    m.id,
    m.store_name,
    m.store_type,
    m.store_slug,
    m.status,
    m.commission_rate,
    m.is_featured,
    p.full_name,
    p.email,
    COALESCE((SELECT SUM(o.total_amount) FROM orders o WHERE o.merchant_id = m.id AND o.status NOT IN ('pending','cancelled')), 0),
    COALESCE((SELECT COUNT(*) FROM orders o WHERE o.merchant_id = m.id AND o.status NOT IN ('pending','cancelled')), 0),
    COALESCE((SELECT COUNT(*) FROM products pr WHERE pr.merchant_id = m.id AND pr.is_active), 0),
    m.commission_rate,
    m.created_at,
    m.approved_at,
    (m.appearance->>'logoUrl')::text
  FROM merchants m
  JOIN profiles p ON p.id = m.user_id
  WHERE (p_status    IS NULL OR m.status     = p_status)
    AND (p_store_type IS NULL OR m.store_type = p_store_type)
    AND (p_search     IS NULL OR
         m.store_name ILIKE '%' || p_search || '%' OR
         p.email      ILIKE '%' || p_search || '%' OR
         p.full_name  ILIKE '%' || p_search || '%')
  ORDER BY m.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: admin_get_merchant_detail
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_merchant_detail(p_merchant_id uuid)
RETURNS TABLE (
  merchant_id      uuid,
  store_name       text,
  store_type       text,
  store_slug       text,
  status           text,
  commission_rate  numeric,
  is_featured      boolean,
  features         jsonb,
  appearance       jsonb,
  store_config     jsonb,
  admin_notes      text,
  owner_id         uuid,
  owner_name       text,
  owner_email      text,
  owner_phone      text,
  registered_at    timestamptz,
  approved_at      timestamptz,
  total_gmv        numeric,
  total_orders     bigint,
  total_customers  bigint,
  total_products   bigint,
  last_order_at    timestamptz,
  avg_order_value  numeric,
  total_commission numeric
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    m.id, m.store_name, m.store_type, m.store_slug, m.status,
    m.commission_rate, m.is_featured, m.features, m.appearance,
    m.store_config, m.admin_notes,
    p.id, p.full_name, p.email, p.phone,
    m.created_at, m.approved_at,
    COALESCE(SUM(o.total_amount) FILTER (WHERE o.status NOT IN ('pending','cancelled')), 0),
    COUNT(o.id) FILTER (WHERE o.status NOT IN ('pending','cancelled')),
    COUNT(DISTINCT o.customer_id) FILTER (WHERE o.status NOT IN ('pending','cancelled')),
    (SELECT COUNT(*) FROM products pr WHERE pr.merchant_id = m.id AND pr.is_active),
    MAX(o.created_at),
    ROUND(AVG(o.total_amount) FILTER (WHERE o.status NOT IN ('pending','cancelled')), 2),
    ROUND(COALESCE(SUM(o.total_amount) FILTER (WHERE o.status NOT IN ('pending','cancelled')), 0)
          * m.commission_rate / 100, 2)
  FROM merchants m
  JOIN profiles p ON p.id = m.user_id
  LEFT JOIN orders o ON o.merchant_id = m.id
  WHERE m.id = p_merchant_id
  GROUP BY m.id, p.id;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: admin_get_payout_calculations
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_payout_calculations(p_start date, p_end date)
RETURNS TABLE (
  merchant_id      uuid,
  store_name       text,
  owner_email      text,
  commission_rate  numeric,
  gross_sales      numeric,
  commission_amt   numeric,
  refunds_issued   numeric,
  net_payout       numeric,
  order_count      bigint,
  existing_payout  uuid
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    m.id,
    m.store_name,
    p.email,
    m.commission_rate,
    COALESCE(SUM(o.total_amount) FILTER (WHERE o.status NOT IN ('pending','cancelled')), 0) AS gross_sales,
    ROUND(COALESCE(SUM(o.total_amount) FILTER (WHERE o.status NOT IN ('pending','cancelled')), 0)
          * m.commission_rate / 100, 2) AS commission_amt,
    COALESCE(SUM(o.refunded_amount), 0) AS refunds_issued,
    ROUND(
      COALESCE(SUM(o.total_amount) FILTER (WHERE o.status NOT IN ('pending','cancelled')), 0)
      - ROUND(COALESCE(SUM(o.total_amount) FILTER (WHERE o.status NOT IN ('pending','cancelled')), 0) * m.commission_rate / 100, 2)
      - COALESCE(SUM(o.refunded_amount), 0),
    2) AS net_payout,
    COUNT(o.id) FILTER (WHERE o.status NOT IN ('pending','cancelled')) AS order_count,
    (SELECT id FROM merchant_payouts mp
     WHERE mp.merchant_id = m.id
       AND mp.period_start = p_start AND mp.period_end = p_end
     LIMIT 1) AS existing_payout
  FROM merchants m
  JOIN profiles p ON p.id = m.user_id
  LEFT JOIN orders o ON o.merchant_id = m.id
    AND o.created_at::date BETWEEN p_start AND p_end
  WHERE m.status = 'active'
  GROUP BY m.id, p.email
  ORDER BY gross_sales DESC;
$$;
```


***

## Step 2 — `src/lib/supabase/admin.ts`

```typescript
// Server-only — never import this in client components
import { createClient } from '@supabase/supabase-js'

// Service role bypasses ALL RLS — never expose to client [web:343]
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
```


***

## Step 3 — `src/lib/admin.server.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin }  from '@/lib/supabase/admin'
import { redirect }       from 'next/navigation'
import { cookies }        from 'next/headers'

export async function getAdminSession() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email, avatar_url')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'platform_admin') redirect('/')

  return { user, profile, supabase, supabaseAdmin }
}

// ── Impersonation helpers ──────────────────────────────────────────────────

export const IMPERSONATE_COOKIE = 'admin_impersonate'

export async function getImpersonatedMerchantId(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(IMPERSONATE_COOKIE)?.value ?? null
}

// ── Audit logger ──────────────────────────────────────────────────────────

export async function auditLog({
  adminId, action, targetType, targetId, before, after, note,
}: {
  adminId: string; action: string; targetType?: string
  targetId?: string; before?: any; after?: any; note?: string
}) {
  await supabaseAdmin.from('admin_audit_log').insert({
    admin_id: adminId, action, target_type: targetType,
    target_id: targetId, before_data: before, after_data: after, note,
  })
}
```


***

## Step 4 — Middleware

```typescript
// src/middleware.ts  — add admin + impersonation blocks
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })
  const { pathname } = request.nextUrl

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) } }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // ── Admin route guard ────────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!user) return NextResponse.redirect(new URL('/login', request.url))
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'platform_admin')
      return NextResponse.redirect(new URL('/', request.url))
  }

  // ── Clear impersonation on admin logout ──────────────────────────────────
  if (pathname === '/admin' && !user) {
    response.cookies.delete('admin_impersonate')
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/(dashboard)/:path*'],
}
```


***

## Step 5 — `src/app/admin/layout.tsx`

```typescript
import Link          from 'next/link'
import { redirect }  from 'next/navigation'
import { getAdminSession } from '@/lib/admin.server'
import { cookies }   from 'next/headers'
import { IMPERSONATE_COOKIE } from '@/lib/admin.server'
import {
  LayoutDashboard, Store, ShoppingBag, Users,
  Wallet, Settings2, LogOut, Shield,
} from 'lucide-react'

const NAV = [
  { href: '/admin',           icon: LayoutDashboard, label: 'Overview'    },
  { href: '/admin/merchants', icon: Store,           label: 'Merchants'   },
  { href: '/admin/orders',    icon: ShoppingBag,     label: 'All Orders'  },
  { href: '/admin/customers', icon: Users,           label: 'Customers'   },
  { href: '/admin/payouts',   icon: Wallet,          label: 'Payouts'     },
  { href: '/admin/settings',  icon: Settings2,       label: 'Platform'    },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getAdminSession()
  const jar = await cookies()
  const impersonating = jar.get(IMPERSONATE_COOKIE)?.value

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">

      {/* ── Dark sidebar ──────────────────────────────────────────────── */}
      <aside className="w-56 shrink-0 flex flex-col bg-gray-900 border-r border-gray-800">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-800">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Shield size={14} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">Admin Panel</p>
            <p className="text-gray-500 text-xs mt-0.5">Platform Control</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors group">
              <Icon size={15} className="group-hover:text-blue-400 transition-colors" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Admin user */}
        <div className="px-3 py-4 border-t border-gray-800">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
              {profile.full_name?.charAt(0)?.toUpperCase() ?? 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-xs font-semibold truncate">{profile.full_name}</p>
              <p className="text-gray-500 text-xs truncate">{profile.email}</p>
            </div>
          </div>
          <form action="/api/admin/signout" method="POST">
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors mt-1">
              <LogOut size={13} /> Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Impersonation banner */}
        {impersonating && (
          <div className="bg-amber-500 px-5 py-2.5 flex items-center justify-between shrink-0">
            <p className="text-amber-900 text-sm font-semibold">
              👁 Admin Mode — viewing as merchant ({impersonating.slice(0,8)}…)
            </p>
            <form action="/api/admin/stop-impersonate" method="POST">
              <button className="text-xs bg-amber-900 text-amber-100 px-3 py-1 rounded-lg font-bold">
                Stop Impersonating
              </button>
            </form>
          </div>
        )}

        {/* Page area */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```


***

## Step 6 — `src/app/admin/page.tsx` + `AdminDashboard.tsx`

```typescript
// src/app/admin/page.tsx
import { getAdminSession } from '@/lib/admin.server'
import { AdminDashboard }  from '@/components/admin/AdminDashboard'
import { subDays, format } from 'date-fns'

export default async function AdminPage() {
  const { supabaseAdmin } = await getAdminSession()
  const end   = new Date()
  const start = subDays(end, 29)
  const fmt   = (d: Date) => format(d, 'yyyy-MM-dd')

  const [
    { data: overview },
    { data: dailyGmv },
    { data: topMerchants },
    { data: recentApplications },
  ] = await Promise.all([
    supabaseAdmin.rpc('admin_get_platform_overview', { p_start: fmt(start), p_end: fmt(end) }),
    supabaseAdmin.rpc('admin_get_daily_gmv',          { p_start: fmt(start), p_end: fmt(end) }),
    supabaseAdmin.rpc('admin_get_merchants_list',      { p_status: 'active',  p_limit: 10    }),
    supabaseAdmin.rpc('admin_get_merchants_list',      { p_status: 'pending', p_limit: 5     }),
  ])

  return (
    <AdminDashboard
      overview={(overview        as any)?.[^0] ?? {}}
      dailyGmv={(dailyGmv        as any[])   ?? []}
      topMerchants={(topMerchants as any[])   ?? []}
      recentApplications={(recentApplications as any[]) ?? []}
    />
  )
}
```

```typescript
// src/components/admin/AdminDashboard.tsx
'use client'
import { format, parseISO } from 'date-fns'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Store, ShoppingBag, Users, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { STORE_TYPES } from '@/lib/store-types'

const rm = (v: number) => `RM ${Number(v ?? 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const n  = (v: any)    => Number(v ?? 0)

function pct(cur: number, prev: number) {
  if (!prev) return null
  return ((cur - prev) / prev) * 100
}

function KpiCard({ label, value, sub, change, icon, iconBg }: {
  label: string; value: string; sub?: string; change?: number | null
  icon: React.ReactNode; iconBg: string
}) {
  const up = (change ?? 0) >= 0
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          {change !== null && change !== undefined && (
            <span className={cn('flex items-center gap-0.5 text-xs font-semibold mt-1',
              up ? 'text-green-600' : 'text-red-500')}>
              {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {up ? '+' : ''}{change.toFixed(1)}% vs prev period
            </span>
          )}
        </div>
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', iconBg)}>
          {icon}
        </div>
      </div>
    </div>
  )
}

export function AdminDashboard({ overview, dailyGmv, topMerchants, recentApplications }: {
  overview: any; dailyGmv: any[]; topMerchants: any[]; recentApplications: any[]
}) {
  const chartData = dailyGmv.map(d => ({
    date:       format(parseISO(d.date), 'd MMM'),
    gmv:        Number(d.gmv),
    commission: Number(d.commission),
    orders:     Number(d.orders),
  }))

  const gmvChange    = pct(n(overview.total_gmv),    n(overview.prev_gmv))
  const ordersChange = pct(n(overview.total_orders), n(overview.prev_orders))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Platform Overview</h1>
        <p className="text-sm text-gray-400 mt-0.5">Last 30 days — all merchants combined</p>
      </div>

      {/* ── KPI row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard label="Gross GMV"           value={rm(overview.total_gmv)}
          change={gmvChange}    sub={`Commission: ${rm(overview.platform_commission)}`}
          icon={<DollarSign size={16} className="text-blue-600" />} iconBg="bg-blue-100" />
        <KpiCard label="Total Orders"        value={n(overview.total_orders).toLocaleString()}
          change={ordersChange}
          icon={<ShoppingBag size={16} className="text-purple-600" />} iconBg="bg-purple-100" />
        <KpiCard label="Active Merchants"    value={n(overview.active_merchants).toString()}
          sub={`${n(overview.pending_merchants)} pending approval`}
          icon={<Store size={16} className="text-green-600" />} iconBg="bg-green-100" />
        <KpiCard label="Total Customers"     value={n(overview.total_customers).toLocaleString()}
          icon={<Users size={16} className="text-amber-600" />} iconBg="bg-amber-100" />
      </div>

      {/* ── Suspended alert ─────────────────────────────────────────── */}
      {n(overview.pending_merchants) > 0 && (
        <Link href="/admin/merchants?status=pending"
          className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-5 py-3 text-sm font-semibold hover:bg-amber-100 transition-colors">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          {n(overview.pending_merchants)} merchant application{n(overview.pending_merchants) !== 1 ? 's' : ''} awaiting review →
        </Link>
      )}

      {/* ── GMV chart ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-4">Platform GMV & Commission</h3>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              earGradient id="gmvg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0}    />
              </linearGradient>
              earGradient id="comg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#059669" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false}
              interval={Math.ceil(chartData.length / 8)} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false}
              tickFormatter={v => `RM${(v/1000).toFixed(0)}k`} width={52} />
            <Tooltip formatter={(v: number, n: string) => [`RM ${v.toFixed(2)}`, n === 'gmv' ? 'GMV' : 'Commission']}
              contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }} />
            <Area type="monotone" dataKey="gmv"        stroke="#2563eb" strokeWidth={2} fill="url(#gmvg)" dot={false} name="gmv" />
            <Area type="monotone" dataKey="commission" stroke="#059669" strokeWidth={2} fill="url(#comg)" dot={false} name="commission" strokeDasharray="4 2" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* ── Top merchants ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Top Merchants by GMV</h3>
            <Link href="/admin/merchants" className="text-xs text-blue-600 font-semibold hover:underline">View all →</Link>
          </div>
          <div className="space-y-0">
            {topMerchants.slice(0, 8).map((m, i) => (
              <Link key={m.merchant_id} href={`/admin/merchants/${m.merchant_id}`}
                className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 rounded-xl px-1 transition-colors group">
                <span className="text-sm text-gray-400 font-bold w-5 shrink-0">#{i+1}</span>
                {m.logo_url
                  ? <img src={m.logo_url} className="w-8 h-8 rounded-xl object-cover shrink-0" alt="" />
                  : <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0"
                      style={{ backgroundColor: Object.values(STORE_TYPES)[Object.keys(STORE_TYPES).indexOf(m.store_type as any)]?.color + '22' ?? '#e5e7eb' }}>
                      {STORE_TYPES[m.store_type as keyof typeof STORE_TYPES]?.icon ?? '🛍️'}
                    </div>}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-blue-600">{m.store_name}</p>
                  <p className="text-xs text-gray-400">{m.total_orders} orders</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">{rm(m.total_gmv)}</p>
                  <p className="text-xs text-gray-400">{m.commission_rate}% comm.</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Pending applications ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Pending Applications</h3>
            <Link href="/admin/merchants?status=pending" className="text-xs text-blue-600 font-semibold hover:underline">View all →</Link>
          </div>
          {recentApplications.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-4xl mb-2">✅</p>
              <p className="text-gray-500 text-sm font-medium">All applications reviewed</p>
            </div>
          ) : (
            <div className="space-y-0">
              {recentApplications.map(m => (
                <div key={m.merchant_id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center text-sm shrink-0">
                      {STORE_TYPES[m.store_type as keyof typeof STORE_TYPES]?.icon ?? '🛍️'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{m.store_name}</p>
                      <p className="text-xs text-gray-400 truncate">{m.owner_email}</p>
                    </div>
                  </div>
                  <Link href={`/admin/merchants/${m.merchant_id}`}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg transition-colors shrink-0 ml-2">
                    Review
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```


***

## Step 7 — `src/app/admin/merchants/page.tsx` + `MerchantsClient.tsx`

```typescript
// src/app/admin/merchants/page.tsx
import { getAdminSession } from '@/lib/admin.server'
import { MerchantsClient } from '@/components/admin/MerchantsClient'

export default async function AdminMerchantsPage({
  searchParams,
}: { searchParams: Promise<{ status?: string; type?: string; q?: string }> }) {
  const { status, type, q } = await searchParams
  const { supabaseAdmin } = await getAdminSession()

  const { data: merchants } = await supabaseAdmin.rpc('admin_get_merchants_list', {
    p_status:     status || null,
    p_store_type: type   || null,
    p_search:     q      || null,
    p_limit:      100,
    p_offset:     0,
  })

  return <MerchantsClient merchants={(merchants as any[]) ?? []} filters={{ status, type, q }} />
}
```

```typescript
// src/components/admin/MerchantsClient.tsx
'use client'
import { useState }      from 'react'
import { useRouter }     from 'next/navigation'
import Link              from 'next/link'
import { createClient }  from '@/lib/supabase/client'
import { Button }        from '@/components/ui/button'
import { Input }         from '@/components/ui/input'
import { cn }            from '@/lib/utils'
import toast             from 'react-hot-toast'
import { STORE_TYPES }   from '@/lib/store-types'
import { Search, CheckCircle2, XCircle, PauseCircle, Eye, Star, Loader2, Download } from 'lucide-react'
import { format }        from 'date-fns'

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active:    { label: 'Active',    cls: 'bg-green-100 text-green-700'  },
  pending:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700'  },
  suspended: { label: 'Suspended', cls: 'bg-red-100   text-red-700'    },
  rejected:  { label: 'Rejected',  cls: 'bg-gray-100  text-gray-500'   },
}

const rm = (v: number) => `RM ${Number(v ?? 0).toLocaleString('en-MY', { minimumFractionDigits: 0 })}`
const n  = (v: any)    => Number(v ?? 0)

function exportCSV(rows: any[][], filename: string) {
  const csv  = rows.map(r => r.map(c => `"${String(c??'').replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename })
  a.click()
}

export function MerchantsClient({ merchants, filters }: {
  merchants: any[]; filters: { status?: string; type?: string; q?: string }
}) {
  const router   = useRouter()
  const supabase = createClient()

  const [loading, setLoading]   = useState<string | null>(null)
  const [search,  setSearch]    = useState(filters.q ?? '')
  const [selType, setSelType]   = useState(filters.type ?? '')
  const [selStatus, setSelStatus] = useState(filters.status ?? '')

  const applyFilters = () => {
    const p = new URLSearchParams()
    if (search)    p.set('q',      search)
    if (selStatus) p.set('status', selStatus)
    if (selType)   p.set('type',   selType)
    router.push(`/admin/merchants?${p.toString()}`)
  }

  const handleAction = async (merchantId: string, action: 'approve' | 'suspend' | 'reject' | 'activate') => {
    const STATUS_MAP = { approve: 'active', suspend: 'suspended', reject: 'rejected', activate: 'active' }
    const newStatus = STATUS_MAP[action]
    setLoading(merchantId)

    const updates: any = { status: newStatus }
    if (action === 'approve') updates.approved_at = new Date().toISOString()
    if (action === 'suspend') updates.suspended_at = new Date().toISOString()

    const res = await fetch('/api/admin/merchant-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId, action, updates }),
    })

    if (res.ok) {
      toast.success(`Merchant ${action}d`)
      router.refresh()
    } else {
      toast.error('Action failed')
    }
    setLoading(null)
  }

  const handleImpersonate = async (merchantId: string) => {
    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId }),
    })
    if (res.ok) {
      toast.success('Now viewing as merchant')
      router.push('/')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Merchants</h1>
          <p className="text-sm text-gray-400 mt-0.5">{merchants.length} results</p>
        </div>
        <Button variant="outline" size="sm" onClick={() =>
          exportCSV([
            ['Store Name','Type','Status','Owner','Email','GMV','Orders','Commission','Registered'],
            ...merchants.map(m => [m.store_name, m.store_type, m.status, m.owner_name,
              m.owner_email, rm(m.total_gmv), m.total_orders, `${m.commission_rate}%`,
              format(new Date(m.registered_at), 'd MMM yyyy')])],
            `merchants-${new Date().toISOString().slice(0,10)}.csv`)}>
          <Download size={13} className="mr-1" /> Export
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search store, owner, email…" value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyFilters()}
            className="pl-8 h-9" />
        </div>
        <select value={selStatus} onChange={e => setSelStatus(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
          <option value="">All Statuses</option>
          {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
        </select>
        <select value={selType} onChange={e => setSelType(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
          <option value="">All Types</option>
          {Object.entries(STORE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        <Button size="sm" onClick={applyFilters}>Apply</Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {['Merchant','Type','Status','Owner','GMV','Orders','Commission','Registered','Actions'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-400 px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {merchants.map(m => {
                const stMeta = STATUS_META[m.status]  ?? STATUS_META.active
                const stType = STORE_TYPES[m.store_type as keyof typeof STORE_TYPES]
                return (
                  <tr key={m.merchant_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {m.logo_url
                          ? <img src={m.logo_url} className="w-9 h-9 rounded-xl object-cover shrink-0" alt="" />
                          : <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 bg-gray-100">
                              {stType?.icon ?? '🛍️'}
                            </div>}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="font-semibold text-gray-800 truncate max-w-[120px]">{m.store_name}</p>
                            {m.is_featured && <Star size={11} className="text-amber-400 fill-amber-400 shrink-0" />}
                          </div>
                          <p className="text-xs text-gray-400 font-mono">{m.store_slug ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">{stType?.icon} {stType?.label ?? m.store_type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-bold px-2.5 py-0.5 rounded-full', stMeta.cls)}>
                        {stMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-700 truncate max-w-[120px]">{m.owner_name}</p>
                      <p className="text-xs text-gray-400 truncate max-w-[120px]">{m.owner_email}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">{rm(m.total_gmv)}</td>
                    <td className="px-4 py-3 text-gray-600">{n(m.total_orders)}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-blue-600">{m.commission_rate}%</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {format(new Date(m.registered_at), 'd MMM yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* View detail */}
                        <Link href={`/admin/merchants/${m.merchant_id}`}
                          className="w-7 h-7 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center transition-colors">
                          <Eye size={13} />
                        </Link>

                        {/* Approve (pending) */}
                        {m.status === 'pending' && (
                          <button onClick={() => handleAction(m.merchant_id, 'approve')}
                            disabled={loading === m.merchant_id}
                            className="w-7 h-7 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg flex items-center justify-center transition-colors">
                            {loading === m.merchant_id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={13} />}
                          </button>
                        )}

                        {/* Reject (pending) */}
                        {m.status === 'pending' && (
                          <button onClick={() => handleAction(m.merchant_id, 'reject')}
                            disabled={loading === m.merchant_id}
                            className="w-7 h-7 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg flex items-center justify-center transition-colors">
                            <XCircle size={13} />
                          </button>
                        )}

                        {/* Suspend / Activate */}
                        {m.status === 'active' && (
                          <button onClick={() => handleAction(m.merchant_id, 'suspend')}
                            disabled={loading === m.merchant_id}
                            title="Suspend"
                            className="w-7 h-7 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center transition-colors">
                            <PauseCircle size={13} />
                          </button>
                        )}
                        {m.status === 'suspended' && (
                          <button onClick={() => handleAction(m.merchant_id, 'activate')}
                            disabled={loading === m.merchant_id}
                            title="Reactivate"
                            className="w-7 h-7 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg flex items-center justify-center transition-colors">
                            <CheckCircle2 size={13} />
                          </button>
                        )}

                        {/* Impersonate */}
                        {m.status === 'active' && (
                          <button onClick={() => handleImpersonate(m.merchant_id)}
                            title="View as merchant"
                            className="w-7 h-7 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center transition-colors text-xs font-bold">
                            👁
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```


***

## Step 8 — `src/app/admin/merchants/[id]/page.tsx` + `MerchantDetailClient.tsx`

```typescript
// src/app/admin/merchants/[id]/page.tsx
import { getAdminSession } from '@/lib/admin.server'
import { MerchantDetailClient } from '@/components/admin/MerchantDetailClient'
import { notFound } from 'next/navigation'

export default async function MerchantDetailPage({ params }: { params: { id: string } }) {
  const { user, supabaseAdmin } = await getAdminSession()

  const [{ data: detail }, { data: recentOrders }, { data: payouts }, { data: auditLog }] = await Promise.all([
    supabaseAdmin.rpc('admin_get_merchant_detail', { p_merchant_id: params.id }),
    supabaseAdmin.from('orders')
      .select('id, order_number, total_amount, status, created_at, customer:customer_id(full_name)')
      .eq('merchant_id', params.id)
      .order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('merchant_payouts')
      .select('*').eq('merchant_id', params.id).order('created_at', { ascending: false }).limit(10),
    supabaseAdmin.from('admin_audit_log')
      .select('*, admin:admin_id(full_name)')
      .eq('target_id', params.id)
      .order('created_at', { ascending: false }).limit(20),
  ])

  const merchant = (detail as any[])?.[^0]
  if (!merchant) notFound()

  return (
    <MerchantDetailClient
      merchant={merchant}
      recentOrders={(recentOrders as any[]) ?? []}
      payouts={(payouts       as any[]) ?? []}
      auditLog={(auditLog     as any[]) ?? []}
      adminId={user.id}
    />
  )
}
```

```typescript
// src/components/admin/MerchantDetailClient.tsx
'use client'
import { useState }     from 'react'
import { useRouter }    from 'next/navigation'
import Link             from 'next/link'
import { Button }       from '@/components/ui/button'
import { Input }        from '@/components/ui/input'
import { cn }           from '@/lib/utils'
import toast            from 'react-hot-toast'
import { STORE_TYPES }  from '@/lib/store-types'
import { format }       from 'date-fns'
import {
  CheckCircle2, XCircle, PauseCircle, Eye, Star, StarOff,
  Save, Loader2, ArrowLeft, Package, Users, ShoppingBag, DollarSign,
} from 'lucide-react'

const rm = (v: number) => `RM ${Number(v ?? 0).toFixed(2)}`
const n  = (v: any)    => Number(v ?? 0)

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active:    { label: 'Active',    cls: 'bg-green-100 text-green-700'  },
  pending:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700'  },
  suspended: { label: 'Suspended', cls: 'bg-red-100   text-red-700'    },
  rejected:  { label: 'Rejected',  cls: 'bg-gray-100  text-gray-500'   },
}

const ORDER_STATUS_CLS: Record<string, string> = {
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  pending:   'bg-gray-100 text-gray-600',
}

export function MerchantDetailClient({ merchant, recentOrders, payouts, auditLog, adminId }: {
  merchant: any; recentOrders: any[]; payouts: any[]; auditLog: any[]; adminId: string
}) {
  const router = useRouter()
  const [tab,     setTab]    = useState<'overview'|'orders'|'payouts'|'settings'|'audit'>('overview')
  const [saving,  setSaving] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  // Editable fields
  const [commRate,  setCommRate]  = useState(String(merchant.commission_rate))
  const [notes,     setNotes]     = useState(merchant.admin_notes ?? '')
  const [isFeatured, setIsFeatured] = useState(merchant.is_featured)
  const [features,  setFeatures]  = useState({ ...merchant.features })

  const stType  = STORE_TYPES[merchant.store_type as keyof typeof STORE_TYPES]
  const stMeta  = STATUS_META[merchant.status] ?? STATUS_META.active

  const handleAction = async (action: 'approve'|'suspend'|'reject'|'activate') => {
    setLoading(action)
    const res = await fetch('/api/admin/merchant-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId: merchant.merchant_id, action }),
    })
    if (res.ok) { toast.success(`Merchant ${action}d`); router.refresh() }
    else toast.error('Action failed')
    setLoading(null)
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    const res = await fetch('/api/admin/merchant-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantId:      merchant.merchant_id,
        commission_rate: Number(commRate),
        admin_notes:     notes,
        is_featured:     isFeatured,
        features,
      }),
    })
    if (res.ok) { toast.success('Settings saved'); router.refresh() }
    else toast.error('Save failed')
    setSaving(false)
  }

  const handleImpersonate = async () => {
    const res = await fetch('/api/admin/impersonate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId: merchant.merchant_id }),
    })
    if (res.ok) { toast.success('Now viewing as merchant'); router.push('/') }
  }

  return (
    <div className="space-y-5">

      {/* ── Breadcrumb + header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/merchants" className="text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-3">
            {merchant.appearance?.logoUrl
              ? <img src={merchant.appearance.logoUrl} className="w-12 h-12 rounded-2xl object-cover" alt="" />
              : <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-2xl">
                  {stType?.icon ?? '🛍️'}
                </div>}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">{merchant.store_name}</h1>
                {isFeatured && <Star size={15} className="text-amber-400 fill-amber-400" />}
                <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', stMeta.cls)}>
                  {stMeta.label}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                {stType?.label} · {merchant.owner_name} · {merchant.owner_email}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {merchant.status === 'pending' && <>
            <Button size="sm" onClick={() => handleAction('approve')} disabled={!!loading}
              className="bg-green-600 hover:bg-green-700 flex items-center gap-1.5">
              {loading === 'approve' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={13} />}
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleAction('reject')} disabled={!!loading}
              className="text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-1.5">
              <XCircle size={13} /> Reject
            </Button>
          </>}
          {merchant.status === 'active' && (
            <Button size="sm" variant="outline" onClick={() => handleAction('suspend')} disabled={!!loading}
              className="text-amber-600 border-amber-200 hover:bg-amber-50">
              {loading === 'suspend' ? <Loader2 size={12} className="animate-spin" /> : <PauseCircle size={13} />}
              <span className="ml-1">Suspend</span>
            </Button>
          )}
          {merchant.status === 'suspended' && (
            <Button size="sm" onClick={() => handleAction('activate')} disabled={!!loading}
              className="bg-green-600 hover:bg-green-700">
              Reactivate
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleImpersonate}
            className="text-purple-600 border-purple-200 hover:bg-purple-50 flex items-center gap-1.5">
            👁 View as Merchant
          </Button>
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label:'Total GMV',      value:rm(merchant.total_gmv),      icon:<DollarSign size={15} className="text-blue-600" />,   bg:'bg-blue-100'  },
          { label:'Total Orders',   value:String(n(merchant.total_orders)),  icon:<ShoppingBag size={15} className="text-purple-600" />, bg:'bg-purple-100'},
          { label:'Customers',      value:String(n(merchant.total_customers)),icon:<Users size={15} className="text-green-600" />,    bg:'bg-green-100' },
          { label:'Active Products',value:String(n(merchant.total_products)), icon:<Package size={15} className="text-amber-600" />,   bg:'bg-amber-100' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-400">{c.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{c.value}</p>
              </div>
              <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', c.bg)}>{c.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit flex-wrap">
        {['overview','orders','payouts','settings','audit'].map(t => (
          <button key={t} onClick={() => setTab(t as any)}
            className={cn('px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors',
              tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
            {t}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <h3 className="font-bold text-gray-900">Store Information</h3>
            {[
              ['Store Type',    `${stType?.icon} ${stType?.label}`],
              ['URL Slug',      merchant.store_slug ?? '—'],
              ['Commission',    `${merchant.commission_rate}%`],
              ['Registered',    format(new Date(merchant.registered_at), 'd MMM yyyy')],
              ['Approved',      merchant.approved_at ? format(new Date(merchant.approved_at), 'd MMM yyyy') : '—'],
              ['Avg Order',     rm(merchant.avg_order_value)],
              ['Commission Earned', rm(merchant.total_commission)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-500">{k}</span>
                <span className="text-sm font-semibold text-gray-900">{v}</span>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <h3 className="font-bold text-gray-900">Owner Details</h3>
            {[
              ['Name',   merchant.owner_name  ?? '—'],
              ['Email',  merchant.owner_email ?? '—'],
              ['Phone',  merchant.owner_phone ?? '—'],
              ['User ID', merchant.owner_id?.slice(0,12) + '…'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-500">{k}</span>
                <span className="text-sm font-semibold text-gray-900 font-mono">{v}</span>
              </div>
            ))}
            {merchant.admin_notes && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs font-bold text-amber-700 mb-1">Admin Notes</p>
                <p className="text-sm text-amber-800">{merchant.admin_notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ORDERS ───────────────────────────────────────────────────── */}
      {tab === 'orders' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-4">Recent Orders</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-50">
                {['Order','Customer','Total','Status','Date'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-400 pb-2 pr-4">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {recentOrders.map(o => (
                  <tr key={o.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="py-2.5 pr-4">
                      <span className="font-mono text-xs font-bold bg-gray-100 px-2 py-0.5 rounded-lg">{o.order_number}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600">{o.customer?.full_name ?? 'Guest'}</td>
                    <td className="py-2.5 pr-4 font-bold text-gray-900">{rm(o.total_amount)}</td>
                    <td className="py-2.5 pr-4">
                      <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full capitalize',
                        ORDER_STATUS_CLS[o.status] ?? 'bg-blue-100 text-blue-700')}>
                        {o.status.replace(/_/g,' ')}
                      </span>
                    </td>
                    <td className="py-2.5 text-xs text-gray-400">{format(new Date(o.created_at),'d MMM yyyy')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PAYOUTS ──────────────────────────────────────────────────── */}
      {tab === 'payouts' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-4">Payout History</h3>
          {payouts.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No payouts processed yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-50">
                  {['Period','Gross Sales','Commission','Net Payout','Status','Paid At'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-400 pb-2 pr-4">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {payouts.map(p => (
                    <tr key={p.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 pr-4 text-xs text-gray-600 whitespace-nowrap">{p.period_start} → {p.period_end}</td>
                      <td className="py-2.5 pr-4 font-semibold text-gray-900">{rm(p.gross_sales)}</td>
                      <td className="py-2.5 pr-4 text-red-600">−{rm(p.commission_amount)}</td>
                      <td className="py-2.5 pr-4 font-bold text-green-700">{rm(p.net_payout)}</td>
                      <td className="py-2.5 pr-4">
                        <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full',
                          p.status === 'completed' ? 'bg-green-100 text-green-700' :
                          p.status === 'failed'    ? 'bg-red-100   text-red-700'   : 'bg-amber-100 text-amber-700')}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-xs text-gray-400">{p.paid_at ? format(new Date(p.paid_at),'d MMM yyyy') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SETTINGS ─────────────────────────────────────────────────── */}
      {tab === 'settings' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h3 className="font-bold text-gray-900">Admin Controls</h3>

            <div>
              abel className="text-sm font-medium text-gray-700 block mb-1">Commission Rate (%)</label>
              <Input type="number" min="0" max="100" step="0.5" value={commRate}
                onChange={e => setCommRate(e.target.value)} />
            </div>

            <div>
              abel className="text-sm font-medium text-gray-700 block mb-1">Featured Store</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setIsFeatured((v: boolean) => !v)}
                  className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all',
                    isFeatured ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-100 text-gray-500')}>
                  {isFeatured ? <Star size={14} className="text-amber-500 fill-amber-500" /> : <StarOff size={14} />}
                  {isFeatured ? 'Featured' : 'Not Featured'}
                </button>
              </div>
            </div>

            <div>
              abel className="text-sm font-medium text-gray-700 block mb-1">Admin Notes (internal)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                placeholder="Internal notes about this merchant..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-y focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>

            <Button onClick={handleSaveSettings} disabled={saving} className="flex items-center gap-2">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save Changes
            </Button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <h3 className="font-bold text-gray-900">Feature Flags</h3>
            {[
              { key:'analytics',        label:'Analytics & Reports'      },
              { key:'promotions',       label:'Coupons & Promotions'     },
              { key:'verified_badge',   label:'Verified Badge'           },
              { key:'priority_support', label:'Priority Support'         },
            ].map(f => (
              <div key={f.key} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-700">{f.label}</span>
                <button onClick={() => setFeatures((p: any) => ({ ...p, [f.key]: !p[f.key] }))}
                  className={cn('w-10 h-5 rounded-full transition-colors', features[f.key] ? 'bg-blue-600' : 'bg-gray-200')}>
                  <div className={cn('w-4 h-4 rounded-full bg-white shadow mx-0.5 transition-transform',
                    features[f.key] ? 'translate-x-5' : 'translate-x-0')} />
                </button>
              </div>
            ))}
            <div className="pt-2">
              abel className="text-sm font-medium text-gray-700 block mb-1">Max Products</label>
              <Input type="number" value={features.max_products ?? 200}
                onChange={e => setFeatures((p: any) => ({ ...p, max_products: Number(e.target.value) }))} />
            </div>
          </div>
        </div>
      )}

      {/* ── AUDIT ────────────────────────────────────────────────────── */}
      {tab === 'audit' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-4">Admin Audit Log</h3>
          {auditLog.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No admin actions recorded for this merchant</p>
          ) : (
            <div className="space-y-0">
              {auditLog.map(log => (
                <div key={log.id} className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
                  <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-500 shrink-0 mt-0.5">
                    {(log.admin?.full_name ?? 'A').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">{log.admin?.full_name ?? 'Admin'}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 font-mono px-2 py-0.5 rounded-lg">
                        {log.action}
                      </span>
                    </div>
                    {log.note && <p className="text-xs text-gray-500 mt-0.5">{log.note}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{format(new Date(log.created_at), 'd MMM yyyy, h:mm a')}</p>
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

## Step 9 — API Routes

```typescript
// src/app/api/admin/merchant-action/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin }  from '@/lib/supabase/admin'
import { getAdminSession, auditLog } from '@/lib/admin.server'

export async function POST(req: NextRequest) {
  const { user } = await getAdminSession()
  const { merchantId, action } = await req.json()
  const STATUS = { approve:'active', suspend:'suspended', reject:'rejected', activate:'active' } as const

  const updates: any = { status: STATUS[action as keyof typeof STATUS] }
  if (action === 'approve') updates.approved_at = new Date().toISOString()
  if (action === 'suspend') updates.suspended_at = new Date().toISOString()

  const { error } = await supabaseAdmin.from('merchants').update(updates).eq('id', merchantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await auditLog({ adminId: user.id, action: `${action}_merchant`, targetType: 'merchant', targetId: merchantId })
  return NextResponse.json({ ok: true })
}

// src/app/api/admin/merchant-settings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin }  from '@/lib/supabase/admin'
import { getAdminSession, auditLog } from '@/lib/admin.server'

export async function PATCH(req: NextRequest) {
  const { user } = await getAdminSession()
  const { merchantId, commission_rate, admin_notes, is_featured, features } = await req.json()

  const { error } = await supabaseAdmin.from('merchants')
    .update({ commission_rate, admin_notes, is_featured, features })
    .eq('id', merchantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await auditLog({
    adminId: user.id, action: 'update_merchant_settings',
    targetType: 'merchant', targetId: merchantId,
    after: { commission_rate, is_featured },
  })
  return NextResponse.json({ ok: true })
}

// src/app/api/admin/impersonate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, auditLog, IMPERSONATE_COOKIE } from '@/lib/admin.server'

export async function POST(req: NextRequest) {
  const { user } = await getAdminSession()
  const { merchantId } = await req.json()
  await auditLog({ adminId: user.id, action: 'merchant_impersonated', targetType: 'merchant', targetId: merchantId })

  const res = NextResponse.json({ ok: true })
  res.cookies.set(IMPERSONATE_COOKIE, merchantId, {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60, // 1 hour
    path: '/',
  })
  return res
}

// src/app/api/admin/stop-impersonate/route.ts
import { NextResponse } from 'next/server'
import { IMPERSONATE_COOKIE } from '@/lib/admin.server'

export async function POST() {
  const res = NextResponse.redirect(new URL('/admin', process.env.NEXT_PUBLIC_APP_URL!))
  res.cookies.delete(IMPERSONATE_COOKIE)
  return res
}
```


***

## Step 10 — `src/app/admin/payouts/page.tsx` + `PayoutsClient.tsx`

```typescript
// src/app/admin/payouts/page.tsx
import { getAdminSession } from '@/lib/admin.server'
import { PayoutsClient }   from '@/components/admin/PayoutsClient'
import { subDays, format, startOfMonth, endOfMonth } from 'date-fns'

export default async function PayoutsPage({
  searchParams,
}: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { from, to } = await searchParams
  const { supabaseAdmin } = await getAdminSession()

  const end   = to   ? new Date(to)   : endOfMonth(new Date())
  const start = from ? new Date(from) : startOfMonth(new Date())
  const fmt   = (d: Date) => format(d, 'yyyy-MM-dd')

  const [{ data: calculations }, { data: history }] = await Promise.all([
    supabaseAdmin.rpc('admin_get_payout_calculations', { p_start: fmt(start), p_end: fmt(end) }),
    supabaseAdmin.from('merchant_payouts')
      .select('*, merchant:merchant_id(store_name, appearance)')
      .order('created_at', { ascending: false }).limit(50),
  ])

  return (
    <PayoutsClient
      calculations={(calculations as any[]) ?? []}
      history={(history           as any[]) ?? []}
      period={{ from: fmt(start), to: fmt(end) }}
    />
  )
}
```

```typescript
// src/components/admin/PayoutsClient.tsx
'use client'
import { useState }    from 'react'
import { useRouter }   from 'next/navigation'
import { Input }       from '@/components/ui/input'
import { Button }      from '@/components/ui/button'
import { cn }          from '@/lib/utils'
import toast           from 'react-hot-toast'
import { format }      from 'date-fns'
import { Download, CheckCircle2, Loader2, Wallet } from 'lucide-react'

const rm = (v: number) => `RM ${Number(v ?? 0).toFixed(2)}`
const n  = (v: any)    => Number(v ?? 0)

function exportCSV(rows: any[][], filename: string) {
  const csv  = rows.map(r => r.map(c => `"${String(c??'').replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename }).click()
}

export function PayoutsClient({ calculations, history, period }: {
  calculations: any[]; history: any[]; period: { from: string; to: string }
}) {
  const router  = useRouter()
  const [tab,     setTab]     = useState<'calculate'|'history'>('calculate')
  const [from,    setFrom]    = useState(period.from)
  const [to,      setTo]      = useState(period.to)
  const [loading, setLoading] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const totalGross      = calculations.reduce((s, c) => s + n(c.gross_sales),    0)
  const totalCommission = calculations.reduce((s, c) => s + n(c.commission_amt), 0)
  const totalPayout     = calculations.reduce((s, c) => s + n(c.net_payout),     0)

  const toggleSelect = (id: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const processPayouts = async (merchantIds: string[]) => {
    setLoading('batch')
    const res = await fetch('/api/admin/process-payouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantIds, periodStart: from, periodEnd: to,
        calculations: calculations.filter(c => merchantIds.includes(c.merchant_id)) }),
    })
    if (res.ok) { toast.success(`${merchantIds.length} payouts queued`); setSelected(new Set()); router.refresh() }
    else toast.error('Payout processing failed')
    setLoading(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Commission & Payouts</h1>
          <p className="text-sm text-gray-400">Calculate and process merchant payouts</p>
        </div>
      </div>

      {/* Period selector */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-gray-700">Payout Period:</span>
        <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36 h-8 text-xs" />
        <span className="text-gray-400">→</span>
        <Input type="date" value={to}   onChange={e => setTo(e.target.value)}   className="w-36 h-8 text-xs" />
        <Button size="sm" variant="outline" onClick={() => router.push(`/admin/payouts?from=${from}&to=${to}`)}>
          Recalculate
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit">
        {[
          { key:'calculate', label:'💰 Calculate Payouts' },
          { key:'history',   label:'📋 Payout History'    },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={cn('px-4 py-2 rounded-xl text-sm font-medium',
              tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'calculate' && (
        <div className="space-y-4">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <p className="text-xs text-gray-400">Total Gross Sales</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{rm(totalGross)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <p className="text-xs text-gray-400">Platform Commission</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{rm(totalCommission)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <p className="text-xs text-gray-400">Total to Pay Merchants</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{rm(totalPayout)}</p>
            </div>
          </div>

          {/* Batch actions */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-gray-900">Merchant Payouts</h3>
                {selected.size > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                    {selected.size} selected
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() =>
                  exportCSV([
                    ['Merchant','Email','Commission Rate','Gross Sales','Commission','Net Payout','Orders'],
                    ...calculations.map(c => [c.store_name, c.owner_email, `${c.commission_rate}%`,
                      rm(c.gross_sales), rm(c.commission_amt), rm(c.net_payout), c.order_count])],
                    `payouts-${period.from}-${period.to}.csv`)}>
                  <Download size={13} className="mr-1" /> Export
                </Button>
                {selected.size > 0 && (
                  <Button size="sm" disabled={loading === 'batch'}
                    onClick={() => processPayouts(Array.from(selected))}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
                    {loading === 'batch' ? <Loader2 size={13} className="animate-spin" /> : <Wallet size={13} />}
                    Process {selected.size} Payout{selected.size !== 1 ? 's' : ''}
                  </Button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-50">
                  <th className="w-8 pb-2 pr-3">
                    <input type="checkbox"
                      checked={selected.size === calculations.length && calculations.length > 0}
                      onChange={e => setSelected(e.target.checked ? new Set(calculations.map(c => c.merchant_id)) : new Set())}
                      className="rounded" />
                  </th>
                  {['Merchant','Orders','Gross Sales','Commission','Net Payout','Status'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-400 pb-2 pr-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {calculations.map(c => (
                    <tr key={c.merchant_id} className={cn('border-b border-gray-50 last:border-0 hover:bg-gray-50/50',
                      selected.has(c.merchant_id) && 'bg-blue-50/50')}>
                      <td className="py-2.5 pr-3">
                        <input type="checkbox" checked={selected.has(c.merchant_id)}
                          onChange={() => toggleSelect(c.merchant_id)} className="rounded" />
                      </td>
                      <td className="py-2.5 pr-4">
                        <p className="font-semibold text-gray-800 truncate max-w-[140px]">{c.store_name}</p>
                        <p className="text-xs text-gray-400">{c.commission_rate}% commission</p>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600">{c.order_count}</td>
                      <td className="py-2.5 pr-4 font-semibold text-gray-900">{rm(c.gross_sales)}</td>
                      <td className="py-2.5 pr-4 text-red-600 font-semibold">−{rm(c.commission_amt)}</td>
                      <td className="py-2.5 pr-4 font-bold text-green-700">{rm(c.net_payout)}</td>
                      <td className="py-2.5">
                        {c.existing_payout ? (
                          <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">
                            ✓ Processed
                          </span>
                        ) : n(c.gross_sales) === 0 ? (
                          <span className="text-xs text-gray-400">No sales</span>
                        ) : (
                          <button
                            onClick={() => processPayouts([c.merchant_id])}
                            disabled={loading === 'batch'}
                            className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1 rounded-lg transition-colors flex items-center gap-1">
                            <CheckCircle2 size={11} /> Pay
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-100">
                    <td colSpan={2} />
                    <td className="pt-3 text-xs font-bold text-gray-600 pr-4">{calculations.reduce((s,c)=>s+n(c.order_count),0)} orders</td>
                    <td className="pt-3 font-bold text-gray-900 pr-4">{rm(totalGross)}</td>
                    <td className="pt-3 font-bold text-red-600 pr-4">−{rm(totalCommission)}</td>
                    <td className="pt-3 font-bold text-green-700">{rm(totalPayout)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-4">Payout History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-50">
                {['Merchant','Period','Gross','Commission','Net Payout','Method','Status','Paid'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-400 pb-2 pr-4 whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {history.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="py-2.5 pr-4 font-semibold text-gray-800 truncate max-w-[120px]">{p.merchant?.store_name ?? '—'}</td>
                    <td className="py-2.5 pr-4 text-xs text-gray-500 whitespace-nowrap">{p.period_start} → {p.period_end}</td>
                    <td className="py-2.5 pr-4 text-gray-700">{rm(p.gross_sales)}</td>
                    <td className="py-2.5 pr-4 text-red-600">−{rm(p.commission_amount)}</td>
                    <td className="py-2.5 pr-4 font-bold text-green-700">{rm(p.net_payout)}</td>
                    <td className="py-2.5 pr-4 text-xs text-gray-500 capitalize">{(p.payment_method ?? '—').replace(/_/g,' ')}</td>
                    <td className="py-2.5 pr-4">
                      <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full capitalize',
                        p.status === 'completed'  ? 'bg-green-100 text-green-700' :
                        p.status === 'processing' ? 'bg-blue-100  text-blue-700'  :
                        p.status === 'failed'     ? 'bg-red-100   text-red-700'   : 'bg-amber-100 text-amber-700')}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-xs text-gray-400">{p.paid_at ? format(new Date(p.paid_at),'d MMM yyyy') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
```


***

## Complete Admin System Architecture

| Feature | Route | Access Control |
| :-- | :-- | :-- |
| Platform overview | `/admin` | `profiles.role = 'platform_admin'` [^3] |
| Merchant list + filters | `/admin/merchants` | Service role via `supabaseAdmin` |
| Approve / suspend / reject | API route + audit log | Server-side only, never client key |
| Merchant detail + stats | `/admin/merchants/[id]` | `SECURITY DEFINER` RPC |
| Feature flags per merchant | Merchant settings tab | Saved to `merchants.features` jsonb |
| Impersonation | Cookie-based, 1-hour TTL | Amber banner + stop button in layout |
| Commission \& payouts | `/admin/payouts` | Batch select + per-merchant process |
| Payout history | Payouts → History tab | `merchant_payouts` table |
| Full audit trail | Merchant detail → Audit tab | Every admin action logged |
| Export all data | CSV export buttons | Client-side `exportCSV()` |

<span style="display:none">[^10][^11][^12][^13][^14][^15][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://vivologica.com/web-based-multi-tenant-admin-panels-the-ultimate-guide-to-scalable-saas-management/

[^2]: https://spreecommerce.org/launching-a-white-label-multi-tenant-ecommerce-platform-what-it-takes/

[^3]: https://www.reddit.com/r/Supabase/comments/1oowl03/best_practice_for_creating_an_admin_user_that/

[^4]: https://www.youtube.com/watch?v=VtMMjhxpIXo

[^5]: https://codecanyon.net/item/multitenancy-laravel-admin-saas-domains-users-role-permissions-settings/34354044

[^6]: https://www.youtube.com/watch?v=bXCdU4NGEQQ

[^7]: https://codecanyon.net/item/full-multi-tenancy-laravel-admin-saas-domains-database-users-role-permissions-settings/34907089

[^8]: https://www.reddit.com/r/Supabase/comments/1c3xmgl/do_i_still_need_row_level_security/

[^9]: https://www.codester.com/items/62131/tenantix-multi-tenant-saas-admin-panel

[^10]: https://github.com/orgs/supabase/discussions/30739

[^11]: https://saasykit.com/docs/multi-tenancy/admin-panel

[^12]: https://www.reddit.com/r/Supabase/comments/1h2ofra/using_service_role_with_supabase_in_nextjs/

[^13]: https://www.rishabhsoft.com/blog/how-to-build-a-multi-tenant-saas-application

[^14]: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs

[^15]: https://dashboard-v4-eta.vercel.app/experiments/admin-dashboard

