<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# We need the POS in the merchant dashboard web also

Here is the complete Web POS implementation plan for `apps/dashboard`.

***

# Web POS — Merchant Dashboard Integration

The web POS lives at `/pos` inside `apps/dashboard` as a **dedicated full-screen layout**, completely separate from the regular dashboard chrome. It shares all Supabase tables, Edge Functions, and domain types introduced in the mobile POS plan — zero duplication of backend code.

***

## Route \& Layout Architecture

```
apps/dashboard/app/
└── (pos)/                         ← separate root layout, no sidebar/topbar
    ├── layout.tsx                 ← full-screen POS shell
    ├── pos/
    │   ├── page.tsx               ← main POS screen
    │   ├── checkout/
    │   │   └── page.tsx           ← payment screen
    │   └── receipt/
    │       └── [txId]/
    │           └── page.tsx       ← receipt screen
    └── pos-sessions/
        └── page.tsx               ← open/close shift, session summary
```

The `(pos)` route group uses its own layout with **no** sidebar, topbar, or breadcrumbs — a clean full-screen interface optimised for both desktop and tablet countertop use.

**`apps/dashboard/app/(pos)/layout.tsx`:**

```tsx
import type { ReactNode } from 'react'
import { redirect }       from 'next/navigation'
import { createClient }   from '@/lib/supabase/server'

export default async function PosLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    // Full-screen, no overflow, fixed viewport — critical for POS UX
    <html lang="en">
      <body className="h-screen w-screen overflow-hidden bg-[var(--color-bg)]
                       text-[var(--color-text)] antialiased">
        {children}
      </body>
    </html>
  )
}
```


***

## Step 1 — Shared Domain Types

Create `packages/domain/src/pos.ts` — shared between web and mobile:

```typescript
export interface PosProduct {
  id:         string
  variantId?: string
  name:       string
  sku:        string
  barcode?:   string
  unitPrice:  number
  costPrice?: number
  imageUrl?:  string
  category:   string
  stockQty:   number   // qty_available at current outlet location
}

export interface CartItem {
  productId:  string
  variantId?: string
  name:       string
  sku:        string
  unitPrice:  number
  qty:        number
  discountRm: number   // per-line flat discount
  lineTotal:  number
}

export interface Cart {
  items:           CartItem[]
  globalDiscountRm: number
  customerId?:     string
  customerName?:   string
  customerPhone?:  string
  pointsToRedeem:  number
  note:            string
  outletId:        string
  sessionId:       string
}

export interface CartTotals {
  subtotal:        number
  lineDiscounts:   number
  globalDiscount:  number
  pointsDiscount:  number
  taxableAmount:   number
  tax:             number   // SST 8%
  total:           number
  pointsEarned:    number   // awarded after sale
}

export function calcCartTotals(cart: Cart, pointsRate = 1): CartTotals {
  const subtotal      = cart.items.reduce((s, i) => s + i.lineTotal, 0)
  const lineDiscounts = cart.items.reduce((s, i) => s + i.discountRm, 0)
  const globalDiscount = cart.globalDiscountRm
  const pointsDiscount = cart.pointsToRedeem * 0.01   // 1 pt = RM0.01
  const taxableAmount  = Math.max(0, subtotal - lineDiscounts - globalDiscount - pointsDiscount)
  const tax            = taxableAmount * 0.08
  const total          = taxableAmount + tax
  const pointsEarned   = Math.floor(total * pointsRate)
  return { subtotal, lineDiscounts, globalDiscount, pointsDiscount,
           taxableAmount, tax, total, pointsEarned }
}
```


***

## Step 2 — Web Cart Store (Zustand + localStorage)

Web uses Zustand with a `persist` middleware backed by `localStorage` (no MMKV on web). The offline queue uses `IndexedDB` via `idb-keyval`.

**`apps/dashboard/stores/pos-cart.ts`:**

