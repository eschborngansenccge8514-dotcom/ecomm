'use client'

import { 
  History, 
  Menu, 
  Wifi, 
  Settings, 
  X, 
  Bell, 
  LayoutDashboard,
  Monitor,
  Printer,
  ChevronDown,
  User,
  Lock,
  Play
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useState } from 'react'
import { HistoryModal } from './HistoryModal'
import { NotificationDropdown } from './NotificationDropdown'
import { PrinterModal } from './PrinterModal'
import { TerminalSettingsModal } from './TerminalSettingsModal'
import { OfflineSyncModal } from './OfflineSyncModal'
import { CloseSessionModal } from './CloseSessionModal'
import { usePosSettings } from '@/stores/pos-settings'
import { usePosOffline } from '@/stores/pos-offline'

interface ActionHeaderProps {
  outletId?: string
  sessionId?: string
  outletName?: string
  userName?: string
  merchantName?: string
  onStartSession?: () => void
}

export function ActionHeader({ outletId, sessionId, outletName, userName, merchantName, onStartSession }: ActionHeaderProps) {
  const router = useRouter()
  const [isPrinterOpen, setIsPrinterOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isOfflineSyncOpen, setIsOfflineSyncOpen] = useState(false)
  const [isCloseSessionOpen, setIsCloseSessionOpen] = useState(false)

  const { terminalName } = usePosSettings()
  const { pendingTransactions, isOfflineMode } = usePosOffline()
  const pendingCount = pendingTransactions?.length || 0

  // Generate initials (e.g. "Adam G" -> "AG")
  const initials = (userName || 'AD')
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-30 shadow-sm relative shrink-0">
      <div className="flex items-center gap-6">
        <Link 
          href="/dashboard"
          className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors group"
        >
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all">
            <LayoutDashboard size={18} />
          </div>
          <span className="text-sm font-bold tracking-tight">Dashboard</span>
        </Link>
        <div className="h-6 w-px bg-slate-200" />
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-200">
            <Monitor size={20} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 leading-none uppercase tracking-tight">
              {terminalName || merchantName || 'Terminal 01'}
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Outlet: {outletName || 'Main'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {isOfflineMode || (typeof navigator !== 'undefined' && !navigator.onLine) ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest border border-amber-100">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Offline Mode
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest border border-emerald-100">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Online
          </div>
        )}

        <div className="flex items-center gap-1">
          <button 
            onClick={() => setIsPrinterOpen(true)}
            className={`p-2.5 rounded-xl transition-all ${isPrinterOpen ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
          >
            <Printer size={18} />
          </button>
          <button 
            onClick={() => setIsHistoryOpen(true)}
            className={`p-2.5 rounded-xl transition-all ${isHistoryOpen ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
          >
            <History size={18} />
          </button>
          <button 
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={`p-2.5 rounded-xl transition-all relative ${isNotificationsOpen ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
          >
            <Bell size={18} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
          </button>
          <div className="w-px h-6 bg-slate-200 mx-2" />
          
          <div className="relative">
            <button 
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className={`flex items-center gap-2 pl-2 pr-1 py-1 rounded-full border transition-all font-bold text-xs
                ${isUserMenuOpen ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${isUserMenuOpen ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}`}>
                {initials}
              </span>
              {userName || 'Adam G.'}
              <ChevronDown size={14} className={`transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180 text-white' : 'text-slate-400'}`} />
            </button>

            {isUserMenuOpen && (
              <div className="absolute top-10 right-0 w-48 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 animate-in slide-in-from-top-2 duration-200 z-50">
                <button 
                  onClick={() => router.push('/dashboard/profile')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
                >
                  <User size={16} className="text-slate-400" />
                  My Profile
                </button>
                <button 
                  onClick={() => router.push('/dashboard/settings')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
                >
                  <Settings size={16} className="text-slate-400" />
                  Account Settings
                </button>
                <div className="h-px bg-slate-100 my-1 mx-2" />
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 text-xs font-bold text-red-600 transition-colors"
                >
                  <X size={16} />
                  Log Out
                </button>
              </div>
            )}
          </div>

          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`p-2.5 rounded-xl transition-all relative ${isMenuOpen ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center animate-bounce">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      </div>
      
      {/* Dynamic Popovers/Modals */}
      <NotificationDropdown isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} outletId={outletId || ''} />
      <PrinterModal isOpen={isPrinterOpen} onClose={() => setIsPrinterOpen(false)} outletId={outletId || ''} />
      <TerminalSettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        outletId={outletId}
        sessionId={sessionId} 
      />
      <OfflineSyncModal isOpen={isOfflineSyncOpen} onClose={() => setIsOfflineSyncOpen(false)} />
      <CloseSessionModal isOpen={isCloseSessionOpen} onClose={() => setIsCloseSessionOpen(false)} sessionId={sessionId || ''} />

      {/* Quick Menu Dropdown */}
      {isMenuOpen && (
        <div className="absolute top-16 right-6 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 animate-in slide-in-from-top-2 duration-200 z-50">
          <div className="space-y-1">
            <button 
              onClick={() => { setIsSettingsOpen(true); setIsMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-colors"
            >
              <Settings size={18} className="text-slate-400" />
              Terminal Settings
            </button>
             <button 
              onClick={() => { setIsOfflineSyncOpen(true); setIsMenuOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-colors group"
             >
               <div className="flex items-center gap-3">
                 <Wifi size={18} className="text-slate-400" />
                 Offline Sync
               </div>
               {pendingCount > 0 && (
                 <span className="bg-amber-100 text-amber-600 text-[10px] px-2 py-0.5 rounded-full font-black">
                   {pendingCount} PENDING
                 </span>
               )}
            </button>
            <div className="h-px bg-slate-100 my-2" />
            {sessionId ? (
              <button 
                onClick={() => { setIsCloseSessionOpen(true); setIsMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 text-sm font-semibold text-red-600 transition-colors"
              >
                <Lock size={18} />
                End Session (Close POS)
              </button>
            ) : (
              <button 
                onClick={() => { onStartSession?.(); setIsMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-emerald-50 text-sm font-semibold text-emerald-600 transition-colors"
              >
                <Play size={18} />
                Start Session
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
