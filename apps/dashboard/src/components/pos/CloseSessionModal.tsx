'use client'

import { useState } from 'react'
import { X, Lock, CheckCircle2, AlertCircle, Banknote, Loader2 } from 'lucide-react'
import { closePosSession } from '@/lib/pos-actions'
import { usePosOffline } from '@/stores/pos-offline'
import { toast } from 'react-hot-toast'
import { useRouter } from 'next/navigation'

interface CloseSessionModalProps {
  isOpen: boolean
  onClose: () => void
  sessionId: string
}

export function CloseSessionModal({ isOpen, onClose, sessionId }: CloseSessionModalProps) {
  const { pendingTransactions } = usePosOffline()
  const pendingCount = pendingTransactions.length
  const [cashCount, setCashCount] = useState<string>('0')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleEndSession = async () => {
    if (pendingCount > 0) {
      toast.error(`You have ${pendingCount} pending sales. Please sync them before closing the session.`)
      return
    }
    
    setIsSubmitting(true)
    try {
      await closePosSession(sessionId, parseFloat(cashCount) || 0)
      toast.success('Session Closed Successfully!')
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(`Error: ${err.message}`)
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300 p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl bg-rose-600 flex items-center justify-center text-white">
                <Lock size={20} />
             </div>
             <div>
                <h2 className="text-xl font-black text-rose-900 uppercase tracking-tight">End Session</h2>
                <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mt-0.5">Shift Summary & Cash Count</p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
           {pendingCount > 0 ? (
             <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex gap-3">
                <AlertCircle className="text-rose-500 shrink-0" size={20} />
                <p className="text-[11px] font-bold text-rose-900 uppercase leading-relaxed">
                  CRITICAL: You have {pendingCount} pending sales. You cannot close this session until they are synced. 
                  Go to Menu {'>'} Offline Sync to resolve.
                </p>
             </div>
           ) : (
             <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                <AlertCircle className="text-amber-500 shrink-0" size={20} />
                <p className="text-[11px] font-bold text-amber-900 uppercase leading-relaxed">
                  Closing a session will logout the current terminal. All pending syncs must be completed first.
                </p>
             </div>
           )}

           <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Banknote size={14} />
                Final Cash in Drawer (RM)
              </label>
              <input 
                type="number"
                disabled={pendingCount > 0}
                value={cashCount}
                onChange={(e) => setCashCount(e.target.value)}
                className="w-full h-14 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-900/5 focus:border-rose-900 font-bold text-2xl tracking-tighter transition-all disabled:opacity-50"
                placeholder="0.00"
              />
           </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-3">
          <button 
            onClick={handleEndSession}
            disabled={isSubmitting || pendingCount > 0}
            className="w-full h-12 bg-rose-600 text-white rounded-xl font-bold text-sm hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale"
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : <Lock size={18} />}
            {isSubmitting ? 'Closing...' : 'Close POS & Count Cash'}
          </button>
          <button 
            onClick={onClose}
            className="w-full py-2 text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors"
          >
            Cancel and Return
          </button>
        </div>
      </div>
    </div>
  )
}
