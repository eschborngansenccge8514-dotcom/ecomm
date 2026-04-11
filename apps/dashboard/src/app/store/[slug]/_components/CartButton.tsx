'use client'

import { useState } from 'react'
import { useCart } from './CartContext'

export function CartButton() {
  const { count, items, total, remove } = useCart()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white font-bold rounded-full shadow-lg shadow-[var(--color-primary)]/30 hover:opacity-90 transition-opacity"
      >
        <span className="text-lg">🛒</span>
        <span className="text-sm">Cart</span>
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white text-[var(--color-primary)] text-[10px] font-black rounded-full flex items-center justify-center shadow">
            {count}
          </span>
        )}
      </button>

      {/* Drawer overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-sm bg-white h-full flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-black text-[var(--color-text)]">Your Cart</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {items.length === 0 ? (
                <p className="text-center text-gray-400 mt-12 text-sm">Your cart is empty</p>
              ) : (
                items.map(item => (
                  <div key={item.id} className="flex items-center gap-4">
                    {item.image && (
                      <img src={item.image} alt={item.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-[var(--color-text)] truncate">{item.name}</p>
                      <p className="text-xs text-gray-500">x{item.quantity} · RM {(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                    <button onClick={() => remove(item.id)} className="text-gray-300 hover:text-red-400 text-lg transition-colors">&times;</button>
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="px-6 py-4 border-t space-y-3">
                <div className="flex justify-between text-sm font-bold text-[var(--color-text)]">
                  <span>Total</span>
                  <span className="text-[var(--color-primary)]">RM {total.toFixed(2)}</span>
                </div>
                <button className="w-full py-3 bg-[var(--color-primary)] text-white font-black rounded-xl shadow-lg shadow-[var(--color-primary)]/25 hover:opacity-90 transition-opacity">
                  Checkout
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
