'use client'

import { useState, useEffect } from 'react'
import { X, Receipt, Clock, ChevronRight, Printer, Search } from 'lucide-react'
import { fetchPosHistory } from '@/lib/pos-actions'
import { format } from 'date-fns'
import { toast } from 'react-hot-toast'
import Link from 'next/link'

interface HistoryModalProps {
  isOpen: boolean
  onClose: () => void
  outletId: string
}

export function HistoryModal({ isOpen, onClose, outletId }: HistoryModalProps) {
  const [history, setHistory] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isOpen && outletId) {
      async function load() {
        setIsLoading(true)
        try {
          const data = await fetchPosHistory(outletId)
          setHistory(data)
        } catch (err) {
          console.error('Failed to load history:', err)
        } finally {
          setIsLoading(false)
        }
      }
      load()
    }
  }, [isOpen, outletId])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div 
        className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-500"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <Clock className="text-amber-500" size={20} />
              Recent Sales
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Last 20 transactions for this outlet</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-24 bg-white rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4 py-20">
               <Receipt size={64} strokeWidth={1} />
               <p className="font-bold text-sm">No transactions found today.</p>
            </div>
          ) : (
            history.map((txn) => (
              <div 
                key={txn.id}
                className="group bg-white p-4 rounded-2xl border border-slate-100 hover:border-slate-300 transition-all hover:shadow-lg hover:shadow-slate-200/50"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-900 uppercase tracking-tighter">
                      #{txn.receipt_number}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      {format(new Date(txn.created_at), 'hh:mm a · MMM dd')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900 tracking-tight">
                      RM {txn.total_rm.toFixed(2)}
                    </p>
                    <p className="text-[10px] font-bold text-emerald-500 uppercase">
                      {txn.payment_method}
                    </p>
                    {txn.pos_einvoice_requests?.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 text-[8px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 uppercase tracking-tighter">
                        Request Pending
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link 
                    href={`/pos/receipt/${txn.id}`}
                    className="flex-1 flex items-center justify-center gap-2 h-9 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all"
                  >
                    View Receipt
                    <ChevronRight size={14} />
                  </Link>
                  <button 
                    onClick={() => {
                      window.open(`/pos/receipt/${txn.id}`, '_blank')?.print()
                      toast.success('Sending to printer...')
                    }}
                    className="w-10 h-9 flex items-center justify-center bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white transition-all group/btn"
                  >
                    <Printer size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-white">
          <button className="w-full h-12 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
            <Search size={18} />
            Search All Records
          </button>
        </div>
      </div>
    </div>
  )
}
