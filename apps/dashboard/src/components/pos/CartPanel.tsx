'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePosCart, PosCartState } from '@/stores/pos-cart'
import { Trash2, Plus, Minus, UserIcon, Tag, CreditCard, Receipt, MoreHorizontal } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { CustomerSearch } from './CustomerSearch'
import Link from 'next/link'
import { CartItem } from '@project1/domain'
import { DiscountModal } from './DiscountModal'

export function CartPanel() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const { items, updateQty, removeItem, getTotals, customerName, clearCart, taxRate } = usePosCart(
    useShallow((s: PosCartState) => ({
      items: s.items,
      updateQty: s.updateQty,
      removeItem: s.removeItem,
      getTotals: s.getTotals,
      customerName: s.customerName,
      clearCart: s.clearCart,
      taxRate: s.taxRate
    }))
  )
  const [isDiscountOpen, setIsDiscountOpen] = useState(false)
  const [isCustomerOpen, setIsCustomerOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const totals = getTotals()

  if (!mounted) {
    return (
      <div className="flex flex-col h-full bg-slate-50 animate-pulse">
        <div className="p-4 border-b bg-white h-16" />
        <div className="flex-1" />
        <div className="p-5 border-t bg-white h-48" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200">
      {/* Header */}
      <div className="p-5 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          Current Cart
          <span className="bg-slate-100 text-slate-500 text-xs px-2.5 py-1 rounded-full font-mono">
            {items.reduce((s: number, i: CartItem) => s + i.qty, 0)} items
          </span>
        </h2>
        <button 
          onClick={clearCart}
          className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Customer / Context */}
      <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400">
            <UserIcon size={20} />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Customer</p>
            <p className="text-sm font-medium text-slate-900">{customerName || 'Walk-in Customer'}</p>
          </div>
          <button 
            onClick={() => setIsCustomerOpen(true)}
            className="text-amber-600 text-sm font-bold hover:underline"
          >
            Change
          </button>
        </div>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto px-5 py-2">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center">
              <Receipt size={32} className="opacity-20" />
            </div>
            <p className="text-center text-sm font-medium">Your cart is empty.<br/>Scan an item to begin.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {items.map((item: CartItem) => (
              <div key={`${item.productId}-${item.variantId || ''}`} className="group flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-slate-800 truncate mb-0.5 leading-tight">{item.name}</h4>
                  <p className="text-[10px] text-slate-400 font-mono mb-2 uppercase tracking-wide">{item.sku}</p>
                  
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden h-8">
                      <button 
                        onClick={() => updateQty(item.productId, item.variantId, item.qty - 1)}
                        className="px-2.5 hover:bg-slate-50 text-slate-500 transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center text-sm font-bold font-mono text-slate-900 border-x border-slate-200 bg-slate-50/50">
                        {item.qty}
                      </span>
                      <button 
                        onClick={() => updateQty(item.productId, item.variantId, item.qty + 1)}
                        className="px-2.5 hover:bg-slate-50 text-slate-500 transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <p className="text-sm font-bold text-slate-900">
                      RM {item.lineTotal.toFixed(2)}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => removeItem(item.productId, item.variantId)}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all p-1.5"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary & Checkout */}
      <div className="p-5 border-t border-slate-200 bg-white space-y-4">
        <div className="space-y-2.5">
          <div className="flex justify-between text-sm text-slate-500 font-medium tracking-tight">
            <span>Subtotal</span>
            <span className="text-slate-900">RM {totals.subtotal.toFixed(2)}</span>
          </div>
          {(totals.lineDiscounts > 0 || totals.globalDiscount > 0 || totals.pointsDiscount > 0) ? (
            <button 
              onClick={() => setIsDiscountOpen(true)}
              className="w-full flex justify-between text-sm text-amber-600 font-bold bg-amber-50 px-3 py-2 rounded-xl border border-amber-100 hover:bg-amber-100 transition-colors"
            >
              <span className="flex items-center gap-1.5"><Tag size={14} /> Total Discount</span>
              <span>- RM {(totals.lineDiscounts + totals.globalDiscount + totals.pointsDiscount).toFixed(2)}</span>
            </button>
          ) : (
            <button 
              onClick={() => setIsDiscountOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-amber-600 uppercase tracking-widest hover:underline"
            >
              <Tag size={14} /> Add Discount
            </button>
          )}
          <div className="flex justify-between text-sm text-slate-500 font-medium tracking-tight">
            <span>SST ({taxRate}%)</span>
            <span className="text-slate-900">RM {totals.tax.toFixed(2)}</span>
          </div>
          <div className="pt-4 flex justify-between items-baseline border-t border-slate-100 border-dashed">
            <span className="text-lg font-bold text-slate-900">Total</span>
            <span className="text-3xl font-black text-slate-900 tracking-tighter">
              RM {totals.total.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 pt-2">
          <button
            onClick={() => router.push('/pos/checkout')}
            disabled={items.length === 0}
            className="flex items-center justify-center gap-3 h-16 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 transition-all font-black text-lg shadow-xl shadow-slate-200 disabled:opacity-50 disabled:grayscale"
          >
             <CreditCard size={22} />
             Review & Pay
          </button>
        </div>
      </div>

      <DiscountModal isOpen={isDiscountOpen} onClose={() => setIsDiscountOpen(false)} />
      <CustomerSearch isOpen={isCustomerOpen} onClose={() => setIsCustomerOpen(false)} />
    </div>
  )
}
