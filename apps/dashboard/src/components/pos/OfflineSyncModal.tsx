'use client'

import { useState } from 'react'
import { Wifi, X, RefreshCw, CheckCircle2, AlertCircle, ShoppingBag, ArrowUpCircle } from 'lucide-react'
import { usePosOffline, PendingTransaction } from '@/stores/pos-offline'
import { submitTransaction } from '@/lib/pos-actions'
import { format } from 'date-fns'
import { toast } from 'react-hot-toast'

interface OfflineSyncModalProps {
  isOpen: boolean
  onClose: () => void
}

export function OfflineSyncModal({ isOpen, onClose }: OfflineSyncModalProps) {
  const { pendingTransactions, updateStatus, removePending } = usePosOffline()
  const [isSyncingAll, setIsSyncingAll] = useState(false)

  const handleSyncOne = async (tx: PendingTransaction) => {
    if (tx.status === 'syncing') return
    
    updateStatus(tx.id, 'syncing')
    try {
      const result = await submitTransaction(tx.payload)
      if (result.success) {
        removePending(tx.id)
        toast.success(`Synced Receipt: ${result.receiptNumber}`)
      }
    } catch (err: any) {
      updateStatus(tx.id, 'failed', err.message || 'Sync failed')
      toast.error(`Failed to sync: ${err.message}`)
    }
  }

  const handleSyncAll = async () => {
    if (isSyncingAll || pendingTransactions.length === 0) return
    
    setIsSyncingAll(true)
    const pending = [...pendingTransactions]
    
    for (const tx of pending) {
      await handleSyncOne(tx)
    }
    
    setIsSyncingAll(false)
    if (pendingTransactions.length === 0) {
      toast.success('All transactions synced successfully!')
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300 p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white">
                <Wifi size={20} />
             </div>
             <div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Offline Sync</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  {pendingTransactions.length} Pending Sale{pendingTransactions.length !== 1 ? 's' : ''}
                </p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400"
          >
            <X size={24} />
          </button>
        </div>

        {/* Transaction List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
          {pendingTransactions.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-300 space-y-4">
               <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-emerald-500">
                  <CheckCircle2 size={40} />
               </div>
               <p className="font-bold text-sm uppercase tracking-widest text-slate-400">All caught up!</p>
            </div>
          ) : (
            pendingTransactions.map((tx) => (
              <div 
                key={tx.id}
                className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-slate-300 transition-all shadow-sm hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                    <ShoppingBag size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900 tracking-tight">
                      RM {tx.payload.totals.total.toFixed(2)}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {format(tx.timestamp, 'hh:mm a · MMM dd')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                   {tx.status === 'failed' && (
                     <div className="flex items-center gap-1 text-rose-500 bg-rose-50 px-2 py-1 rounded-lg text-[10px] font-black uppercase">
                       <AlertCircle size={12} />
                       Error
                     </div>
                   )}
                   <button 
                    onClick={() => handleSyncOne(tx)}
                    disabled={tx.status === 'syncing' || isSyncingAll}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                      ${tx.status === 'syncing' 
                        ? 'bg-slate-100 text-slate-400 animate-pulse' 
                        : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-200'}`}
                   >
                     {tx.status === 'syncing' ? <RefreshCw size={14} className="animate-spin" /> : <ArrowUpCircle size={14} />}
                     {tx.status === 'syncing' ? 'Syncing...' : 'Sync Now'}
                   </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-white">
          <button 
            onClick={handleSyncAll}
            disabled={pendingTransactions.length === 0 || isSyncingAll}
            className="w-full h-14 bg-emerald-600 text-white rounded-2xl font-black text-sm hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
          >
            {isSyncingAll ? <RefreshCw className="animate-spin" /> : <Wifi size={20} />}
            {isSyncingAll ? 'Synchronizing All Sales...' : 'Sync All Pending Sales'}
          </button>
          <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-4">
            Do not refresh this page during synchronization.
          </p>
        </div>
      </div>
    </div>
  )
}
