'use client'

import { useState } from 'react'
import { X, Play, Banknote, Loader2 } from 'lucide-react'
import { openPosSession } from '@/lib/pos-actions'
import { toast } from 'react-hot-toast'

interface StartSessionModalProps {
  isOpen: boolean
  outletId: string
  onSuccess: (sessionId: string) => void
  onClose?: () => void
}

export function StartSessionModal({ isOpen, outletId, onSuccess, onClose }: StartSessionModalProps) {
  const [openingCash, setOpeningCash] = useState<string>('0')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleStartSession = async () => {
    setIsSubmitting(true)
    const amount = parseFloat(openingCash) || 0
    
    // We close the modal immediately for a 'snappy' feel
    // and handle the success/error via toasts
    try {
      toast.promise(
        openPosSession(outletId, amount).then(res => {
          onSuccess(res.sessionId)
          return res
        }),
        {
          loading: 'Opening session...',
          success: 'Session Started!',
          error: (err) => `Failed: ${err.message}`
        }
      )
      onClose?.()
    } catch (err: any) {
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
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white">
                <Play size={20} className="ml-1" />
             </div>
             <div>
                <h2 className="text-xl font-black text-emerald-900 uppercase tracking-tight">Open Session</h2>
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mt-0.5">Start New POS Shift</p>
             </div>
          </div>
          {onClose && (
            <button 
              onClick={onClose}
              className="p-2 hover:bg-emerald-100/50 rounded-xl transition-colors text-emerald-600"
            >
              <X size={24} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
           <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Banknote size={14} />
                Opening Cash in Drawer (RM)
              </label>
              <input 
                type="number"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                className="w-full h-14 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-900/5 focus:border-emerald-900 font-bold text-2xl tracking-tighter transition-all"
                placeholder="0.00"
                autoFocus
              />
              <p className="text-[10px] font-medium text-slate-400 leading-relaxed italic">
                Enter the amount of cash currently in the register before starting sales.
              </p>
           </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-100">
          <button 
            onClick={handleStartSession}
            disabled={isSubmitting}
            className="w-full h-12 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : <Play size={18} className="ml-0.5" />}
            {isSubmitting ? 'Opening...' : 'Start Session'}
          </button>
        </div>
      </div>
    </div>
  )
}
