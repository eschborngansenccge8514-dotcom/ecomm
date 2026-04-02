'use client'

import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { NotificationCentre } from '@/components/monitoring/NotificationCentre'

const TITLES: Record<string, string> = {
  '/':          'Overview',
  '/orders':    'Orders',
  '/products':  'Products',
  '/delivery':  'Delivery',
  '/settings':  'Settings',
  '/admin/applications': 'Merchant Applications',
  '/admin/merchants':    'Merchant Directory',
}

export function Header({ user, merchant, profile }: { user: any; merchant: any; profile: any }) {
  const isAdmin = profile?.role === 'admin'
  const pathname = usePathname()
  
  // Fix for the title rendering typo identified in the plan
  const title = Object.entries(TITLES).findLast(([k]) => pathname === k || (k !== '/' && pathname.startsWith(k)))?.[1] ?? 'Dashboard'

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shrink-0">
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      
      <div className="flex items-center gap-4">
        <NotificationCentre merchantId={merchant.id} />
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-gray-900 leading-none mb-1">{user.email}</p>
          <p className="text-xs text-gray-400 capitalize">
            {merchant.store_name} · {isAdmin ? 'Administrator' : 'Merchant'}
          </p>
        </div>
      </div>
    </header>
  )
}
