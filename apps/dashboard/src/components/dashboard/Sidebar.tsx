'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Receipt,
  Package,
  Users,
  Truck,
  Settings, 
  LogOut, 
  Store,
  Star,
  AlertCircle,
  FileText,
  FileCheck,
  Zap,
  PieChart,
  Palette,
  Box,
  ShieldAlert,
  Headphones,
  Monitor,
  ArrowUpRight,
  Mail,
  MessageSquare,
  ShoppingCart,
  Wallet,
  Share2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'
import { SupportBadge } from '@/components/nav/SupportBadge'

const NAV_GROUPS = [
  {
    group: 'Home',
    items: [
      { href: '/', label: 'Overview', icon: LayoutDashboard },
    ]
  },
  {
    group: 'Management',
    items: [
      { href: '/pos', label: 'Web POS', icon: Monitor },
      { href: '/operations', label: 'Operations', icon: ArrowUpRight },
    ]
  },
  {
    group: 'Sales',
    items: [
      { href: '/orders', label: 'Orders', icon: ShoppingBag },
      { href: '/customers', label: 'Customers', icon: Users },
      { href: '/loyalty', label: 'Loyalty', icon: Star },
      { href: '/payment-exceptions', label: 'Payment Errors', icon: AlertCircle },
    ]
  },
  {
    group: 'Inventory',
    items: [
      { href: '/inventory', label: 'Inventory', icon: Package, badge: undefined },
      { href: '/inventory/purchasing', label: 'Procurement', icon: ShoppingCart, badge: undefined },
    ]
  },
  {
    group: 'Finance',
    items: [
      { href: '/wallet', label: 'Wallet', icon: Wallet },
      { href: '/expenses', label: 'Expenses', icon: Receipt },
      { href: '/einvoice', label: 'E-Invoicing', icon: FileCheck },
      { href: '/reports', label: 'Reports', icon: FileText },
    ]
  },
  {
    group: 'Logistics',
    items: [
      { href: '/shipping/easyparcel', label: 'EasyParcel', icon: Box },
      { href: '/shipping/lalamove', label: 'Lalamove', icon: Zap },
    ]
  },
  {
    group: 'Communication',
    items: [
      { href: '/support/inbox', label: 'Support Inbox', icon: Headphones, badge: <SupportBadge /> },
      { href: '/support/settings', label: 'Support Setup', icon: Headphones },
      { href: '/settings/whatsapp', label: 'WhatsApp', icon: MessageSquare },
      { href: '/email', label: 'Email Logs', icon: Mail },
      { href: '/marketing', label: 'Email Marketing', icon: Zap },
      { href: '/social', label: 'Social Hub', icon: Share2 },
      { href: '/email/settings', label: 'Email Setup', icon: Settings },
    ]
  },
  {
    group: 'System',
    items: [
      { href: '/marketplace', label: 'Marketplace', icon: Store },
      { href: '/settings/store', label: 'Store Theme', icon: Palette },
      { href: '/settings', label: 'Settings', icon: Settings },
    ]
  }
]


export function Sidebar({ merchant, profile }: { merchant: any; profile: any }) {
  const isAdmin = profile?.role === 'admin'
  
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    toast.success('Signed out')
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
      <nav className="flex-1 p-3 space-y-6 overflow-y-auto">
        {isAdmin && (
          <div className="px-1">
            <Link href="/admin" prefetch={true}
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-sm"
            >
              <div className="flex items-center gap-2">
                <ShieldAlert size={16} className="text-purple-400" />
                <span>Admin Dashboard</span>
              </div>
              <ArrowUpRight size={14} className="text-slate-500" />
            </Link>
          </div>
        )}

        {NAV_GROUPS.map((group) => (
          <div key={group.group}>
            <p className="px-3 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]">
              {group.group}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon, badge }) => {
                const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
                if (isAdmin && (href === '/settings' || href === '/settings/store')) return null // Admins handle global settings
                return (
                  <Link key={href} href={href} prefetch={true}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors',
                      active
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                  >
                    <Icon size={18} />
                    <span className="flex-1">{label}</span>
                    {badge}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
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
