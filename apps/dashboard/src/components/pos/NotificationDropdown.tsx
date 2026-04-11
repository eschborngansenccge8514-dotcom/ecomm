'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Package, CheckCircle2, ChevronRight, BellOff, Wifi } from 'lucide-react'
import { fetchPosAlerts } from '@/lib/pos-actions'
import Link from 'next/link'

interface NotificationDropdownProps {
  isOpen: boolean
  onClose: () => void
}

export function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
  const [alerts, setAlerts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      async function load() {
        setIsLoading(true)
        try {
          const data = await fetchPosAlerts()
          setAlerts(data)
        } catch (err) {
          console.error('Failed to load alerts:', err)
        } finally {
          setIsLoading(false)
        }
      }
      load()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="absolute top-16 right-6 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl p-0 overflow-hidden z-40 animate-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
          <AlertTriangle className="text-amber-500" size={14} />
          Alerts & Status
        </h3>
        <span className="bg-slate-200 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
          {alerts.length}
        </span>
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        <div className="p-2 space-y-1">
          {/* Status Alert */}
          <div className={`p-3 border rounded-xl flex items-start gap-3 mb-2 ${
            (mounted && navigator.onLine) 
              ? 'bg-emerald-50 border-emerald-100' 
              : 'bg-rose-50 border-rose-100'
          }`}>
            {(mounted && navigator.onLine) ? (
              <>
                <CheckCircle2 className="text-emerald-500 shrink-0" size={18} />
                <div>
                  <p className="text-[11px] font-black text-emerald-900 uppercase tracking-tight">System Online</p>
                  <p className="text-[10px] font-bold text-emerald-600 mt-0.5 uppercase tracking-widest">Connected to Cloud</p>
                </div>
              </>
            ) : (
              <>
                <Wifi size={18} className="text-rose-500 shrink-0" />
                <div>
                  <p className="text-[11px] font-black text-rose-900 uppercase tracking-tight">System Offline</p>
                  <p className="text-[10px] font-bold text-rose-600 mt-0.5 uppercase tracking-widest">Using Local Cache</p>
                </div>
              </>
            )}
          </div>

          {isLoading ? (
            <div className="p-4 text-center text-slate-400 animate-pulse text-xs font-bold uppercase tracking-widest">
              Checking Inventory...
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
               <BellOff size={32} className="mx-auto opacity-20 mb-3" />
               <p className="text-[10px] font-bold uppercase tracking-widest">No critical alerts</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div 
                key={alert.id}
                className="p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100 group"
              >
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                    <Package size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight truncate leading-tight">
                      {alert.name}
                    </p>
                    <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-0.5">
                      Low Stock: {alert.stock_quantity ?? 0} Left
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-900 transition-colors" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-100 bg-white">
        <Link 
          href="/dashboard/inventory"
          className="w-full h-8 flex items-center justify-center text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-900 transition-colors"
        >
          Manage All Inventory
        </Link>
      </div>
    </div>
  )
}
