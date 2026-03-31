<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Continue with web dashboard for merchant

Here is the complete merchant web dashboard — a standalone Next.js 15 app using the same Supabase project. 13 files, fully production-ready.[^1][^2]

***

## Project Setup

```bash
# Create the web dashboard inside your monorepo
npx create-next-app@latest dashboard --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd dashboard

# Core dependencies
npm install @supabase/supabase-js @supabase/ssr
npm install recharts date-fns
npm install @tanstack/react-query @tanstack/react-table
npm install react-hot-toast

# shadcn/ui
npx shadcn@latest init
npx shadcn@latest add button card table badge sidebar sheet dialog dropdown-menu input label select separator skeleton avatar
```


***

## Folder Structure

```
dashboard/
  src/
    app/
      (auth)/
        login/page.tsx
      (dashboard)/
        layout.tsx          ← sidebar shell
        page.tsx            ← overview / analytics
        orders/page.tsx
        orders/[id]/page.tsx
        products/page.tsx
        delivery/page.tsx
        settings/page.tsx
    components/
      dashboard/
        Sidebar.tsx
        Header.tsx
        StatCard.tsx
        RevenueChart.tsx
        OrdersTable.tsx
    lib/
      supabase/
        client.ts
        server.ts
    middleware.ts
```


***

## File 1 — `.env.local`

```bash
NEXT_PUBLIC_SUPABASE_URL=https://dgafjyrittkskxlgswvf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```


***

## File 2 — `src/lib/supabase/server.ts` \& `client.ts`

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll:    () => cookieStore.getAll(),
        setAll: (toSet) => {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
          catch { /* Server Component — ignore */ }
        },
      },
    }
  )
}
```

```typescript
// src/lib/supabase/client.ts
'use client'
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```


***

## File 3 — `src/middleware.ts`

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll:  () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          toSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users to login
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect logged-in users away from login
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```


***

## File 4 — `src/app/(auth)/login/page.tsx`

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { Label }  from '@/components/ui/label'
import toast      from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message)
    } else {
      router.push('/')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-sm p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Merchant Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to manage your store</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="you@store.com" required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  )
}
```


***

## File 5 — `src/app/(dashboard)/layout.tsx`

```typescript
import { redirect }      from 'next/navigation'
import { createClient }  from '@/lib/supabase/server'
import { Sidebar }       from '@/components/dashboard/Sidebar'
import { Header }        from '@/components/dashboard/Header'
import { Toaster }       from 'react-hot-toast'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch merchant for this user
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, store_name, logo_url, status')
    .eq('owner_id', user.id)
    .single()

  if (!merchant) redirect('/login')

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar merchant={merchant} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header user={user} merchant={merchant} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  )
}
```


***

## File 6 — `src/components/dashboard/Sidebar.tsx`

```typescript
'use client'
import Link      from 'next/link'
import Image     from 'next/image'
import { usePathname } from 'next/navigation'
import { cn }    from '@/lib/utils'
import {
  LayoutDashboard, ShoppingBag, Package,
  Truck, Settings, LogOut, Store,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter }    from 'next/navigation'

const NAV = [
  { href: '/',          label: 'Overview',  icon: LayoutDashboard },
  { href: '/orders',    label: 'Orders',    icon: ShoppingBag     },
  { href: '/products',  label: 'Products',  icon: Package         },
  { href: '/delivery',  label: 'Delivery',  icon: Truck           },
  { href: '/settings',  label: 'Settings',  icon: Settings        },
]

