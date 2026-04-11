'use client'

import { useState, useEffect } from 'react'
import { X, Lock, CheckCircle2, AlertCircle, Banknote, Loader2, BarChart3, TrendingUp, Wallet, CreditCard } from 'lucide-react'
import { closePosSession, getSessionSummary } from '@/lib/pos-actions'

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
  const [reasonNote, setReasonNote] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [summary, setSummary] = useState<any>(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(true)
  const [showZReport, setShowZReport] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (isOpen && sessionId) {
      async function fetchSummary() {
        try {
          const data = await getSessionSummary(sessionId)
          setSummary(data)
          // Pre-fill cash count with expected cash as a courtesy
          setCashCount(data.expectedCash.toFixed(2))
        } catch (err) {
          console.error('Failed to fetch session summary:', err)
        } finally {
          setIsLoadingSummary(false)
        }
      }
      fetchSummary()
    }
  }, [isOpen, sessionId])

  const handleEndSession = async () => {
    if (pendingCount > 0) {
      toast.error(`You have ${pendingCount} pending sales. Please sync them before closing the session.`)
      return
    }

    const discrepancy = (parseFloat(cashCount) || 0) - (summary?.expectedCash || 0)
    if (Math.abs(discrepancy) > 0.001 && !reasonNote.trim()) {
      toast.error('Discrepancy detected. A reason note is required.')
      return
    }
    
    setIsSubmitting(true)
    try {
      await closePosSession(sessionId, parseFloat(cashCount) || 0, reasonNote)
      toast.success('Session Closed & Batch Posted!')
      router.push('/dashboard')
      router.refresh()
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
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
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

           {isLoadingSummary ? (
             <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Loader2 className="animate-spin text-slate-300" size={32} />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Calculating Shift Totals...</p>
             </div>
           ) : summary && (
             <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-3">
                   <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Opening Cash</p>
                      <p className="text-lg font-black text-slate-900 tracking-tighter">RM {summary.openingCash.toFixed(2)}</p>
                   </div>
                   <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Cash Sales</p>
                      <p className="text-lg font-black text-emerald-600 tracking-tighter">+ RM {summary.cashSales.toFixed(2)}</p>
                   </div>
                </div>

                {/* Detailed Report */}
                <div className="space-y-3 bg-slate-900 text-white p-5 rounded-[2rem] shadow-xl shadow-slate-200">
                   <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                      <BarChart3 size={16} className="text-emerald-400" />
                      <h3 className="text-[10px] font-black uppercase tracking-widest">Expected Shift Report</h3>
                   </div>
                   
                   <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                         <div className="flex items-center gap-2">
                            <Banknote size={12} />
                            Expected Cash in Drawer
                         </div>
                         <span className="text-white">RM {summary.expectedCash.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                         <div className="flex items-center gap-2">
                            <CreditCard size={12} />
                            Card Sales
                         </div>
                         <span className="text-white">RM {summary.cardSales.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                         <div className="flex items-center gap-2">
                            <Wallet size={12} />
                            eWallet Sales
                         </div>
                         <span className="text-white">RM {summary.ewalletSales.toFixed(2)}</span>
                      </div>
                      <div className="pt-2 mt-2 border-t border-white/10 flex justify-between text-xs font-black uppercase tracking-widest text-emerald-400">
                         <span>Total Net Sales</span>
                         <span className="text-lg leading-none">RM {summary.totalSales.toFixed(2)}</span>
                      </div>
                   </div>
                </div>

                {/* Cash Entry */}
                <div className="space-y-3">
                   <div className="flex justify-between items-end">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <TrendingUp size={14} className="text-rose-600" />
                        Final Counted Cash (RM)
                      </label>
                      {parseFloat(cashCount) !== summary.expectedCash && (
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${parseFloat(cashCount) > summary.expectedCash ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                           {parseFloat(cashCount) > summary.expectedCash ? 'Overage' : 'Shortage'}: RM {Math.abs(parseFloat(cashCount) - summary.expectedCash).toFixed(2)}
                        </span>
                      )}
                   </div>
                   <input 
                     type="number"
                     disabled={pendingCount > 0}
                     value={cashCount}
                     onChange={(e) => setCashCount(e.target.value)}
                     className="w-full h-14 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-900/5 focus:border-rose-900 font-bold text-2xl tracking-tighter transition-all disabled:opacity-50"
                     placeholder="0.00"
                   />
                </div>

                {/* Discrepancy Note */}
                {Math.abs((parseFloat(cashCount) || 0) - summary.expectedCash) > 0.001 && (
                   <div className="space-y-2 animate-in slide-in-from-top duration-300">
                      <label className="text-[10px] font-black text-rose-600 uppercase tracking-widest">
                        Reconciliation Reason Note (Required)
                      </label>
                      <textarea 
                        rows={2}
                        value={reasonNote}
                        onChange={(e) => setReasonNote(e.target.value)}
                        className="w-full p-4 rounded-xl border border-rose-200 bg-rose-50/30 focus:outline-none focus:ring-2 focus:ring-rose-900/5 focus:border-rose-900 text-xs font-semibold"
                        placeholder="Explain the shortage/overage (e.g. Broken change, Error in cash in)..."
                      />
                   </div>
                )}

                {/* Z-Report Toggle */}
                <button 
                  onClick={() => setShowZReport(!showZReport)}
                  className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-slate-200 text-[10px] font-black text-slate-400 hover:text-slate-900 hover:border-slate-400 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <BarChart3 size={14} />
                  {showZReport ? 'Hide Detailed Z-Report' : 'View Detailed Z-Report (Categories/Tax)'}
                </button>

                {showZReport && (
                  <div className="space-y-4 p-5 bg-slate-50 rounded-[2rem] border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
                     <div className="space-y-3">
                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-1">Sales by Category</h4>
                        {Object.entries(summary.salesByCategory || {}).map(([cat, val]: [string, any]) => (
                          <div key={cat} className="flex justify-between items-center text-[10px] font-bold">
                             <span className="text-slate-600 uppercase">{cat}</span>
                             <span className="font-mono">RM {val.toFixed(2)}</span>
                          </div>
                        ))}
                     </div>
                     
                     <div className="space-y-3 pt-2">
                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-1">Tax & Performance</h4>
                        <div className="flex justify-between items-center text-[10px] font-bold">
                           <span className="text-slate-600 uppercase">SST (Service Tax)</span>
                           <span className="font-mono">RM {summary.totalTax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold">
                           <span className="text-slate-600 uppercase">Est. COGS</span>
                           <span className="font-mono text-rose-500">RM {summary.totalCogs.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold">
                           <span className="text-slate-600 uppercase">Gross Profit</span>
                           <span className="font-mono text-emerald-600">RM {(summary.totalSubtotal - summary.totalCogs).toFixed(2)}</span>
                        </div>
                     </div>
                  </div>
                )}
             </div>
           )}
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
