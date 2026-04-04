'use client'

import { useState, useEffect } from 'react'
import { Printer, X, Receipt, CheckCircle2, MoreHorizontal, Settings, ExternalLink } from 'lucide-react'
import { fetchPosHistory } from '@/lib/pos-actions'
import { toast } from 'react-hot-toast'
import Link from 'next/link'

interface PrinterModalProps {
  isOpen: boolean
  onClose: () => void
  outletId: string
}

export function PrinterModal({ isOpen, onClose, outletId }: PrinterModalProps) {
  const [lastTxn, setLastTxn] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen && outletId) {
      async function load() {
        setIsLoading(true)
        try {
          const history = await fetchPosHistory(outletId)
          if (history && history.length > 0) {
            setLastTxn(history[0])
          }
        } catch (err) {
          console.error('Failed to load last transaction:', err)
        } finally {
          setIsLoading(false)
        }
      }
      load()
    }
  }, [isOpen, outletId])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <Printer size={20} className="text-amber-500" />
            Printer Actions
          </h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Last Sale Overview */}
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 group">
             <div className="flex justify-between items-start mb-4">
               <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Last Sale</p>
                 {isLoading ? (
                   <div className="h-4 w-24 bg-slate-200 animate-pulse rounded" />
                 ) : lastTxn ? (
                   <p className="text-sm font-black text-slate-900 uppercase tracking-tighter">#{lastTxn.receipt_number}</p>
                 ) : (
                   <p className="text-sm font-bold text-slate-300 uppercase">No recent sales</p>
                 )}
               </div>
               <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                 <CheckCircle2 size={16} />
               </div>
             </div>

             <div className="flex gap-2">
               {lastTxn ? (
                 <Link 
                   href={`/pos/receipt/${lastTxn.id}`}
                   className="flex-1 h-10 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                   onClick={onClose}
                 >
                   <Receipt size={14} />
                   Reprint Receipt
                 </Link>
               ) : (
                 <button disabled className="flex-1 h-10 bg-slate-200 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 opacity-50 cursor-not-allowed">
                   <Receipt size={14} />
                   Reprint Receipt
                 </button>
               )}
               <button className="w-10 h-10 bg-white border border-slate-200 text-slate-500 rounded-xl flex items-center justify-center hover:border-slate-400 transition-colors">
                  <MoreHorizontal size={18} />
               </button>
             </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-1">
             <button 
              onClick={() => {
                if (lastTxn) {
                  window.open(`/pos/receipt/${lastTxn.id}`, '_blank')?.print()
                } else {
                  toast.error('No recent transaction to print')
                }
              }}
              className="w-full h-12 flex items-center gap-3 px-4 rounded-xl hover:bg-slate-50 transition-colors text-sm font-bold text-slate-700"
             >
               <Settings size={18} className="text-slate-400" />
               Select Network Printer
             </button>
             <button 
              onClick={() => window.print()}
              className="w-full h-12 flex items-center gap-3 px-4 rounded-xl hover:bg-slate-50 transition-colors text-sm font-bold text-slate-700"
             >
               <ExternalLink size={18} className="text-slate-400" />
               Browser Print Dialog (PDF)
             </button>
          </div>
        </div>

        <div className="p-5 bg-slate-50 border-t border-slate-100 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Default: System Thermal (80mm)</p>
        </div>
      </div>
    </div>
  )
}
