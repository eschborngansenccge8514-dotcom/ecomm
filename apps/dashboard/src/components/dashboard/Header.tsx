'use client'

import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { NotificationCentre } from '@/components/monitoring/NotificationCentre'
import { useState, useEffect } from 'react'

const TITLES: Record<string, string> = {
  '/orders':    'Orders',
  '/products':  'Products',
  '/settings':  'Settings',
  '/support/inbox': 'Support Inbox',
  '/support/settings': 'Support Settings',
  '/admin/applications': 'Merchant Applications',
  '/admin/merchants':    'Merchant Directory',
}

export function Header({ user, merchant, profile }: { user: any; merchant: any; profile: any }) {
  const isAdmin = profile?.role === 'admin'
  const pathname = usePathname()
  const [escalationsCount, setEscalationsCount] = useState(0)
  const supabase = createClient()
  
  // Fix for the title rendering typo identified in the plan
  const title = Object.entries(TITLES).findLast(([k]) => pathname === k || (k !== '/' && pathname.startsWith(k)))?.[1] ?? 'Dashboard'

  const isSupportPage = pathname.startsWith('/support')

  useEffect(() => {
    if (!isSupportPage) return

    async function fetchEscalations() {
      const { count } = await supabase
        .from('support_escalations')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', merchant.id)
        .eq('status', 'pending')
      
      setEscalationsCount(count || 0)
    }

    fetchEscalations()

    // Subscribe to changes
    const channel = supabase
      .channel('header_escalations')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'support_escalations',
        filter: `merchant_id=eq.${merchant.id}`
      }, () => {
        fetchEscalations()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isSupportPage, merchant.id])

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shrink-0 h-16">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        
        {isSupportPage && escalationsCount > 0 && (
          <div className="flex items-center gap-2 px-2.5 py-1 text-[10px] font-bold border rounded-full bg-red-50 text-red-600 border-red-100 uppercase tracking-tight animate-in fade-in zoom-in duration-300">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping bg-red-400"></span>
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-red-500"></span>
            </span>
            {escalationsCount} Pending Escalations
          </div>
        )}
      </div>
      
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
