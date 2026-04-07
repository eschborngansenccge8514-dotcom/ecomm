import type { Database } from './supabase'

// Convenience row type aliases
export type Profile     = Database['public']['Tables']['profiles']['Row']
export type Merchant = Omit<Database['public']['Tables']['merchants']['Row'], 'operating_hours'> & {
  average_rating?: number | null
  review_count?:   number | null
  operating_hours?: OperatingHour[]
  announcements?:   Announcement[]
}

export type OperatingHour = {
  id: string
  merchant_id: string
  day_of_week: number
  open_time: string | null
  close_time: string | null
  is_closed: boolean
}

export type Announcement = {
  id: string
  merchant_id: string
  message: string
  type: 'info' | 'promo' | 'warning' | 'holiday'
  bg_color: string
  text_color: string
  link_url: string | null
  link_text: string | null
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  sort_order: number
  created_at: string
}
export type Product     = Database['public']['Tables']['products']['Row']
export type ProductVariant = Database['public']['Tables']['product_variants']['Row']
export type Category    = Database['public']['Tables']['categories']['Row']
export type Order       = Database['public']['Tables']['orders']['Row']
export type OrderItem   = Database['public']['Tables']['order_items']['Row']
export type Address     = Database['public']['Tables']['addresses']['Row']
export type Cart        = Database['public']['Tables']['carts']['Row']
export type CartItem    = Database['public']['Tables']['cart_items']['Row']
export type Review      = Database['public']['Tables']['order_reviews']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']

// Insert type aliases
export type InsertMerchant = Database['public']['Tables']['merchants']['Insert']
export type InsertProduct  = Database['public']['Tables']['products']['Insert']
export type InsertOrder    = Database['public']['Tables']['orders']['Insert']
export type InsertAddress  = Database['public']['Tables']['addresses']['Insert']

// Update type aliases
export type UpdateProduct  = Database['public']['Tables']['products']['Update']
export type UpdateOrder    = Database['public']['Tables']['orders']['Update']

// Composite types used in screens
export type ProductWithVariants = Product & {
  variants: ProductVariant[]
  category: Category | null
}

export type OrderWithItems = Order & {
  items: OrderItem[]
  merchant: Pick<Merchant, 'id' | 'store_name' | 'logo_url'>
  buyer_name?: string | null
}

export type CartWithItems = Cart & {
  items: Array<CartItem & { product: Product; variant: ProductVariant | null }>
  merchant: Pick<Merchant, 'id' | 'store_name' | 'logo_url' | 'min_order_amount'>
}

export type MerchantWithStats = Merchant & {
  product_count: number
  order_count:   number
  revenue_today: number
}

export type DeliveryQuoteOption = {
  provider: 'lalamove' | 'grab_express' | 'easyparcel'
  serviceType: string
  price: number
  currency: string
  estimatedMins: number
  distanceKm: number
}

export type DeliveryType = 'instant' | 'courier' | 'self_pickup'

export type DeliveryOption =
  | {
      type:        'instant'
      provider:    'lalamove'
      serviceType: string
      label:       string
      emoji:       string
      description: string
      maxKg:       number
      priceRM:     number
      quotationId: string
      expiresAt:   string
    }
  | {
      type:        'courier'
      provider:    'easyparcel'
      serviceId:   string
      rateId:      string
      courierName: string
      courierLogo: string
      serviceName: string
      serviceDetail: string
      priceRM:     number
      delivery:    string
      weightKg:    number
    }
  | {
      type:     'self_pickup'
      provider: 'self_pickup'
      label:    string
      emoji:    string
      description: string
      priceRM:  0
    }