```typescript
import { create }     from 'zustand'
import { persist }    from 'zustand/middleware'
import { immer }      from 'zustand/middleware/immer'
import { calcCartTotals } from '@repo/domain/pos'
import type { Cart, CartItem, CartTotals } from '@repo/domain/pos'

interface CartState {
  cart:     Cart
  totals:   CartTotals
  // Actions
  addItem:             (product: Omit<CartItem, 'qty' | 'discountRm' | 'lineTotal'>) => void
  updateQty:           (idx: number, qty: number) => void
  removeItem:          (idx: number) => void
  applyLineDiscount:   (idx: number, discountRm: number) => void
  applyGlobalDiscount: (discountRm: number) => void
  setCustomer:         (id: string, name: string, phone: string) => void
  setPointsToRedeem:   (pts: number) => void
  setNote:             (note: string) => void
  clearCart:           () => void
  initSession:         (outletId: string, sessionId: string) => void
}

const EMPTY_CART = (outletId = '', sessionId = ''): Cart => ({
  items: [], globalDiscountRm: 0, pointsToRedeem: 0,
  note: '', outletId, sessionId
})

function recompute(cart: Cart): CartTotals {
  return calcCartTotals(cart)
}

export const usePosCart = create<CartState>()(
  persist(
    immer((set, get) => ({
      cart:   EMPTY_CART(),
      totals: calcCartTotals(EMPTY_CART()),

      addItem(product) {
        set(state => {
          const idx = state.cart.items.findIndex(i =>
            i.productId === product.productId && i.variantId === product.variantId
          )
          if (idx >= 0) {
            state.cart.items[idx].qty++
            state.cart.items[idx].lineTotal =
              (state.cart.items[idx].unitPrice - state.cart.items[idx].discountRm) *
              state.cart.items[idx].qty
          } else {
            state.cart.items.push({
              ...product, qty: 1, discountRm: 0, lineTotal: product.unitPrice
            })
          }
          state.totals = recompute(state.cart)
        })
      },

      updateQty(idx, qty) {
        set(state => {
          if (qty <= 0) { state.cart.items.splice(idx, 1) }
          else {
            state.cart.items[idx].qty = qty
            state.cart.items[idx].lineTotal =
              (state.cart.items[idx].unitPrice - state.cart.items[idx].discountRm) * qty
          }
          state.totals = recompute(state.cart)
        })
      },

      removeItem(idx) {
        set(state => {
          state.cart.items.splice(idx, 1)
          state.totals = recompute(state.cart)
        })
      },

      applyLineDiscount(idx, discountRm) {
        set(state => {
          state.cart.items[idx].discountRm = discountRm
          state.cart.items[idx].lineTotal =
            (state.cart.items[idx].unitPrice - discountRm) * state.cart.items[idx].qty
          state.totals = recompute(state.cart)
        })
      },

      applyGlobalDiscount(discountRm) {
        set(state => {
          state.cart.globalDiscountRm = discountRm
          state.totals = recompute(state.cart)
        })
      },

      setCustomer(id, name, phone) {
        set(state => { state.cart.customerId = id; state.cart.customerName = name; state.cart.customerPhone = phone })
      },

      setPointsToRedeem(pts) {
        set(state => { state.cart.pointsToRedeem = pts; state.totals = recompute(state.cart) })
      },

      setNote(note) { set(state => { state.cart.note = note }) },

      clearCart() {
        const { outletId, sessionId } = get().cart
        set(state => {
          state.cart   = EMPTY_CART(outletId, sessionId)
          state.totals = calcCartTotals(state.cart)
        })
      },

      initSession(outletId, sessionId) {
        set(state => {
          state.cart.outletId  = outletId
          state.cart.sessionId = sessionId
        })
      }
    })),
    {
      name:    'pos-cart',
      // Only persist cart — totals are recomputed from cart
      partialize: (s) => ({ cart: s.cart })
    }
  )
)
```


***

## Step 3 — Main POS Page

**`apps/dashboard/app/(pos)/pos/page.tsx`:**

```tsx
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePosCart }      from '@/stores/pos-cart'
import { ProductGrid }     from '@/components/pos/web/ProductGrid'
import { CartPanel }       from '@/components/pos/web/CartPanel'
import { CustomerSearch }  from '@/components/pos/web/CustomerSearch'
import { BarcodeListener } from '@/components/pos/web/BarcodeListener'
import { PosTopBar }       from '@/components/pos/web/PosTopBar'
import { AgentDrawer }     from '@/components/pos/web/AgentDrawer'
import { OfflineBanner }   from '@/components/pos/web/OfflineBanner'
import { useProducts }     from '@/hooks/pos/useProducts'
import type { PosProduct } from '@repo/domain/pos'

export default function PosPage() {
  const router   = useRouter()
  const cartStore = usePosCart()

  const [search,       setSearch]       = useState('')
  const [activeCategory, setCategory]  = useState<string | null>(null)
  const [agentOpen,    setAgentOpen]    = useState(false)
  const [customerOpen, setCustomerOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const { products, categories, isLoading } = useProducts({ search, category: activeCategory })

  // Global keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // F2 — focus search
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus() }
      // F4 — open customer lookup
      if (e.key === 'F4') { e.preventDefault(); setCustomerOpen(true) }
      // F8 — open agent
      if (e.key === 'F8') { e.preventDefault(); setAgentOpen(true) }
      // F12 — go to checkout
      if (e.key === 'F12' && cartStore.cart.items.length > 0) {
        e.preventDefault(); router.push('/pos/checkout')
      }
      // Escape — clear search
      if (e.key === 'Escape') setSearch('')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cartStore.cart.items.length])

  const handleAddProduct = useCallback((product: PosProduct) => {
    cartStore.addItem({
      productId:  product.id,
      variantId:  product.variantId,
      name:       product.name,
      sku:        product.sku,
      unitPrice:  product.unitPrice
    })
  }, [])

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <OfflineBanner />
      <PosTopBar onAgentOpen={() => setAgentOpen(true)} />

      {/* Barcode listener — captures USB/Bluetooth scanner input globally */}
      <BarcodeListener onScanned={barcode => setSearch(barcode)} />

      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT PANEL: Product Browser ─────────────────── */}
        <div className="flex flex-col flex-1 overflow-hidden border-r
                        border-[var(--color-border)]">

          {/* Search bar */}
          <div className="flex items-center gap-2 px-4 py-3
                          border-b border-[var(--color-border)]
                          bg-[var(--color-surface)]">
            <div className="relative flex-1">
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search product, SKU, or scan barcode… (F2)"
                className="w-full bg-[var(--color-surface-offset)] rounded-lg
                           px-4 py-2.5 text-sm pl-10
                           border border-[var(--color-border)]
                           focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2
                               text-[var(--color-text-muted)] text-sm">🔍</span>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2
                             text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
                >✕</button>
              )}
            </div>
            <kbd className="hidden md:flex items-center gap-1 px-2 py-1
                            rounded text-xs bg-[var(--color-surface-offset-2)]
                            text-[var(--color-text-muted)] border
                            border-[var(--color-border)]">
              F2
            </kbd>
          </div>

          {/* Category tabs */}
          <div className="flex gap-2 px-4 py-2 overflow-x-auto
                          border-b border-[var(--color-border)]
                          bg-[var(--color-surface)] scrollbar-none">
            <button
              onClick={() => setCategory(null)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium
                          transition-colors ${!activeCategory
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-surface-offset)] text-[var(--color-text-muted)]'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id === activeCategory ? null : cat.id)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium
                            transition-colors ${activeCategory === cat.id
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-surface-offset)] text-[var(--color-text-muted)]'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Product grid — scrollable */}
          <div className="flex-1 overflow-y-auto p-4">
            <ProductGrid
              products={products}
              isLoading={isLoading}
              onSelect={handleAddProduct}
            />
          </div>
        </div>

        {/* ── RIGHT PANEL: Cart ────────────────────────────── */}
        <CartPanel
          cart={cartStore.cart}
          totals={cartStore.totals}
          onUpdateQty={cartStore.updateQty}
          onRemoveItem={cartStore.removeItem}
          onApplyLineDiscount={cartStore.applyLineDiscount}
          onApplyGlobalDiscount={cartStore.applyGlobalDiscount}
          onOpenCustomer={() => setCustomerOpen(true)}
          onClearCart={cartStore.clearCart}
          onCheckout={() => router.push('/pos/checkout')}
        />
      </div>

      {/* Customer lookup panel */}
      {customerOpen && (
        <CustomerSearch
          onSelect={(id, name, phone) => {
            cartStore.setCustomer(id, name, phone)
            setCustomerOpen(false)
          }}
          onClose={() => setCustomerOpen(false)}
        />
      )}

      {/* MerchantMind agent drawer */}
      <AgentDrawer open={agentOpen} onClose={() => setAgentOpen(false)} />
    </div>
  )
}
```


