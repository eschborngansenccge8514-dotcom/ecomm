'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  Users, 
  FileText, 
  Activity, 
  Settings, 
  LogOut, 
  ShieldCheck,
  LayoutDashboard,
  ArrowLeftRight,
  ExternalLink
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'

const ADMIN_NAV = [
  { href: '/admin',              label: 'Platform Overview', icon: LayoutDashboard },
  { href: '/admin/applications', label: 'Merchant Applications', icon: FileText },
  { href: '/admin/merchants',    label: 'All Merchants',          icon: Users    },
  { href: '/admin/agent-health', label: 'AI Agent Health',      icon: Activity },
]

export function AdminSidebar({ profile }: { profile: any }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    toast.success('Signed out')
  }

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 text-slate-300">
      {/* Logo / Brand */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center">
            <ShieldCheck size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-white text-sm tracking-tight font-outfit">Platform Admin</p>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-900/50 text-purple-300 uppercase">
              Root Access
            </span>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <p className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Core Management
        </p>
        {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
          return (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
                active
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              )}
            >
              <Icon size={18} className={cn(active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300')} />
              {label}
            </Link>
          )
        })}

        <div className="pt-8">
          <p className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Context Switching
          </p>
          <Link href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-all border border-transparent hover:border-slate-700"
          >
            <ArrowLeftRight size={18} className="text-slate-500" />
            Switch to Merchant View
          </Link>
        </div>
      </nav>

      {/* Sign out */}
      <div className="p-4 border-t border-slate-800">
        <button onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-red-950/30 hover:text-red-400 transition-colors w-full"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
