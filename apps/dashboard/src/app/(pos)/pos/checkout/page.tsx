'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useShallow } from 'zustand/react/shallow'
import { usePosCart, PosCartState } from '@/stores/pos-cart'
import { 
  ChevronLeft, 
  CreditCard, 
  Banknote, 
  QrCode, 
  Smartphone,
  CheckCircle2, 
  Loader2,
  Delete,
  XCircle
} from 'lucide-react'
import { submitTransaction } from '@/lib/pos-actions'
import { toast } from 'react-hot-toast'
import { CartItem } from '@project1/domain'
import { usePosOffline } from '@/stores/pos-offline'
import { usePosSettings } from '@/stores/pos-settings'

type PaymentMethod = 'cash' | 'card' | 'ewallet'

export default function CheckoutPage() {
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const { items, getTotals, outletId, sessionId, customerId, clearCart, note } = usePosCart(
    useShallow((s: PosCartState) => ({
      items: s.items,
      getTotals: s.getTotals,
      outletId: s.outletId,
      sessionId: s.sessionId,
      customerId: s.customerId,
      clearCart: s.clearCart,
      note: s.note
    }))
  )

  const { addPending, isOfflineMode } = usePosOffline()
  const { defaultPaymentMethod, quickPayAmounts } = usePosSettings()

  useEffect(() => {
    setMounted(true)
  }, [])
  const totals = getTotals()
  
  const [method, setMethod] = useState<PaymentMethod>(defaultPaymentMethod || 'cash')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [numpadValue, setNumpadValue] = useState<string>(totals.total.toFixed(2))

  const cashReceived = parseFloat(numpadValue) || 0

  useEffect(() => {
    if (mounted && items.length === 0) {
      router.replace('/pos')
    }
  }, [mounted, items.length, router])

  if (!mounted || items.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    )
  }

  const handleNumpad = (val: string) => {
    if (val === 'DEL') {
      setNumpadValue(prev => prev.length > 1 ? prev.slice(0, -1) : '0')
    } else if (val === 'CLR') {
      setNumpadValue('0')
    } else if (val === '.') {
      if (!numpadValue.includes('.')) setNumpadValue(prev => prev + '.')
    } else {
      setNumpadValue(prev => prev === '0' || prev === totals.total.toFixed(2) ? val : prev + val)
    }
  }

  const handleComplete = async () => {
    setIsSubmitting(true)
    const payload = {
      sessionId,
      outletId,
      customerId,
      items,
      paymentMethod: method,
      totals,
      cashReceived: method === 'cash' ? cashReceived : undefined,
      change: method === 'cash' ? Math.max(0, cashReceived - totals.total) : undefined,
      notes: note
    }

    try {
      if (isOfflineMode || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        throw new Error('OFFLINE')
      }

      const res = await submitTransaction(payload)
      
      toast.success('Transaction Completed!')
      clearCart()
      router.replace(`/pos/receipt/${res.txnId}`)
    } catch (err: any) {
      if (err.message === 'OFFLINE' || (typeof navigator !== 'undefined' && !navigator.onLine) || err.message?.includes('fetch')) {
        addPending(payload)
        toast.success('Offline Mode: Sale saved locally. Will sync later.', {
          icon: '📶',
          duration: 5000
        })
        clearCart()
        router.replace('/pos')
      } else {
        toast.error(`Error: ${err.message}`)
        console.error(err)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="h-16 bg-white border-b border-slate-200 flex items-center px-6 gap-4 shrink-0 shadow-sm z-10">
        <button 
          onClick={() => router.back()}
          className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 hover:text-slate-900"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Checkout Summary</h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Order Review */}
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-xl mx-auto space-y-8">
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-2xl shadow-slate-200/50 space-y-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-2 bg-emerald-500" />
              <div className="flex justify-between items-center">
                 <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Order Details</h2>
                 <span className="px-4 py-1.5 bg-slate-100 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {items.length} Items
                 </span>
              </div>
              
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {items.map((item) => (
                  <div key={`${item.productId}-${item.variantId}`} className="flex justify-between items-center text-sm group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center font-black text-slate-900 text-sm group-hover:bg-slate-900 group-hover:text-white transition-all">
                        {item.qty}
                      </div>
                      <div>
                        <p className="font-black text-slate-900 uppercase tracking-tight leading-none">{item.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">RM {item.unitPrice.toFixed(2)} / unit</p>
                      </div>
                    </div>
                    <span className="font-mono font-black text-slate-900 tracking-tighter">RM {item.lineTotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="pt-8 border-t border-slate-100 space-y-4">
                 <div className="flex justify-between text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                  <span>Subtotal</span>
                  <span>RM {totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                  <span>Tax (SST 8%)</span>
                  <span>RM {totals.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-baseline pt-4 border-t border-slate-50">
                  <span className="text-lg font-black text-slate-900 uppercase tracking-tight">Total Payable</span>
                  <span className="text-4xl font-black text-slate-900 tracking-tighter">RM {totals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4 p-6 bg-emerald-50 text-emerald-700 rounded-3xl border border-emerald-100 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-white/50 flex items-center justify-center">
                <CheckCircle2 size={28} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-tight">Loyalty Points Redemable</p>
                <p className="text-lg font-black tracking-tight">{totals.pointsEarned} Points will be earned</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Payment Methods & Numpad */}
        <div className="w-[500px] bg-white border-l border-slate-200 flex flex-col shadow-[-12px_0_40px_rgba(0,0,0,0.03)] z-10">
          <div className="p-8 flex-1 space-y-8 overflow-y-auto custom-scrollbar">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Select Method</h3>
            
            <div className="grid grid-cols-3 gap-3">
              <PaymentCard 
                active={method === 'cash'} 
                onClick={() => setMethod('cash')}
                icon={<Banknote size={24} />}
                label="Cash"
                color="emerald"
              />
              <PaymentCard 
                active={method === 'card'} 
                onClick={() => setMethod('card')}
                icon={<CreditCard size={24} />}
                label="Card"
                color="indigo"
              />
              <PaymentCard 
                active={method === 'ewallet'} 
                onClick={() => setMethod('ewallet')}
                icon={<Smartphone size={24} />}
                label="eWallet"
                color="cyan"
              />
            </div>

            {/* Contextual Flow */}
            <div className="pt-4 space-y-6">
              {method === 'cash' ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="flex justify-between items-end">
                    <h4 className="font-black text-slate-900 uppercase tracking-tight text-[11px]">Cash Entry</h4>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">RM Precise Entry</span>
                  </div>
                  
                  {/* Digital Display */}
                  <div className="p-6 bg-slate-900 rounded-3xl space-y-1 shadow-xl shadow-slate-200">
                      <p className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest">Received Amount</p>
                      <p className="text-4xl font-mono font-black text-white tracking-tighter">RM {numpadValue}</p>
                  </div>

                  {/* 3x4 Numpad */}
                  <div className="grid grid-cols-3 gap-3">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'DEL'].map((btn) => (
                      <button 
                        key={btn}
                        onClick={() => handleNumpad(btn)}
                        className={`h-14 rounded-2xl border font-black text-lg transition-all flex items-center justify-center
                          ${btn === 'DEL' 
                            ? 'bg-rose-50 border-rose-100 text-rose-500 hover:bg-rose-100' 
                            : 'bg-white border-slate-100 text-slate-700 hover:border-slate-900 hover:text-slate-900 active:scale-95'}`}
                      >
                        {btn === 'DEL' ? <Delete size={20} /> : btn}
                      </button>
                    ))}
                  </div>

                  {/* Rapid Cash Buttons */}
                  <div className="flex gap-2">
                    {quickPayAmounts.map(val => (
                      <button 
                        key={val}
                        onClick={() => setNumpadValue(val.toFixed(2))}
                        className="flex-1 h-12 rounded-xl bg-slate-50 border border-slate-100 font-black text-xs text-slate-500 hover:bg-slate-900 hover:text-white transition-all uppercase"
                      >
                        RM {val}
                      </button>
                    ))}
                    <button 
                      onClick={() => setNumpadValue(totals.total.toFixed(2))}
                      className="flex-1 h-12 rounded-xl bg-slate-900 text-white font-black text-[10px] uppercase shadow-lg shadow-slate-200"
                    >
                      Exact
                    </button>
                  </div>

                  <div className="p-6 bg-emerald-50/50 border border-emerald-100/50 rounded-[2rem] space-y-6">
                    <div className="flex justify-between items-center text-[10px] font-black text-emerald-800 uppercase tracking-widest opacity-60">
                      <span>Grand Total</span>
                      <span>RM {totals.total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-lg font-black text-emerald-900 uppercase tracking-tight">
                      <span>Change Due</span>
                      <span className="text-3xl tracking-tighter">
                        RM {Math.max(0, cashReceived - totals.total).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200 space-y-6 animate-in zoom-in-95 duration-500 text-center">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center
                    ${method === 'card' ? 'bg-indigo-100 text-indigo-600' : 'bg-cyan-100 text-cyan-600'}`}>
                    {method === 'card' ? <CreditCard size={40} /> : <QrCode size={40} />}
                  </div>
                  <div>
                    <h5 className="font-black text-slate-900 uppercase tracking-tight">Manual Payment</h5>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 max-w-[200px] leading-relaxed">
                      Confirm payment on the external terminal before completing this sale.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-8 bg-white border-t border-slate-100">
            <button
              onClick={handleComplete}
              disabled={isSubmitting || (method === 'cash' && cashReceived < totals.total)}
              className={`w-full h-16 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale
                ${method === 'cash' ? 'bg-emerald-600 shadow-emerald-100' : method === 'card' ? 'bg-indigo-600 shadow-indigo-100' : 'bg-cyan-600 shadow-cyan-100'} 
                text-white shadow-xl hover:brightness-110 active:scale-[0.98]`}
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              Complete Sale
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PaymentCard({ 
  active, 
  onClick, 
  icon, 
  label, 
  color 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string;
  color: 'emerald' | 'indigo' | 'cyan'
}) {
  const colorMap = {
    emerald: active ? 'bg-emerald-600 border-emerald-600 text-white shadow-emerald-100' : 'text-emerald-600 bg-emerald-50/50 border-emerald-50 hover:border-emerald-200',
    indigo: active ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-100' : 'text-indigo-600 bg-indigo-50/50 border-indigo-50 hover:border-indigo-200',
    cyan: active ? 'bg-cyan-600 border-cyan-600 text-white shadow-cyan-100' : 'text-cyan-600 bg-cyan-50/50 border-cyan-50 hover:border-cyan-200'
  }

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-3 p-6 rounded-[2rem] border-2 transition-all group relative overflow-hidden
        ${colorMap[color]} shadow-lg`}
    >
      {active && (
        <div className="absolute top-2 right-2 w-4 h-4 bg-white/20 rounded-full flex items-center justify-center">
           <div className="w-1.5 h-1.5 bg-white rounded-full" />
        </div>
      )}
      <div className={`p-2 rounded-xl transition-all ${active ? 'bg-white/20' : 'bg-white'}`}>
        {icon}
      </div>
      <span className={`text-[10px] font-black uppercase tracking-widest ${active ? 'text-white' : 'text-slate-400'}`}>{label}</span>
      {active && <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30" />}
    </button>
  )
}