***

## Step 4 — Product Grid Component

**`apps/dashboard/components/pos/web/ProductGrid.tsx`:**

```tsx
'use client'
import Image from 'next/image'
import type { PosProduct } from '@repo/domain/pos'

interface Props {
  products:  PosProduct[]
  isLoading: boolean
  onSelect:  (p: PosProduct) => void
}

export function ProductGrid({ products, isLoading, onSelect }: Props) {
  if (isLoading) return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} className="skeleton aspect-square rounded-xl" />
      ))}
    </div>
  )

  if (products.length === 0) return (
    <div className="flex flex-col items-center justify-center h-64
                    text-[var(--color-text-faint)] gap-3">
      <span className="text-4xl">📦</span>
      <p className="text-sm">No products found</p>
    </div>
  )

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {products.map(product => (
        <button
          key={`${product.id}-${product.variantId}`}
          onClick={() => onSelect(product)}
          disabled={product.stockQty <= 0}
          className={`
            group relative flex flex-col rounded-xl overflow-hidden
            border border-[var(--color-border)]
            bg-[var(--color-surface)] text-left
            transition-all duration-150
            hover:border-[var(--color-primary)] hover:shadow-md
            active:scale-[0.97]
            disabled:opacity-40 disabled:cursor-not-allowed
            focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
          `}
        >
          {/* Product image */}
          <div className="relative aspect-square w-full overflow-hidden
                          bg-[var(--color-surface-offset)]">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill className="object-cover
                               group-hover:scale-105 transition-transform duration-200"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center
                              text-3xl text-[var(--color-text-faint)]">
                📦
              </div>
            )}

            {/* Out of stock badge */}
            {product.stockQty <= 0 && (
              <div className="absolute inset-0 bg-black/40 flex items-center
                              justify-center">
                <span className="text-white text-xs font-semibold
                                 bg-black/60 px-2 py-0.5 rounded">
                  Out of stock
                </span>
              </div>
            )}

            {/* Low stock warning */}
            {product.stockQty > 0 && product.stockQty <= 5 && (
              <div className="absolute top-1.5 right-1.5">
                <span className="bg-yellow-400 text-yellow-900 text-[10px]
                                 font-bold px-1.5 py-0.5 rounded-full">
                  {product.stockQty} left
                </span>
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="p-2.5 space-y-0.5">
            <p className="text-xs font-medium text-[var(--color-text)]
                          line-clamp-2 leading-tight">
              {product.name}
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              {product.sku}
            </p>
            <p className="text-sm font-bold text-[var(--color-primary)] mt-1">
              RM{product.unitPrice.toFixed(2)}
            </p>
          </div>

          {/* Add to cart hover overlay */}
          <div className="absolute inset-0 bg-[var(--color-primary)]/0
                          group-hover:bg-[var(--color-primary)]/5
                          transition-colors pointer-events-none rounded-xl" />
        </button>
      ))}
    </div>
  )
}
```