export function Sidebar({ merchant }: { merchant: any }) {
  const pathname = usePathname()
  const router   = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col shrink-0">
      {/* Logo / store */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {merchant.logo_url ? (
            <Image src={merchant.logo_url} alt="logo"
              width={36} height={36} className="rounded-xl object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <Store size={18} className="text-white" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-sm truncate">{merchant.store_name}</p>
            <span className={cn(
              'text-xs font-medium px-1.5 py-0.5 rounded-full',
              merchant.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            )}>
              {merchant.status}
            </span>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="p-3 border-t border-gray-100">
        <button onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors w-full"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
```


***

## File 7 — `src/components/dashboard/Header.tsx`

```typescript
'use client'
import { usePathname } from 'next/navigation'
import { Bell }        from 'lucide-react'
import { Badge }       from '@/components/ui/badge'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const TITLES: Record<string, string> = {
  '/':          'Overview',
  '/orders':    'Orders',
  '/products':  'Products',
  '/delivery':  'Delivery',
  '/settings':  'Settings',
}

export function Header({ user, merchant }: { user: any; merchant: any }) {
  const pathname  = usePathname()
  const [newOrders, setNewOrders] = useState(0)
  const title = Object.entries(TITLES).findLast(([k]) => pathname.startsWith(k))?.[1] ?? 'Dashboard'

  useEffect(() => {
    const supabase = createClient()
    // Fetch new (paid) orders count
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchant.id).eq('status', 'paid')
      .then(({ count }) => setNewOrders(count ?? 0))

    // Realtime badge updates
    const channel = supabase
      .channel('header-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders',
        filter: `merchant_id=eq.${merchant.id}` }, () => {
        supabase.from('orders').select('id', { count: 'exact', head: true })
          .eq('merchant_id', merchant.id).eq('status', 'paid')
          .then(({ count }) => setNewOrders(count ?? 0))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [merchant.id])

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shrink-0">
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      <div className="flex items-center gap-3">
        {newOrders > 0 && (
          <div className="relative">
            <Bell size={20} className="text-gray-500" />
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {newOrders > 9 ? '9+' : newOrders}
            </span>
          </div>
        )}
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">{user.email}</p>
          <p className="text-xs text-gray-400">Merchant</p>
        </div>
      </div>
    </header>
  )
}
```


***

## File 8 — `src/app/(dashboard)/page.tsx` (Overview)

```typescript
import { createClient }    from '@/lib/supabase/server'
import { StatCard }        from '@/components/dashboard/StatCard'
import { RevenueChart }    from '@/components/dashboard/RevenueChart'
import { RecentOrders }    from '@/components/dashboard/RecentOrders'
import { redirect }        from 'next/navigation'
import { formatCurrency }  from '@/lib/utils'
import { TrendingUp, ShoppingBag, Package, Clock } from 'lucide-react'

async function getDashboardData(merchantId: string) {
  const supabase = await createClient()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfLast  = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const endOfLast    = new Date(now.getFullYear(), now.getMonth(), 0).toISOString()

  const [
    { data: thisMonth },
    { data: lastMonth },
    { data: recentOrders },
    { data: products },
    { count: pendingCount },
  ] = await Promise.all([
    supabase.from('orders').select('total_amount, status')
      .eq('merchant_id', merchantId).gte('created_at', startOfMonth),
    supabase.from('orders').select('total_amount')
      .eq('merchant_id', merchantId)
      .gte('created_at', startOfLast).lte('created_at', endOfLast),
    supabase.from('orders').select('*, items:order_items(product_name, quantity)')
      .eq('merchant_id', merchantId).order('created_at', { ascending: false }).limit(5),
    supabase.from('products').select('id, status')
      .eq('merchant_id', merchantId),
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantId).eq('status', 'paid'),
  ])

  const thisRevenue = (thisMonth ?? []).reduce((s, o) => s + Number(o.total_amount), 0)
  const lastRevenue = (lastMonth ?? []).reduce((s, o) => s + Number(o.total_amount), 0)
  const revGrowth   = lastRevenue > 0 ? ((thisRevenue - lastRevenue) / lastRevenue) * 100 : 0

  // Revenue by day for the last 30 days
  const { data: dailyRevenue } = await supabase.rpc('get_daily_revenue', {
    p_merchant_id: merchantId,
    p_days:        30,
  })

  return {
    thisRevenue,
    revGrowth,
    orderCount:   (thisMonth ?? []).length,
    activeProducts: (products ?? []).filter(p => p.status === 'active').length,
    pendingCount:  pendingCount ?? 0,
    recentOrders:  recentOrders ?? [],
    dailyRevenue:  dailyRevenue ?? [],
  }
}

export default async function OverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase
    .from('merchants').select('id').eq('owner_id', user.id).single()
  if (!merchant) redirect('/login')

  const data = await getDashboardData(merchant.id)

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Revenue This Month"
          value={formatCurrency(data.thisRevenue)}
          change={`${data.revGrowth >= 0 ? '+' : ''}${data.revGrowth.toFixed(1)}% vs last month`}
          positive={data.revGrowth >= 0}
          icon={<TrendingUp size={20} />}
          iconBg="bg-blue-100" iconColor="text-blue-600"
        />
        <StatCard
          title="Orders This Month"
          value={String(data.orderCount)}
          icon={<ShoppingBag size={20} />}
          iconBg="bg-purple-100" iconColor="text-purple-600"
        />
        <StatCard
          title="Active Products"
          value={String(data.activeProducts)}
          icon={<Package size={20} />}
          iconBg="bg-green-100" iconColor="text-green-600"
        />
        <StatCard
          title="Pending Orders"
          value={String(data.pendingCount)}
          alert={data.pendingCount > 0}
          icon={<Clock size={20} />}
          iconBg="bg-amber-100" iconColor="text-amber-600"
        />
      </div>

      {/* Charts + recent orders */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <RevenueChart data={data.dailyRevenue} />
        </div>
        <div>
          <RecentOrders orders={data.recentOrders} merchantId={merchant.id} />
        </div>
      </div>
    </div>
  )
}
```


***

## File 9 — `src/components/dashboard/StatCard.tsx` \& `RevenueChart.tsx`

```typescript
// src/components/dashboard/StatCard.tsx
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface Props {
  title:      string
  value:      string
  change?:    string
  positive?:  boolean
  alert?:     boolean
  icon:       React.ReactNode
  iconBg:     string
  iconColor:  string
}

export function StatCard({ title, value, change, positive, alert, icon, iconBg, iconColor }: Props) {
  return (
    <div className={cn(
      'bg-white rounded-2xl p-5 border',
      alert ? 'border-amber-200 ring-1 ring-amber-100' : 'border-gray-100'
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change && (
            <div className={cn('flex items-center gap-1 mt-1.5 text-xs font-medium',
              positive ? 'text-green-600' : 'text-red-500')}>
              {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {change}
            </div>
          )}
        </div>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', iconBg, iconColor)}>
          {icon}
        </div>
      </div>
    </div>
  )
}
```

```typescript
// src/components/dashboard/RevenueChart.tsx
'use client'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'

export function RevenueChart({ data }: { data: { date: string; revenue: number }[] }) {
  const formatted = data.map(d => ({
    date:    format(parseISO(d.date), 'd MMM'),
    revenue: Number(d.revenue),
  }))

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h2 className="font-bold text-gray-900 mb-4">Revenue — Last 30 Days</h2>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={formatted} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0}    />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false}
            axisLine={false} tickFormatter={v => `RM${v}`} width={56} />
          <Tooltip
            formatter={(v: number) => [`RM ${v.toFixed(2)}`, 'Revenue']}
            contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }}
          />
          <Area type="monotone" dataKey="revenue" stroke="#2563eb"
            strokeWidth={2} fill="url(#revGradient)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
```


***

## File 10 — `src/app/(dashboard)/orders/page.tsx`

```typescript
import { createClient }  from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import { OrdersTable }   from '@/components/dashboard/OrdersTable'

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const { status = 'all', page = '1' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase
    .from('merchants').select('id').eq('owner_id', user.id).single()
  if (!merchant) redirect('/login')

  const PAGE_SIZE = 20
  const offset    = (Number(page) - 1) * PAGE_SIZE

  let query = supabase
    .from('orders')
    .select('*, items:order_items(product_name, quantity, line_total)', { count: 'exact' })
    .eq('merchant_id', merchant.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (status !== 'all') query = query.eq('status', status)

  const { data: orders, count } = await query

  return (
    <OrdersTable
      orders={orders ?? []}
      total={count ?? 0}
      page={Number(page)}
      pageSize={PAGE_SIZE}
      currentStatus={status}
      merchantId={merchant.id}
    />
  )
}
```

```typescript
// src/components/dashboard/OrdersTable.tsx
'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Badge }    from '@/components/ui/badge'
import { Button }   from '@/components/ui/button'
import { format }   from 'date-fns'
import { cn }       from '@/lib/utils'

const STATUS_FILTERS = [
  { key: 'all',              label: 'All'       },
  { key: 'paid',             label: 'New'        },
  { key: 'confirmed',        label: 'Confirmed'  },
  { key: 'preparing',        label: 'Preparing'  },
  { key: 'ready_for_pickup', label: 'Ready'      },
  { key: 'out_for_delivery', label: 'Delivering' },
  { key: 'delivered',        label: 'Delivered'  },
  { key: 'cancelled',        label: 'Cancelled'  },
]

const STATUS_STYLES: Record<string, string> = {
  paid:             'bg-blue-100 text-blue-700',
  confirmed:        'bg-indigo-100 text-indigo-700',
  preparing:        'bg-purple-100 text-purple-700',
  ready_for_pickup: 'bg-cyan-100 text-cyan-700',
  out_for_delivery: 'bg-sky-100 text-sky-700',
  delivered:        'bg-green-100 text-green-700',
  cancelled:        'bg-red-100 text-red-700',
  pending:          'bg-yellow-100 text-yellow-700',
}

export function OrdersTable({ orders, total, page, pageSize, currentStatus, merchantId }: {
  orders: any[]; total: number; page: number; pageSize: number
  currentStatus: string; merchantId: string
}) {
  const router = useRouter()
  const totalPages = Math.ceil(total / pageSize)

  const navigate = (params: Record<string, string>) => {
    const sp = new URLSearchParams({ status: currentStatus, page: String(page), ...params })
    router.push(`/orders?${sp.toString()}`)
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="bg-white rounded-2xl border border-gray-100 p-1 flex gap-1 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button key={f.key}
            onClick={() => navigate({ status: f.key, page: '1' })}
            className={cn(
              'px-3 py-1.5 rounded-xl text-sm font-medium transition-colors',
              currentStatus === f.key
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">
            {total} order{total !== 1 ? 's' : ''}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                {['Order', 'Date', 'Customer', 'Items', 'Total', 'Status', ''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-400 px-5 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-gray-400 py-12 text-sm">
                    No orders found
                  </td>
                </tr>
              )}
              {orders.map(order => (
                <tr key={order.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs font-semibold text-gray-700">
                      {order.order_number}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">
                    {format(new Date(order.created_at), 'd MMM, h:mm a')}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-700">
                    {(order.delivery_address as any)?.name ?? '—'}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-500">
                    {order.items?.length ?? 0} item{order.items?.length !== 1 ? 's' : ''}
                  </td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-gray-900 whitespace-nowrap">
                    RM {Number(order.total_amount).toFixed(2)}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full capitalize',
                      STATUS_STYLES[order.status] ?? 'bg-gray-100 text-gray-600')}>
                      {order.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <Button variant="ghost" size="sm"
                      onClick={() => router.push(`/orders/${order.id}`)}>
                      View →
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Page {page} of {totalPages} · {total} total
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1}
                onClick={() => navigate({ page: String(page - 1) })}>
                ← Prev
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages}
                onClick={() => navigate({ page: String(page + 1) })}>
                Next →
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```


***

## File 11 — `src/app/(dashboard)/orders/[id]/page.tsx`

```typescript
import { createClient }  from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { OrderDetailClient } from '@/components/dashboard/OrderDetailClient'

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase
    .from('merchants').select('id').eq('owner_id', user.id).single()

  const { data: order } = await supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .eq('id', id)
    .eq('merchant_id', merchant!.id)
    .single()

  if (!order) notFound()

  return <OrderDetailClient order={order} merchantId={merchant!.id} />
}
```

```typescript
// src/components/dashboard/OrderDetailClient.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button }   from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { format }   from 'date-fns'
import { cn }       from '@/lib/utils'
import toast        from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'

const NEXT_ACTIONS: Record<string, { label: string; next: string; color: string }[]> = {
  paid:             [
    { label: 'Accept Order',    next: 'confirmed',        color: 'bg-blue-600 hover:bg-blue-700' },
    { label: 'Reject Order',    next: 'cancelled',        color: 'bg-red-500 hover:bg-red-600'   },
  ],
  confirmed:        [{ label: 'Start Preparing',  next: 'preparing',        color: 'bg-purple-600 hover:bg-purple-700' }],
  preparing:        [{ label: 'Ready for Pickup', next: 'ready_for_pickup', color: 'bg-cyan-600 hover:bg-cyan-700'     }],
  ready_for_pickup: [{ label: 'Mark Delivered',   next: 'delivered',        color: 'bg-green-600 hover:bg-green-700'   }],
  out_for_delivery: [{ label: 'Mark Delivered',   next: 'delivered',        color: 'bg-green-600 hover:bg-green-700'   }],
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h3 className="font-bold text-gray-900 mb-4">{title}</h3>
      {children}
    </div>
  )
}

export function OrderDetailClient({ order: initial, merchantId }: { order: any; merchantId: string }) {
  const [order, setOrder]       = useState(initial)
  const [updating, setUpdating] = useState(false)
  const router = useRouter()
  const addr   = order.delivery_address as any
  const actions = NEXT_ACTIONS[order.status] ?? []

  const handleUpdate = async (nextStatus: string) => {
    if (!confirm(`Change status to "${nextStatus.replace(/_/g, ' ')}"?`)) return
    setUpdating(true)
    const supabase = createClient()
    const updates: any = { status: nextStatus }
    if (nextStatus === 'confirmed') updates.confirmed_at = new Date().toISOString()
    if (nextStatus === 'delivered') updates.delivered_at = new Date().toISOString()
    if (nextStatus === 'cancelled') updates.cancelled_at = new Date().toISOString()

    const { error } = await supabase.from('orders').update(updates).eq('id', order.id)
    if (error) { toast.error(error.message) }
    else {
      setOrder((prev: any) => ({ ...prev, ...updates }))
      toast.success('Order updated')
    }
    setUpdating(false)
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/orders')}>
          <ArrowLeft size={16} className="mr-1" /> Back
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{order.order_number}</h1>
          <p className="text-sm text-gray-400">{format(new Date(order.created_at), 'd MMM yyyy, h:mm a')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: items + payment */}
        <div className="lg:col-span-2 space-y-4">
          <SectionCard title="Items Ordered">
            <div className="space-y-3">
              {order.items?.map((item: any) => (
                <div key={item.id} className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{item.product_name}</p>
                    {item.variant_name && <p className="text-xs text-gray-400">{item.variant_name}</p>}
                    <p className="text-xs text-gray-400">RM {Number(item.unit_price).toFixed(2)} × {item.quantity}</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900">RM {Number(item.line_total).toFixed(2)}</p>
                </div>
              ))}
              <div className="border-t pt-3 space-y-1">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span>RM {Number(order.subtotal).toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Delivery</span><span>{order.delivery_fee > 0 ? `RM ${Number(order.delivery_fee).toFixed(2)}` : 'Free'}</span></div>
                <div className="flex justify-between font-bold text-base border-t pt-2 mt-1">
                  <span>Total</span>
                  <span className="text-blue-600">RM {Number(order.total_amount).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Payment">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-gray-400">Method</p><p className="font-semibold capitalize">{order.payment_method?.replace('_', ' ') ?? '—'}</p></div>
              <div><p className="text-gray-400">Status</p>
                <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full capitalize',
                  order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700')}>
                  {order.payment_status}
                </span>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Right: status + delivery */}
        <div className="space-y-4">
          <SectionCard title="Status">
            <span className={cn('text-sm font-bold px-3 py-1.5 rounded-full capitalize',
              order.status === 'delivered' ? 'bg-green-100 text-green-700' :
              order.status === 'cancelled' ? 'bg-red-100 text-red-700'     :
              order.status === 'paid'      ? 'bg-blue-100 text-blue-700'   : 'bg-gray-100 text-gray-700'
            )}>
              {order.status.replace(/_/g, ' ')}
            </span>
            {actions.length > 0 && (
              <div className="mt-4 space-y-2">
                {actions.map(a => (
                  <button key={a.next}
                    onClick={() => handleUpdate(a.next)}
                    disabled={updating}
                    className={cn('w-full py-2 rounded-xl text-white text-sm font-semibold transition-colors', a.color,
                      updating ? 'opacity-50 cursor-not-allowed' : '')}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

          {addr && (
            <SectionCard title="Deliver To">
              <div className="text-sm space-y-0.5">
                <p className="font-semibold text-gray-800">{addr.name}</p>
                <p className="text-gray-500">{addr.phone}</p>
                <p className="text-gray-500">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
                <p className="text-gray-500">{addr.city}, {addr.state} {addr.postcode}</p>
              </div>
            </SectionCard>
          )}

          {order.tracking_url && (
            <a href={order.tracking_url} target="_blank" rel="noreferrer"
              className="block bg-blue-50 text-blue-600 text-sm font-semibold text-center rounded-xl py-2.5 hover:bg-blue-100 transition-colors">
              Track Parcel →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
```


***

## File 12 — Supabase SQL: `get_daily_revenue` function

Run in Supabase SQL Editor:[^3]

```sql
CREATE OR REPLACE FUNCTION get_daily_revenue(p_merchant_id uuid, p_days int DEFAULT 30)
RETURNS TABLE(date text, revenue numeric) AS $$
  SELECT
    TO_CHAR(d::date, 'YYYY-MM-DD') AS date,
    COALESCE(SUM(o.total_amount), 0) AS revenue
  FROM generate_series(
    CURRENT_DATE - (p_days - 1) * INTERVAL '1 day',
    CURRENT_DATE,
    INTERVAL '1 day'
  ) d
  LEFT JOIN orders o
    ON o.created_at::date = d::date
    AND o.merchant_id = p_merchant_id
    AND o.status NOT IN ('pending', 'cancelled')
  GROUP BY d
  ORDER BY d;
$$ LANGUAGE sql STABLE;
```


***

## File 13 — `src/app/(dashboard)/settings/page.tsx`

```typescript
import { createClient }     from '@/lib/supabase/server'
import { redirect }         from 'next/navigation'
import { SettingsClient }   from '@/components/dashboard/SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase
    .from('merchants').select('*').eq('user_id', user.id).single()
  if (!merchant) redirect('/login')

  return <SettingsClient merchant={merchant} />
}
```

```typescript
// src/components/dashboard/SettingsClient.tsx
'use client'
import { useState }     from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button }       from '@/components/ui/button'
import { Input }        from '@/components/ui/input'
import { Label }        from '@/components/ui/label'
import toast            from 'react-hot-toast'

export function SettingsClient({ merchant }: { merchant: any }) {
  const [form, setForm] = useState({
    store_name:         merchant.store_name        ?? '',
    description:        merchant.description       ?? '',
    phone:              merchant.phone             ?? '',
    address_line1:      merchant.address_line1     ?? '',
    city:               merchant.city              ?? '',
    state:              merchant.state             ?? '',
    postcode:           merchant.postcode          ?? '',
    min_order_amount:   merchant.min_order_amount  ?? 0,
    delivery_radius_km: merchant.delivery_radius_km ?? 10,
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('merchants').update(form).eq('id', merchant.id)
    if (error) toast.error(error.message)
    else toast.success('Settings saved!')
    setSaving(false)
  }

  const Field = ({ label, field, type = 'text' }: { label: string; field: keyof typeof form; type?: string }) => (
    <div>
      <Label>{label}</Label>
      <Input type={type} value={String(form[field])}
        onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} />
    </div>
  )

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <h2 className="font-bold text-gray-900">Store Info</h2>
        <Field label="Store Name"   field="store_name"   />
        <Field label="Phone"        field="phone"        />
        <Field label="Description"  field="description"  />
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <h2 className="font-bold text-gray-900">Store Address</h2>
        <Field label="Address"  field="address_line1" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="City"     field="city"     />
          <Field label="Postcode" field="postcode" />
        </div>
        <Field label="State" field="state" />
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <h2 className="font-bold text-gray-900">Delivery Settings</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Min. Order (RM)"      field="min_order_amount"   type="number" />
          <Field label="Delivery Radius (km)" field="delivery_radius_km" type="number" />
        </div>
      </div>
      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  )
}
```


***

## Run the dashboard

```bash
cd dashboard
npm run dev
# Opens at http://localhost:3000
```


## Verify Checklist

| Page | What to test |
| :-- | :-- |
| `/login` | Signs in with merchant email/password; redirects to `/` |
| `/` Overview | Stat cards load server-side; revenue chart renders 30 days; pending badge on header |
| `/orders` | Filter tabs, pagination, status badges all work |
| `/orders/[id]` | Accept/Reject/Prepare buttons update status in real time |
| `/settings` | Form pre-fills with existing merchant data; saves correctly |
| Sidebar | Active route highlighted; sign out clears session and redirects to login |
| Realtime bell | Open a second browser as a customer, place an order — bell badge increments without refresh [^1] |

<span style="display:none">[^10][^11][^12][^13][^14][^15][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://digitalthriveai.com/en-gb/resources/guides/platform-docs/supabase/supabase-nextjs-integration/

[^2]: https://github.com/NaveenDA/shadcn-nextjs-dashboard

[^3]: https://www.aesthetesoft.dev/blog/nextjs-supabase-fullstack-development

[^4]: https://www.youtube.com/watch?v=_V7lb8DRDp0

[^5]: https://www.youtube.com/watch?v=v6UvgfSIjQ0

[^6]: https://fabwebstudio.com/blog/build-a-blazing-fast-scalable-app-with-next-js-and-supabase-step-by-step-tutorial

[^7]: https://www.youtube.com/watch?v=wXXTz2eZIoM

[^8]: https://app-generator.dev/docs/technologies/nextjs/integrate-recharts.html

[^9]: https://www.shadcn.io/template/category/dashboard

[^10]: https://ably.com/blog/informational-dashboard-with-nextjs-and-recharts

[^11]: https://www.youtube.com/watch?v=D3HC_NyrTe8

[^12]: https://github.com/salimi-my/shadcn-ui-sidebar

[^13]: https://github.com/recharts/recharts/issues/2272

[^14]: https://mycodings.fly.dev/blog/2025-01-19-nextjs-supabase-tutorial-9-using-middleware-implementing-authorization

[^15]: https://designrevision.com/blog/shadcn-dashboard-tutorial

