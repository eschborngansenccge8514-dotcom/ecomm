'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { AccountingGuide } from './_components/AccountingGuide'
import { 
  Calculator, 
  ListTree, 
  FileText, 
  BookOpen, 
  CalendarClock, 
  LayoutDashboard
} from 'lucide-react'

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const tabs = [
    { label: 'Overview', href: '/accounting', icon: LayoutDashboard },
    { label: 'Chart of Accounts', href: '/accounting/coa', icon: ListTree },
    { label: 'Journal', href: '/accounting/journal', icon: BookOpen },
    { label: 'Reports', href: '/accounting/reports', icon: FileText },
    { label: 'Periods', href: '/accounting/periods', icon: CalendarClock },
  ]

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Accounting</h1>
          <p className="text-gray-500 font-medium mt-1">Double-entry bookkeeping and financial reports</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100/50 p-1.5 rounded-2xl w-fit">
        {tabs.map((tab) => {
          const active = tab.href === '/accounting' 
            ? pathname === '/accounting' 
            : pathname.startsWith(tab.href)
            
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all',
                active
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
              )}
            >
              <tab.icon size={16} />
              {tab.label}
            </Link>
          )
        })}
      </div>

      {children}

      <AccountingGuide />
    </div>
  )
}