***

## Step 5 — Cart Panel

**`apps/dashboard/components/pos/web/CartPanel.tsx`:**

```tsx
'use client'
import { useState } from 'react'
import type { Cart, CartTotals } from '@repo/domain/pos'
import { NumpadModal }     from './NumpadModal'
import { DiscountModal }   from './DiscountModal'

interface Props {
  cart:                 Cart
  totals:               CartTotals
  onUpdateQty:          (idx: number, qty: number)        => void
  onRemoveItem:         (idx: number)                     => void
  onApplyLineDiscount:  (idx: number, discountRm: number) => void
  onApplyGlobalDiscount:(discountRm: number)              => void
  onOpenCustomer:       ()                                => void
  onClearCart:          ()                                => void
  onCheckout:           ()                                => void
}

export function CartPanel({
  cart, totals,
  onUpdateQty, onRemoveItem, onApplyLineDiscount, onApplyGlobalDiscount,
  onOpenCustomer, onClearCart, onCheckout
}: Props) {
  const [numpadItem,   setNumpadItem]   = useState<number | null>(null)
  const [discountItem, setDiscountItem] = useState<number | 'global' | null>(null)

  return (
    <div className="w-[380px] flex flex-col bg-[var(--color-surface)]
                    border-l border-[var(--color-border)]">

      {/* Cart header */}
      <div className="flex items-center justify-between px-4 py-3
                      border-b border-[var(--color-border)]">
        <div>
          <h2 className="text-sm font-semibold">Cart</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            {cart.items.length} {cart.items.length === 1 ? 'item' : 'items'}
          </p>
        </div>
        <div className="flex gap-2">
          {/* Customer button */}
          <button
            onClick={onOpenCustomer}
            className={`text-xs px-3 py-1.5 rounded-lg border
                        transition-colors ${cart.customerId
              ? 'bg-[var(--color-primary-highlight)] border-[var(--color-primary)]
                 text-[var(--color-primary)]'
              : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
            }`}
          >
            {cart.customerName ?? '+ Customer'} <kbd className="opacity-50">F4</kbd>
          </button>
          {/* Clear cart */}
          {cart.items.length > 0 && (
            <button
              onClick={onClearCart}
              className="text-xs px-2 py-1.5 rounded-lg text-[var(--color-error)]
                         hover:bg-[var(--color-error-highlight)] transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Cart items — scrollable */}
      <div className="flex-1 overflow-y-auto">
        {cart.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full
                          text-[var(--color-text-faint)] gap-3 p-8">
            <span className="text-4xl">🛒</span>
            <p className="text-sm text-center">
              Add products from the left panel or scan a barcode
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-divider)]">
            {cart.items.map((item, idx) => (
              <li key={`${item.productId}-${item.variantId}-${idx}`}
                  className="flex items-start gap-3 px-4 py-3 group">

                {/* Qty control */}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <button
                    onClick={() => onUpdateQty(idx, item.qty - 1)}
                    className="w-6 h-6 rounded-md bg-[var(--color-surface-offset)]
                               flex items-center justify-center text-sm
                               hover:bg-[var(--color-surface-dynamic)] transition-colors"
                  >−</button>
                  <button
                    onClick={() => setNumpadItem(idx)}
                    className="w-8 h-6 rounded-md bg-[var(--color-surface-offset)]
                               flex items-center justify-center text-sm font-medium
                               hover:bg-[var(--color-surface-dynamic)] transition-colors"
                  >
                    {item.qty}
                  </button>
                  <button
                    onClick={() => onUpdateQty(idx, item.qty + 1)}
                    className="w-6 h-6 rounded-md bg-[var(--color-surface-offset)]
                               flex items-center justify-center text-sm
                               hover:bg-[var(--color-surface-dynamic)] transition-colors"
                  >+</button>
                </div>

                {/* Item details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)] truncate">
                    {item.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-[var(--color-text-muted)]">
                      RM{item.unitPrice.toFixed(2)} each
                    </span>
                    {item.discountRm > 0 && (
                      <span className="text-xs text-green-600">
                        −RM{item.discountRm.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Line total + actions */}
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-semibold">
                    RM{item.lineTotal.toFixed(2)}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100
                                  transition-opacity">
                    <button
                      onClick={() => setDiscountItem(idx)}
                      className="text-[10px] px-1.5 py-0.5 rounded
                                 text-[var(--color-text-muted)]
                                 hover:bg-[var(--color-surface-offset)] transition-colors"
                    >
                      %disc
                    </button>
                    <button
                      onClick={() => onRemoveItem(idx)}
                      className="text-[10px] px-1.5 py-0.5 rounded
                                 text-[var(--color-error)]
                                 hover:bg-[var(--color-error-highlight)] transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Totals & checkout */}
      <div className="border-t border-[var(--color-border)] p-4 space-y-3">
        {/* Totals breakdown */}
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-[var(--color-text-muted)]">
            <span>Subtotal</span>
            <span>RM{totals.subtotal.toFixed(2)}</span>
          </div>
          {(totals.lineDiscounts + totals.globalDiscount) > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>−RM{(totals.lineDiscounts + totals.globalDiscount).toFixed(2)}</span>
            </div>
          )}
          {totals.pointsDiscount > 0 && (
            <div className="flex justify-between text-[var(--color-primary)]">
              <span>Points ({cart.pointsToRedeem} pts)</span>
              <span>−RM{totals.pointsDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-[var(--color-text-muted)]">
            <span>SST (8%)</span>
            <span>RM{totals.tax.toFixed(2)}</span>
          </div>

          {/* Global discount trigger */}
          <button
            onClick={() => setDiscountItem('global')}
            className="w-full text-left text-xs text-[var(--color-primary)]
                       hover:underline"
          >
            + Apply order discount
          </button>
        </div>

        {/* Total row */}
        <div className="flex justify-between items-center py-2
                        border-t border-[var(--color-border)]">
          <span className="font-bold text-base">Total</span>
          <span className="font-bold text-xl text-[var(--color-primary)]">
            RM{totals.total.toFixed(2)}
          </span>
        </div>

        {/* Checkout button */}
        <button
          onClick={onCheckout}
          disabled={cart.items.length === 0}
          className="w-full py-3.5 rounded-xl bg-[var(--color-primary)]
                     text-white font-semibold text-base
                     hover:bg-[var(--color-primary-hover)]
                     disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors active:scale-[0.98]"
        >
          Charge  RM{totals.total.toFixed(2)}
          <span className="ml-2 text-sm opacity-70">(F12)</span>
        </button>
      </div>

      {/* Numpad modal for qty editing */}
      {numpadItem !== null && (
        <NumpadModal
          title="Edit Quantity"
          initialValue={cart.items[numpadItem].qty}
          onConfirm={qty => { onUpdateQty(numpadItem, qty); setNumpadItem(null) }}
          onClose={() => setNumpadItem(null)}
        />
      )}

      {/* Discount modal */}
      {discountItem !== null && (
        <DiscountModal
          title={discountItem === 'global' ? 'Order Discount' : `Discount — ${cart.items[discountItem as number].name}`}
          maxValue={discountItem === 'global' ? totals.subtotal : cart.items[discountItem as number].lineTotal}
          onConfirm={discountRm => {
            if (discountItem === 'global') onApplyGlobalDiscount(discountRm)
            else onApplyLineDiscount(discountItem as number, discountRm)
            setDiscountItem(null)
          }}
          onClose={() => setDiscountItem(null)}
        />
      )}
    </div>
  )
}
```


