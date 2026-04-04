'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { Cart, CartItem, PosProduct, CartTotals, calcCartTotals } from '@project1/domain'

export interface PosCartState extends Cart {
  // Actions
  addItem: (product: PosProduct) => void
  removeItem: (productId: string, variantId?: string) => void
  updateQty: (productId: string, variantId: string | undefined, qty: number) => void
  setDiscount: (discountRm: number) => void
  setCustomer: (id?: string, name?: string, phone?: string) => void
  setPoints: (points: number) => void
  setNote: (note: string) => void
  setSession: (outletId: string, sessionId: string) => void
  clearCart: () => void
  
  // Computed
  getTotals: () => CartTotals
}

export const usePosCart = create<PosCartState>()(
  persist(
    immer((set, get) => ({
      items: [],
      globalDiscountRm: 0,
      pointsToRedeem: 0,
      note: '',
      outletId: '',
      sessionId: '',

      addItem: (product: PosProduct) => {
        set((state: PosCartState) => {
          const existing = state.items.find(
            (i: CartItem) => i.productId === product.id && i.variantId === product.variantId
          )
          if (existing) {
            existing.qty += 1
            existing.lineTotal = existing.qty * (existing.unitPrice - existing.discountRm)
          } else {
            state.items.push({
              productId: product.id,
              variantId: product.variantId,
              name: product.name,
              sku: product.sku,
              unitPrice: product.unitPrice,
              qty: 1,
              discountRm: 0,
              lineTotal: product.unitPrice
            })
          }
        })
      },

      removeItem: (productId: string, variantId?: string) => {
        set((state: PosCartState) => {
          state.items = state.items.filter(
            (i: CartItem) => !(i.productId === productId && i.variantId === variantId)
          )
        })
      },

      updateQty: (productId: string, variantId: string | undefined, qty: number) => {
        set((state: PosCartState) => {
          const item = state.items.find(
            (i: CartItem) => i.productId === productId && i.variantId === variantId
          )
          if (item) {
            item.qty = Math.max(0, qty)
            item.lineTotal = item.qty * (item.unitPrice - item.discountRm)
            if (item.qty === 0) {
              state.items = state.items.filter((i: CartItem) => i !== item)
            }
          }
        })
      },

      setDiscount: (discount: number) => set({ globalDiscountRm: discount }),
      setCustomer: (id?: string, name?: string, phone?: string) => set({ customerId: id, customerName: name, customerPhone: phone }),
      setPoints: (points: number) => set({ pointsToRedeem: points }),
      setNote: (note: string) => set({ note }),
      setSession: (outletId: string, sessionId: string) => set({ outletId, sessionId }),
      clearCart: () => set({ items: [], globalDiscountRm: 0, pointsToRedeem: 0, note: '', customerId: undefined, customerName: undefined, customerPhone: undefined }),

      getTotals: () => {
        const state = get()
        return calcCartTotals(state)
      }
    })),
    {
      name: 'pos-cart-storage',
    }
  )
)
