import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { CartWithItems, Product, ProductVariant } from '@/types/app.types'

interface LocalCartItem {
  productId:   string
  variantId:   string | null
  productName: string
  variantName: string | null
  price:       number
  quantity:    number
  imageUrl:    string | null
  weightGrams: number
}

interface CartState {
  merchantId:   string | null
  merchantName: string | null
  items:        LocalCartItem[]
  isLoading:    boolean
}

interface CartActions {
  addItem:        (product: Product, variant: ProductVariant | null, qty?: number) => void
  removeItem:     (productId: string, variantId: string | null) => void
  updateQuantity: (productId: string, variantId: string | null, qty: number) => void
  clearCart:      () => void
  syncToSupabase: (userId: string) => Promise<void>
  getTotal:       () => number
  getItemCount:   () => number
  hasItem:        (productId: string, variantId: string | null) => boolean
}

export const useCartStore = create<CartState & CartActions>((set, get) => ({
  merchantId:   null,
  merchantName: null,
  items:        [],
  isLoading:    false,

  addItem: (product, variant, qty = 1) => {
    // Enforce single-merchant cart
    const { merchantId, items } = get()
    if (merchantId && merchantId !== product.merchant_id) {
      throw new Error('DIFFERENT_MERCHANT')
      // Caller must handle: prompt user to clear cart first
    }

    const variantId = variant?.id ?? null
    const existing = items.find(
      i => i.productId === product.id && i.variantId === variantId
    )

    const price = product.price + (variant?.price_modifier ?? 0)

    if (existing) {
      set({
        items: items.map(i =>
          i.productId === product.id && i.variantId === variantId
            ? { ...i, quantity: i.quantity + qty }
            : i
        ),
      })
    } else {
      set({
        merchantId:   product.merchant_id,
        items: [
          ...items,
          {
            productId:   product.id,
            variantId,
            productName: product.name,
            variantName: variant?.name ?? null,
            price,
            quantity:    qty,
            imageUrl:    product.images?.[0] ?? null,
            weightGrams: (product as any).weight_grams ?? 500,
          },
        ],
      })
    }
  },

  removeItem: (productId, variantId) => {
    const filtered = get().items.filter(
      i => !(i.productId === productId && i.variantId === variantId)
    )
    set({ items: filtered, merchantId: filtered.length === 0 ? null : get().merchantId })
  },

  updateQuantity: (productId, variantId, qty) => {
    if (qty <= 0) {
      get().removeItem(productId, variantId)
      return
    }
    set({
      items: get().items.map(i =>
        i.productId === productId && i.variantId === variantId
          ? { ...i, quantity: qty }
          : i
      ),
    })
  },

  clearCart: () => set({ items: [], merchantId: null, merchantName: null }),

  getTotal: () =>
    get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

  getItemCount: () =>
    get().items.reduce((sum, i) => sum + i.quantity, 0),

  hasItem: (productId, variantId) =>
    get().items.some(i => i.productId === productId && i.variantId === variantId),

  // Persist cart to Supabase (call on checkout, not on every add)
  syncToSupabase: async (userId) => {
    const { merchantId, items } = get()
    if (!merchantId || items.length === 0) return

    // Upsert cart
    const { data: cart } = await supabase
      .from('carts')
      .upsert({ customer_id: userId, merchant_id: merchantId })
      .select()
      .single()

    if (!cart) return

    // Delete existing cart items and re-insert
    await supabase.from('cart_items').delete().eq('cart_id', cart.id)
    await supabase.from('cart_items').insert(
      items.map(i => ({
        cart_id:    cart.id,
        product_id: i.productId,
        variant_id: i.variantId,
        quantity:   i.quantity,
      }))
    )
  },
}))