***

## Step 6 — Numpad \& Discount Modals

**`apps/dashboard/components/pos/web/NumpadModal.tsx`:**

```tsx
'use client'
import { useState, useEffect } from 'react'

interface Props {
  title:        string
  initialValue: number
  onConfirm:    (value: number) => void
  onClose:      () => void
}

export function NumpadModal({ title, initialValue, onConfirm, onClose }: Props) {
  const [display, setDisplay] = useState(String(initialValue))

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key >= '0' && e.key <= '9') {
        setDisplay(d => d === '0' ? e.key : d + e.key)
      } else if (e.key === 'Backspace') {
        setDisplay(d => d.length > 1 ? d.slice(0, -1) : '0')
      } else if (e.key === 'Enter') {
        onConfirm(parseInt(display))
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [display])

  const PAD = ['7','8','9','4','5','6','1','2','3','0','⌫','✓']

  function handlePad(key: string) {
    if (key === '⌫') setDisplay(d => d.length > 1 ? d.slice(0, -1) : '0')
    else if (key === '✓') onConfirm(parseInt(display))
    else setDisplay(d => d === '0' ? key : d + key)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
         onClick={onClose}>
      <div className="bg-[var(--color-surface)] rounded-2xl p-5 w-64 shadow-2xl space-y-4"
           onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-center">{title}</h3>

        {/* Display */}
        <div className="text-3xl font-bold text-right bg-[var(--color-surface-offset)]
                        rounded-xl px-4 py-3 text-[var(--color-text)]">
          {display}
        </div>

        {/* Numpad grid */}
        <div className="grid grid-cols-3 gap-2">
          {PAD.map(key => (
            <button
              key={key}
              onClick={() => handlePad(key)}
              className={`py-3 rounded-xl text-lg font-medium transition-colors
                          active:scale-95
                          ${key === '✓'
                            ? 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]'
                            : key === '⌫'
                            ? 'bg-[var(--color-error-highlight)] text-[var(--color-error)] hover:bg-red-200'
                            : 'bg-[var(--color-surface-offset)] hover:bg-[var(--color-surface-dynamic)]'
                          }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```


***

## Step 7 — Hardware Barcode Scanner Listener

USB and Bluetooth barcode scanners behave like fast keyboard input, ending with `Enter`. A global listener captures this without stealing focus from the search input.

**`apps/dashboard/components/pos/web/BarcodeListener.tsx`:**

```tsx
'use client'
import { useEffect, useRef } from 'react'

interface Props {
  onScanned: (barcode: string) => void
}

// Scanners type > 4 characters in < 100ms then press Enter
const SCANNER_MIN_CHARS = 4
const SCANNER_MAX_MS    = 100

