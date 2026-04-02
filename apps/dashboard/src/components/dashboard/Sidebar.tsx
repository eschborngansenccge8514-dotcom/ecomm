'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Package, 
  Tag,
  Users,
  BarChart2,
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
  Box
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'

const NAV = [
  { href: '/',            label: 'Overview',    icon: LayoutDashboard },
  { href: '/operations',  label: 'Operations',  icon: Zap             },
  { href: '/orders',      label: 'Orders',      icon: ShoppingBag     },
  { href: '/products',    label: 'Products',    icon: Package         },
  { href: '/categories',  label: 'Categories',  icon: Tag             },
  { href: '/customers',   label: 'Customers',   icon: Users           },
  { href: '/analytics',   label: 'Analytics',   icon: BarChart2       },
  { href: '/reports/products', label: 'Product Analytics', icon: PieChart },
  { href: '/reports',     label: 'Reports',     icon: FileText        },
  { href: '/loyalty',     label: 'Loyalty',     icon: Star            },
  { href: '/delivery',    label: 'Delivery',    icon: Truck           },
  { href: '/shipping/easyparcel', label: 'EasyParcel', icon: Box        },
  { href: '/shipping/lalamove',   label: 'Lalamove',   icon: Zap        },
  { href: '/einvoices',   label: 'E-Invoicing', icon: FileCheck       },
  { href: '/marketplace', label: 'Marketplace', icon: Store           },
  { href: '/payment-exceptions', label: 'Payment Errors', icon: AlertCircle },
  { href: '/settings/store', label: 'Store Theme', icon: Palette       },
  { href: '/settings',    label: 'Settings',    icon: Settings        },
]


export function Sidebar({ merchant, profile }: { merchant: any; profile: any }) {
  const isAdmin = profile?.role === 'admin'
  
  const ADMIN_NAV = [
    { href: '/admin/applications', label: 'Merchant Applications', icon: FileText },
    { href: '/admin/merchants',    label: 'All Merchants',          icon: Users    },
  ]
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
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {isAdmin && (
          <div className="mb-4">
            <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Administration
            </p>
            {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href)
              return (
                <Link key={href} href={href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    active
                      ? 'bg-purple-50 text-purple-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              )
            })}
          </div>
        )}

        <div className="mb-4">
          <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {isAdmin ? 'Merchant View' : 'Management'}
          </p>
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            if (isAdmin && (href === '/settings' || href === '/settings/store')) return null // Admins handle global settings
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
        </div>
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
