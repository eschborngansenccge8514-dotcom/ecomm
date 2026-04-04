'use client'

import { useState } from 'react'
import { X, Tag, Percent, Banknote } from 'lucide-react'
import { usePosCart } from '@/stores/pos-cart'

interface DiscountModalProps {
  isOpen: boolean
  onClose: () => void
}

export function DiscountModal({ isOpen, onClose }: DiscountModalProps) {
  const { globalDiscountRm, setDiscount, getTotals } = usePosCart()
  const [type, setType] = useState<'amount' | 'percent'>('amount')
  const [value, setValue] = useState(globalDiscountRm.toString())
  
  if (!isOpen) return null

  const subtotal = getTotals().subtotal

  const handleApply = () => {
    let amount = parseFloat(value) || 0
    if (type === 'percent') {
      amount = (subtotal * amount) / 100
    }
    setDiscount(amount)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <Tag size={24} className="text-amber-500" />
            Apply Discount
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-8">
          <div className="flex p-1 bg-slate-100 rounded-2xl">
            <button 
              onClick={() => setType('amount')}
              className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-bold transition-all
                ${type === 'amount' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Banknote size={18} />
              Fixed Amount
            </button>
            <button 
              onClick={() => setType('percent')}
              className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-bold transition-all
                ${type === 'percent' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Percent size={18} />
              Percentage
            </button>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">
                {type === 'amount' ? 'RM' : '%'}
              </span>
              <input 
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
                className="w-full h-20 pl-16 pr-8 text-4xl font-black text-slate-900 bg-slate-50 border-2 border-transparent focus:border-slate-900 focus:bg-white rounded-3xl transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="0.00"
              />
            </div>
            
            <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest px-2">
              <span>Cart Subtotal</span>
              <span>RM {subtotal.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-2">
            {[5, 10, 15, 20].map(val => (
              <button 
                key={val}
                onClick={() => {
                  setType('percent')
                  setValue(val.toString())
                }}
                className="h-10 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all"
              >
                {val}% OFF
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 h-14 rounded-2xl border border-slate-200 bg-white font-bold text-slate-600 hover:bg-slate-100 transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleApply}
            className="flex-[2] h-14 rounded-2xl bg-slate-900 text-white font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
          >
            Apply Discount
          </button>
        </div>
      </div>
    </div>
  )
}