export function BarcodeListener({ onScanned }: Props) {
  const buffer    = useRef('')
  const lastKeyAt = useRef(0)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ignore if a text input is focused (let user type normally)
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      const now = Date.now()

      if (e.key === 'Enter') {
        if (buffer.current.length >= SCANNER_MIN_CHARS &&
            now - lastKeyAt.current < SCANNER_MAX_MS) {
          onScanned(buffer.current)
        }
        buffer.current = ''
        return
      }

      // Reset if gap between keystrokes too long (human typing, not scanner)
      if (now - lastKeyAt.current > SCANNER_MAX_MS) {
        buffer.current = ''
      }

      if (e.key.length === 1) buffer.current += e.key
      lastKeyAt.current = now
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onScanned])

  return null  // no UI — purely behavioural
}
```


***

## Step 8 — Web Checkout Page

**`apps/dashboard/app/(pos)/pos/checkout/page.tsx`:**

```tsx
'use client'
import { useState }   from 'react'
import { useRouter }  from 'next/navigation'
import { usePosCart } from '@/stores/pos-cart'
import { CashFlow }   from '@/components/pos/web/checkout/CashFlow'
import { QRFlow }     from '@/components/pos/web/checkout/QRFlow'
import { SplitFlow }  from '@/components/pos/web/checkout/SplitFlow'
import { submitTransaction } from '@/lib/pos/submit-transaction'

type Method = 'cash' | 'qr_billplz' | 'qr_razorpay' | 'split'

const METHODS = [
  { id: 'cash',         emoji: '💵', label: 'Cash',           hint: '' },
  { id: 'qr_billplz',  emoji: '📱', label: 'FPX / DuitNow',  hint: 'Billplz' },
  { id: 'qr_razorpay', emoji: '💳', label: 'Card / Intl',    hint: 'Razorpay' },
  { id: 'split',        emoji: '✂️', label: 'Split Payment',  hint: '' }
] as const

