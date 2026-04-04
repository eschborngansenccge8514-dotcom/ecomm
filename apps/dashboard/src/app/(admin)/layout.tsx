import { getAuthContext } from '@/lib/utils.server'
import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { Bell, Search, User } from 'lucide-react'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, profile, isAdmin } = await getAuthContext()

  if (!isAdmin) {
    redirect('/')
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <AdminSidebar profile={profile} />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Admin Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 bg-slate-100 px-3 py-1.5 rounded-lg text-slate-500 w-96 max-w-full group focus-within:bg-white focus-within:ring-2 focus-within:ring-purple-100 transition-all">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Search merchants, orders, or logs..." 
              className="bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-400 group-focus-within:text-slate-900" 
            />
          </div>

          <div className="flex items-center gap-6">
            <button className="text-slate-400 hover:text-slate-600 relative transition-colors">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            
            <div className="flex items-center gap-3 pl-6 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-900 leading-none mb-1">{profile.full_name || 'Admin User'}</p>
                <p className="text-[10px] font-bold text-purple-600 uppercase tracking-tighter">System Administrator</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 ring-2 ring-slate-100 shadow-sm">
                <User size={20} />
              </div>
            </div>
          </div>
        </header>

        {/* Admin Main Content */}
        <main className="flex-1 overflow-y-auto p-10">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
