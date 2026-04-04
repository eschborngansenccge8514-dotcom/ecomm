'use client'

import { useState, useEffect } from 'react'
import { WifiOff, AlertCircle, RefreshCw } from 'lucide-react'

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-red-600 text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-4 border-2 border-red-500/50 backdrop-blur-xl">
        <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center animate-pulse">
          <WifiOff size={24} />
        </div>
        <div>
          <h4 className="text-sm font-black uppercase tracking-tight leading-none">Connection Lost</h4>
          <p className="text-xs text-red-100 font-medium mt-1">POS is running in Offline Mode. Sales will sync when online.</p>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="ml-4 p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
        >
          <RefreshCw size={18} />
        </button>
      </div>
    </div>
  )
}