export default function CheckoutPage() {
  const router    = useRouter()
  const cartStore = usePosCart()
  const { cart, totals, clearCart } = cartStore

  const [method,      setMethod]      = useState<Method | null>(null)
  const [processing,  setProcessing]  = useState(false)

  async function complete(opts: {
    paymentRef?:    string
    cashReceived?:  number
  }) {
    setProcessing(true)
    try {
      const tx = await submitTransaction({ cart, totals, method: method!, ...opts })
      clearCart()
      router.replace(`/pos/receipt/${tx.id}`)
    } catch {
      setProcessing(false)
    }
  }

  return (
    <div className="flex h-screen bg-[var(--color-bg)]">

      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="absolute top-4 left-4 text-sm text-[var(--color-text-muted)]
                   hover:text-[var(--color-text)] flex items-center gap-1"
      >
        ← Back to POS
      </button>

      {/* Left — order summary */}
      <div className="flex flex-col w-96 border-r border-[var(--color-border)]
                      bg-[var(--color-surface)] p-6 pt-16 overflow-y-auto">
        <h2 className="text-base font-semibold mb-4">Order Summary</h2>

        <ul className="space-y-2 flex-1">
          {cart.items.map((item, i) => (
            <li key={i} className="flex justify-between text-sm">
              <span className="text-[var(--color-text-muted)]">
                {item.name} × {item.qty}
              </span>
              <span className="font-medium">RM{item.lineTotal.toFixed(2)}</span>
            </li>
          ))}
        </ul>

        <div className="border-t border-[var(--color-divider)] pt-4 mt-4 space-y-2 text-sm">
          <div className="flex justify-between text-[var(--color-text-muted)]">
            <span>Subtotal</span><span>RM{totals.subtotal.toFixed(2)}</span>
          </div>
          {(totals.lineDiscounts + totals.globalDiscount) > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>−RM{(totals.lineDiscounts + totals.globalDiscount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-[var(--color-text-muted)]">
            <span>SST</span><span>RM{totals.tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-base
                          border-t border-[var(--color-divider)] pt-2">
            <span>Total</span>
            <span className="text-[var(--color-primary)]">
              RM{totals.total.toFixed(2)}
            </span>
          </div>
          {cart.customerName && (
            <p className="text-xs text-[var(--color-text-muted)]">
              Customer: {cart.customerName}
            </p>
          )}
        </div>
      </div>

      {/* Right — payment method + flow */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
        <h2 className="text-base font-semibold">Select Payment Method</h2>

        <div className="grid grid-cols-2 gap-4 w-full max-w-md">
          {METHODS.map(m => (
            <button
              key={m.id}
              onClick={() => setMethod(m.id as Method)}
              className={`
                flex flex-col items-center justify-center gap-2
                py-6 rounded-2xl border-2 transition-all
                ${method === m.id
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-highlight)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                }
              `}
            >
              <span className="text-4xl">{m.emoji}</span>
              <span className="text-sm font-semibold">{m.label}</span>
              {m.hint && (
                <span className="text-xs text-[var(--color-text-muted)]">{m.hint}</span>
              )}
            </button>
          ))}
        </div>

        {/* Payment flow */}
        <div className="w-full max-w-md">
          {method === 'cash' && (
            <CashFlow total={totals.total} onComplete={complete} processing={processing} />
          )}
          {(method === 'qr_billplz' || method === 'qr_razorpay') && (
            <QRFlow
              total={totals.total}
              gateway={method === 'qr_billplz' ? 'billplz' : 'razorpay'}
              cart={cart}
              onComplete={complete}
              processing={processing}
            />
          )}
          {method === 'split' && (
            <SplitFlow total={totals.total} onComplete={complete} processing={processing} />
          )}
        </div>
      </div>
    </div>
  )
}
```


***

## Step 9 — Receipt Page

**`apps/dashboard/app/(pos)/pos/receipt/[txId]/page.tsx`:**

```tsx
import { createClient }  from '@/lib/supabase/server'
import { PrintReceiptButton } from '@/components/pos/web/PrintReceiptButton'
import { redirect }      from 'next/navigation'

export default async function ReceiptPage({ params }: { params: { txId: string } }) {
  const supabase = await createClient()
  const { data: tx } = await supabase
    .from('pos_transactions')
    .select('*, pos_transaction_items(*)')
    .eq('id', params.txId)
    .single()

  if (!tx) redirect('/pos')

  const { data: merchant } = await supabase
    .from('profiles')
    .select('business_name, ssm_number, address')
    .single()

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col
                    items-center justify-center p-8">
      <div className="w-80 bg-white rounded-2xl shadow-xl p-6 space-y-4
                      font-mono text-sm dark:bg-gray-900">

        {/* Header */}
        <div className="text-center space-y-1">
          <p className="font-bold text-base">{merchant?.business_name}</p>
          {merchant?.address && (
            <p className="text-xs text-gray-500">{merchant.address}</p>
          )}
          <p className="text-xs text-gray-400">
            {new Date(tx.created_at).toLocaleString('en-MY', {
              timeZone: 'Asia/Kuala_Lumpur'
            })}
          </p>
          <p className="text-xs">Receipt: {tx.receipt_number}</p>
        </div>

        <hr className="border-dashed" />

        {/* Items */}
        {tx.pos_transaction_items.map((item: any) => (
          <div key={item.id}>
            <div className="flex justify-between">
              <span className="flex-1 mr-2">{item.product_name}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>  {item.qty} × RM{Number(item.unit_price_rm).toFixed(2)}</span>
              <span>RM{Number(item.line_total_rm).toFixed(2)}</span>
            </div>
          </div>
        ))}

        <hr className="border-dashed" />

        {/* Totals */}
        <div className="space-y-1">
          {Number(tx.discount_rm) > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>−RM{Number(tx.discount_rm).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-500">
            <span>SST (8%)</span>
            <span>RM{Number(tx.tax_rm).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-base">
            <span>TOTAL</span>
            <span>RM{Number(tx.total_rm).toFixed(2)}</span>
          </div>

          {tx.payment_method === 'cash' && (
            <>
              <div className="flex justify-between text-gray-500">
                <span>Cash</span>
                <span>RM{Number(tx.cash_received_rm).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Change</span>
                <span>RM{Number(tx.change_rm).toFixed(2)}</span>
              </div>
            </>
          )}

          {tx.payment_method !== 'cash' && (
            <div className="flex justify-between text-gray-500">
              <span>Payment</span>
              <span>{tx.payment_method.toUpperCase()}</span>
            </div>
          )}
        </div>

        {tx.loyalty_points_earned > 0 && (
          <>
            <hr className="border-dashed" />
            <p className="text-center text-xs text-[var(--color-primary)]">
              🎉 You earned {tx.loyalty_points_earned} loyalty points!
            </p>
          </>
        )}

        <hr className="border-dashed" />
        <p className="text-center text-xs text-gray-400">
          Thank you for your purchase!
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        <PrintReceiptButton txId={tx.id} />
        <a href="/pos"
           className="px-6 py-2.5 rounded-xl border border-[var(--color-border)]
                      text-sm font-medium hover:bg-[var(--color-surface)]
                      transition-colors">
          New Sale
        </a>
      </div>
    </div>
  )
}
```


***

## Step 10 — POS Navigation Entry Point

Add a POS shortcut to the main dashboard sidebar and topbar:

**In `apps/dashboard/components/layout/Sidebar.tsx`:**

```tsx
// Add to sidebar nav items:
{
  href:  '/pos',
  icon:  <ShoppingCart size={18} />,
  label: 'Point of Sale',
  badge: 'POS',   // distinct badge so merchants can spot it fast
  // Opens in the same tab — the (pos) layout takes over full screen
}
```

Add a keyboard shortcut in the dashboard shell:

```tsx
// In the root layout keyboard handler:
if (e.ctrlKey && e.key === 'p') {
  e.preventDefault()
  router.push('/pos')
}
```


***

## Step 11 — POS Session Management Page

**`apps/dashboard/app/(pos)/pos-sessions/page.tsx`** — merchants open and close their cashier shifts here:

```tsx
// Key UI elements:
// 1. "Open New Session" card — select outlet, enter opening cash float
// 2. Active session banner — shows cashier, time open, transaction count, total sales
// 3. "Close Session" button — enter closing cash, shows variance vs expected
// 4. Session history table — past sessions with totals

// Open session action calls:
await supabase.from('pos_sessions').insert({
  merchant_id:     user.id,
  outlet_id:       selectedOutletId,
  opening_cash_rm: openingCash,
  status:          'open'
})

// Close session action calls Edge Function to:
// 1. Sum all cash transactions for the session
// 2. Calculate variance (expected cash vs actual closing count)
// 3. Mark session closed
// 4. Generate session summary report
```


***

## Step 12 — Agent Drawer (Web POS)

**`apps/dashboard/components/pos/web/AgentDrawer.tsx`:**

```tsx
'use client'
import { useChat } from 'ai/react'
import { useEffect, useRef } from 'react'

interface Props {
  open:    boolean
  onClose: () => void
}

export function AgentDrawer({ open, onClose }: Props) {
  const inputRef  = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({ api: '/api/agent/pos-chat' })

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Drawer — slides in from right */}
      <div className="fixed right-0 top-0 h-full w-96
                      bg-[var(--color-surface)] border-l border-[var(--color-border)]
                      shadow-2xl z-50 flex flex-col
                      animate-in slide-in-from-right duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3
                        border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <div>
              <p className="text-sm font-semibold">MerchantMind</p>
              <p className="text-xs text-[var(--color-text-muted)]">POS Assistant</p>
            </div>
          </div>
          <button onClick={onClose}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
            ✕
          </button>
        </div>

        {/* Suggested queries */}
        {messages.length === 0 && (
          <div className="p-4 space-y-2">
            <p className="text-xs text-[var(--color-text-muted)]">Try asking:</p>
            {[
              'How many units of SKU-001 are left?',
              "What's today's sales total so far?",
              'Apply 10% discount for this order',
              'Look up customer John Tan\'s loyalty points'
            ].map(q => (
              <button
                key={q}
                onClick={() => {
                  handleInputChange({ target: { value: q } } as any)
                }}
                className="w-full text-left text-xs px-3 py-2 rounded-lg
                           bg-[var(--color-surface-offset)]
                           hover:bg-[var(--color-surface-dynamic)]
                           transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map(m => (
            <div key={m.id}
                 className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] text-sm px-3 py-2 rounded-xl
                ${m.role === 'user'
                  ? 'bg-[var(--color-primary)] text-white rounded-tr-sm'
                  : 'bg-[var(--color-surface-offset)] text-[var(--color-text)] rounded-tl-sm'
                }`}>
                {m.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-[var(--color-surface-offset)] px-3 py-2 rounded-xl">
                <span className="text-[var(--color-text-muted)] text-sm">Thinking…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit}
              className="border-t border-[var(--color-border)] p-3 flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about stock, sales, customers…"
            className="flex-1 bg-[var(--color-surface-offset)] rounded-lg
                       px-3 py-2 text-sm border border-[var(--color-border)]
                       focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg
                       text-sm font-medium hover:bg-[var(--color-primary-hover)]
                       disabled:opacity-40 transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </>
  )
}
```


***

## Web POS Completion Checklist

- [ ] `(pos)` route group created with its own full-screen layout — no sidebar or topbar
- [ ] Zustand cart store with `persist` middleware and `immer` — survives page refresh
- [ ] `calcCartTotals` moved to `packages/domain/pos.ts` — shared between web and mobile
- [ ] Product grid renders with category tabs, stock badge, out-of-stock disable state
- [ ] `BarcodeListener` captures USB/Bluetooth scanner input globally without stealing focus from inputs
- [ ] Cart panel shows line items with hover-reveal discount and remove buttons
- [ ] Numpad modal opens on qty click — full keyboard support (0-9, Backspace, Enter)
- [ ] Discount modal supports both flat RM and percentage input
- [ ] Customer search panel (F4) links a CRM customer to the cart
- [ ] Global keyboard shortcuts: F2 search, F4 customer, F8 agent, F12 checkout
- [ ] Cash flow shows change calculator with large numpad
- [ ] QR flow generates Billplz/Razorpay link, shows QR, polls Supabase Realtime for settlement
- [ ] Split payment flow supports two concurrent payment methods
- [ ] Receipt page renders thermal-style receipt, prints via `window.print()` using receipt CSS
- [ ] POS session open/close page with opening float and closing cash count
- [ ] Cash variance shown at session close (expected vs counted)
- [ ] Agent drawer (F8) opens right-side panel — uses `/api/agent/pos-chat` route
- [ ] POS shortcut in main dashboard sidebar with `(Ctrl+P)` keyboard hint
- [ ] Offline: cart persists in localStorage if browser is closed mid-session
- [ ] Offline queue: pending transactions saved and shown with a warning banner
- [ ] All POS transactions appear in the main Orders table in the dashboard
- [ ] All POS sales create `inventory_movements` of type `pos_sale`
- [ ] Loyalty points awarded and visible on receipt
- [ ] E-invoice auto-queued for POS transactions above RM200 threshold (LHDN requirement)
- [ ] End-to-end test: add 3 items → apply discount → pay via FPX QR → receipt prints
- [ ] End-to-end test: scan barcode → product added to cart automatically
- [ ] End-to-end test: customer linked → points redeemed → points balance updated in CRM
- [ ] End-to-end test: close browser mid-checkout → reopen → cart restored from localStorage

