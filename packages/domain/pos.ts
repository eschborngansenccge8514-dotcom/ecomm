export type MovementType = 'sale' | 'restock' | 'return' | 'adjustment' | 'damaged' | 'lost' | 'transfer_out' | 'transfer_in' | 'po_receive'

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

export interface PosTransactionPayload {
  id?: string
  sessionId: string
  outletId:  string
  customerId?: string
  items:     CartItem[]
  paymentMethod: 'cash' | 'card' | 'ewallet'
  totals:    CartTotals
  cashReceived?: number
  change?:       number
  notes?:        string
  metadata?:     any
}

export function calcCartTotals(cart: Cart, pointsRate = 1, taxRate = 8): CartTotals {
  const subtotal      = cart.items.reduce((s, i) => s + i.lineTotal, 0)
  const lineDiscounts = cart.items.reduce((s, i) => s + i.discountRm * i.qty, 0)
  const globalDiscount = cart.globalDiscountRm
  const pointsDiscount = cart.pointsToRedeem * 0.01   // 1 pt = RM0.01
  const taxableAmount  = Math.max(0, subtotal - lineDiscounts - globalDiscount - pointsDiscount)
  const tax            = taxableAmount * (taxRate / 100)
  const total          = taxableAmount + tax
  const pointsEarned   = Math.floor(total * pointsRate)
  return { subtotal, lineDiscounts, globalDiscount, pointsDiscount,
           taxableAmount, tax, total, pointsEarned }
}
