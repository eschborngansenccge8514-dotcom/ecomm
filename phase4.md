<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# You are a senior full-stack architect. Generate a complete, exhaustive implementation plan for phase 4. Every feature must be broken down to its smallest unit of work.

This is the exhaustive architect-level specification for **Phase 4: Project Scaffold, Navigation Architecture, Core Screens \& State Layer**. Every unit of work is atomic and executable in sequence.

***

## Scope \& Deliverables

Phase 4 produces a fully runnable Expo app connected to your Phase 3 Supabase backend, with complete navigation, auth flow, all customer-facing screens, all merchant screens, global state management, and reusable component library. No payment or delivery APIs yet — those are Phase 5 and 6.

***

## Step 4.0 — Initialize the Project

Open your terminal (inside Cursor AI), run each command one at a time:

```bash
# 4.0.1 — Create project with Expo Router template
npx create-expo-app@latest hyperlocal-app --template https://github.com/expo/expo/tree/main/templates/expo-template-blank-typescript
cd hyperlocal-app

# 4.0.2 — Verify the project runs before installing anything
npx expo start
# Press 'w' for web, scan QR for mobile. You should see the default screen.
# Press Ctrl+C to stop.

# 4.0.3 — Initialize Git
git init
git add .
git commit -m "chore: initial expo scaffold"
```


***

## Step 4.1 — Install All Dependencies

Run each block separately. If any block fails, fix it before continuing.

### Block 4.1.1 — Navigation \& Routing

```bash
npx expo install expo-router expo-linking expo-constants expo-status-bar
```


### Block 4.1.2 — Supabase \& Auth

```bash
npx expo install @supabase/supabase-js \
  react-native-url-polyfill \
  @react-native-async-storage/async-storage \
  expo-secure-store \
  expo-auth-session \
  expo-web-browser
```


### Block 4.1.3 — UI \& Styling

```bash
npx expo install nativewind tailwindcss \
  react-native-safe-area-context \
  react-native-screens \
  @expo/vector-icons \
  expo-image \
  react-native-gesture-handler \
  react-native-reanimated \
  expo-haptics \
  expo-blur
```


### Block 4.1.4 — State Management \& Storage

```bash
npm install zustand \
  @react-native-mmkv/core mmkv \
  immer
```


### Block 4.1.5 — Forms \& Validation

```bash
npm install react-hook-form zod @hookform/resolvers
```


### Block 4.1.6 — Media \& Files

```bash
npx expo install expo-image-picker \
  expo-file-system \
  expo-camera \
  expo-location \
  expo-notifications
```


### Block 4.1.7 — Maps \& Geolocation

```bash
npx expo install react-native-maps \
  expo-location
```


### Block 4.1.8 — Utilities

```bash
npm install date-fns \
  react-native-toast-message \
  @tanstack/react-query \
  axios \
  clsx \
  tailwind-merge
```


***

## Step 4.2 — Configure the Project Files

### Block 4.2.1 — Replace `app.json` with `app.config.ts`

Delete `app.json`. Create `app.config.ts` in the project root:

```typescript
import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Hyperlocal',
  slug: 'hyperlocal-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  scheme: 'hyperlocal',  // deep link scheme for auth redirects
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.yourcompany.hyperlocal',
    infoPlist: {
      NSLocationWhenInUseUsageDescription: 'We need your location to find nearby stores.',
      NSCameraUsageDescription: 'Upload product and review photos.',
      NSPhotoLibraryUsageDescription: 'Upload product and review photos.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    package: 'com.yourcompany.hyperlocal',
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#ffffff',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'We need your location to find nearby stores.',
      },
    ],
    [
      'expo-camera',
      { cameraPermission: 'Allow $(PRODUCT_NAME) to access your camera.' },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
```


### Block 4.2.2 — Create `.env` file

Create `.env` in the project root (never commit this to Git):

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
EXPO_PUBLIC_APP_URL=http://localhost:8081
```

Create `.gitignore` entry:

```bash
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
```


### Block 4.2.3 — Configure NativeWind v4[^1]

Create `tailwind.config.js` in the project root:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        success: '#22c55e',
        warning: '#f59e0b',
        danger:  '#ef4444',
      },
      fontFamily: {
        sans:   ['System'],
        mono:   ['monospace'],
      },
    },
  },
  plugins: [],
};
```

Create `metro.config.js` in the project root:

```javascript
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
```

Create `global.css` in the project root:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Create `nativewind-env.d.ts` in the project root:

```typescript
/// <reference types="nativewind/types" />
```


### Block 4.2.4 — Configure `tsconfig.json`

Replace the contents of `tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    },
    "jsx": "react-jsx"
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.d.ts",
    "expo-env.d.ts",
    "nativewind-env.d.ts"
  ]
}
```


***

## Step 4.3 — Define the Full Project Folder Structure

Create every folder listed below. Empty folders need a `.gitkeep` file.

```
hyperlocal-app/
├── app/                          ← Expo Router: all routes live here
│   ├── _layout.tsx               ← Root layout (providers wrap everything)
│   ├── index.tsx                 ← Splash/redirect screen
│   ├── (auth)/                   ← Unauthenticated screens
│   │   ├── _layout.tsx
│   │   ├── welcome.tsx
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   ├── forgot-password.tsx
│   │   └── reset-password.tsx
│   ├── (customer)/               ← Authenticated customer screens
│   │   ├── _layout.tsx           ← Tab navigator
│   │   ├── (home)/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx         ← Home feed / store discovery
│   │   │   └── search.tsx        ← Search stores & products
│   │   ├── (store)/
│   │   │   ├── _layout.tsx
│   │   │   ├── [storeSlug].tsx   ← Store detail + product list
│   │   │   └── [storeSlug]/
│   │   │       └── product/
│   │   │           └── [productId].tsx  ← Product detail
│   │   ├── (cart)/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx         ← Cart screen
│   │   │   └── checkout.tsx      ← Checkout (address + delivery + payment)
│   │   ├── (orders)/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx         ← Order history list
│   │   │   └── [orderId].tsx     ← Order detail & tracking
│   │   └── (profile)/
│   │       ├── _layout.tsx
│   │       ├── index.tsx         ← Profile menu
│   │       ├── edit.tsx          ← Edit profile
│   │       └── addresses.tsx     ← Manage saved addresses
│   ├── (merchant)/               ← Authenticated merchant screens
│   │   ├── _layout.tsx           ← Tab navigator
│   │   ├── dashboard.tsx         ← Revenue & stats overview
│   │   ├── orders.tsx            ← Incoming orders list
│   │   ├── order/
│   │   │   └── [orderId].tsx     ← Order detail + status update
│   │   ├── products.tsx          ← Product list
│   │   ├── product/
│   │   │   ├── new.tsx           ← Create product
│   │   │   └── [productId].tsx   ← Edit product
│   │   ├── store-settings.tsx    ← Store profile & settings
│   │   └── onboarding.tsx        ← First-time merchant setup wizard
│   └── (admin)/                  ← Admin screens (minimal for now)
│       ├── _layout.tsx
│       └── merchants.tsx         ← Approve pending merchants
│
├── src/
│   ├── lib/
│   │   ├── supabase.ts           ← Supabase client instance
│   │   ├── queryClient.ts        ← TanStack Query client
│   │   └── utils.ts              ← cn(), formatCurrency(), etc.
│   ├── types/
│   │   ├── database.types.ts     ← Auto-generated from Supabase
│   │   └── app.types.ts          ← App-level interfaces
│   ├── stores/
│   │   ├── authStore.ts          ← Auth state (user, session, role)
│   │   ├── cartStore.ts          ← Cart items + merchant binding
│   │   └── uiStore.ts            ← Loading, toasts, modals
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useMerchant.ts
│   │   ├── useProducts.ts
│   │   ├── useOrders.ts
│   │   ├── useCart.ts
│   │   └── useLocation.ts
│   ├── services/
│   │   ├── merchants.service.ts
│   │   ├── products.service.ts
│   │   ├── orders.service.ts
│   │   ├── cart.service.ts
│   │   └── upload.service.ts
│   └── components/
│       ├── ui/                   ← Primitive design system components
│       │   ├── Button.tsx
│       │   ├── Input.tsx
│       │   ├── Card.tsx
│       │   ├── Badge.tsx
│       │   ├── Avatar.tsx
│       │   ├── Skeleton.tsx
│       │   ├── Sheet.tsx         ← Bottom sheet wrapper
│       │   └── EmptyState.tsx
│       ├── merchant/
│       │   ├── StoreCard.tsx
│       │   ├── OrderCard.tsx
│       │   └── StatCard.tsx
│       ├── product/
│       │   ├── ProductCard.tsx
│       │   ├── ProductGrid.tsx
│       │   └── VariantSelector.tsx
│       └── order/
│           ├── OrderStatusBadge.tsx
│           └── TrackingTimeline.tsx
```

Run this in terminal to create all folders at once:

```bash
mkdir -p app/{auth,\(customer\)/\(home\),\(customer\)/\(store\)/\[storeSlug\]/product,\(customer\)/\(cart\),\(customer\)/\(orders\),\(customer\)/\(profile\),\(merchant\)/order,\(merchant\)/product,\(admin\)}
mkdir -p src/{lib,types,stores,hooks,services,components/{ui,merchant,product,order}}
```


***

## Step 4.4 — Supabase Client \& Type Generation

### Block 4.4.1 — Create `src/lib/supabase.ts`[^2]

```typescript
import { AppState, Platform } from 'react-native'
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, processLock } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
})

// Keep session alive when app returns to foreground
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh()
    } else {
      supabase.auth.stopAutoRefresh()
    }
  })
}
```


### Block 4.4.2 — Generate TypeScript types from Supabase

Run in terminal:

```bash
npx supabase gen types typescript \
  --project-id YOUR_PROJECT_REF \
  --schema public \
  > src/types/database.types.ts
```

Run this command every time you change your database schema.

### Block 4.4.3 — Create `src/types/app.types.ts`

```typescript
import type { Database } from './database.types'

// Convenience row type aliases
export type Profile     = Database['public']['Tables']['profiles']['Row']
export type Merchant    = Database['public']['Tables']['merchants']['Row']
export type Product     = Database['public']['Tables']['products']['Row']
export type ProductVariant = Database['public']['Tables']['product_variants']['Row']
export type Category    = Database['public']['Tables']['categories']['Row']
export type Order       = Database['public']['Tables']['orders']['Row']
export type OrderItem   = Database['public']['Tables']['order_items']['Row']
export type Address     = Database['public']['Tables']['addresses']['Row']
export type Cart        = Database['public']['Tables']['carts']['Row']
export type CartItem    = Database['public']['Tables']['cart_items']['Row']
export type Review      = Database['public']['Tables']['reviews']['Row']
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
```


### Block 4.4.4 — Create `src/lib/utils.ts`

```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Tailwind class merge utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format MYR currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ms-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
  }).format(amount)
}

// Format relative time e.g. "2 hours ago"
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1)   return 'just now'
  if (diffMins < 60)  return `${diffMins}m ago`
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
  return `${Math.floor(diffMins / 1440)}d ago`
}

// Generate a store slug from store name
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

// Truncate long text
export function truncate(str: string, length: number): string {
  return str.length > length ? str.substring(0, length) + '...' : str
}
```


***

## Step 4.5 — Global State Stores (Zustand)

### Block 4.5.1 — Create `src/stores/authStore.ts`[^3]

```typescript
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'
import type { Profile, Merchant } from '@/types/app.types'

interface AuthState {
  session:   Session | null
  user:      User    | null
  profile:   Profile | null
  merchant:  Merchant | null
  isLoading: boolean
  isInitialized: boolean
}

interface AuthActions {
  initialize:      () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, fullName: string, role: 'customer' | 'merchant') => Promise<void>
  signOut:         () => Promise<void>
  refreshProfile:  () => Promise<void>
  refreshMerchant: () => Promise<void>
  setSession:      (session: Session | null) => void
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  session:       null,
  user:          null,
  profile:       null,
  merchant:      null,
  isLoading:     false,
  isInitialized: false,

  initialize: async () => {
    // Get existing session from storage
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      set({ session, user: session.user })
      await get().refreshProfile()
    }
    set({ isInitialized: true })

    // Listen to auth changes globally
    supabase.auth.onAuthStateChange(async (event, session) => {
      set({ session, user: session?.user ?? null })
      if (session) {
        await get().refreshProfile()
      } else {
        set({ profile: null, merchant: null })
      }
    })
  },

  signInWithEmail: async (email, password) => {
    set({ isLoading: true })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    set({ isLoading: false })
    if (error) throw error
  },

  signUpWithEmail: async (email, password, fullName, role) => {
    set({ isLoading: true })
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
      },
    })
    set({ isLoading: false })
    if (error) throw error
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null, profile: null, merchant: null })
  },

  refreshProfile: async () => {
    const user = get().user
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    set({ profile })

    // If merchant role, fetch merchant record
    if (profile?.role === 'merchant') {
      await get().refreshMerchant()
    }
  },

  refreshMerchant: async () => {
    const user = get().user
    if (!user) return
    const { data: merchant } = await supabase
      .from('merchants')
      .select('*')
      .eq('owner_id', user.id)
      .single()
    set({ merchant })
  },

  setSession: (session) => set({ session, user: session?.user ?? null }),
}))
```


### Block 4.5.2 — Create `src/stores/cartStore.ts`[^3]

```typescript
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
            imageUrl:    product.images?.[^0] ?? null,
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
      .upsert({ user_id: userId, merchant_id: merchantId })
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
```


### Block 4.5.3 — Create `src/stores/uiStore.ts`

```typescript
import { create } from 'zustand'

interface Toast {
  id:      string
  type:    'success' | 'error' | 'info' | 'warning'
  message: string
}

interface UIState {
  toasts:        Toast[]
  isModalOpen:   boolean
  modalContent:  React.ReactNode | null
}

interface UIActions {
  showToast:  (type: Toast['type'], message: string) => void
  hideToast:  (id: string) => void
  openModal:  (content: React.ReactNode) => void
  closeModal: () => void
}

export const useUIStore = create<UIState & UIActions>((set, get) => ({
  toasts:       [],
  isModalOpen:  false,
  modalContent: null,

  showToast: (type, message) => {
    const id = Date.now().toString()
    set({ toasts: [...get().toasts, { id, type, message }] })
    setTimeout(() => get().hideToast(id), 3500)
  },

  hideToast: (id) =>
    set({ toasts: get().toasts.filter(t => t.id !== id) }),

  openModal:  (content) => set({ isModalOpen: true, modalContent: content }),
  closeModal: ()        => set({ isModalOpen: false, modalContent: null }),
}))
```


***

## Step 4.6 — Service Layer

### Block 4.6.1 — Create `src/services/merchants.service.ts`

```typescript
import { supabase } from '@/lib/supabase'
import type { InsertMerchant, Merchant } from '@/types/app.types'

export const merchantsService = {
  // Browse active merchants near a postcode
  async getAll(postcode?: string): Promise<Merchant[]> {
    let query = supabase
      .from('merchants')
      .select('*, average_rating, review_count')
      .eq('status', 'active')
      .order('average_rating', { ascending: false })

    if (postcode) {
      query = query.eq('postcode', postcode)
    }

    const { data, error } = await query
    if (error) throw error
    return data ?? []
  },

  // Get a single store by slug (for store detail page)
  async getBySlug(slug: string): Promise<Merchant | null> {
    const { data, error } = await supabase
      .from('merchants')
      .select('*, average_rating, review_count')
      .eq('store_slug', slug)
      .eq('status', 'active')
      .single()
    if (error) return null
    return data
  },

  // Merchant self-registration
  async create(payload: InsertMerchant): Promise<Merchant> {
    const { data, error } = await supabase
      .from('merchants')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Update merchant profile
  async update(id: string, payload: Partial<InsertMerchant>): Promise<Merchant> {
    const { data, error } = await supabase
      .from('merchants')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Check if slug is available
  async isSlugAvailable(slug: string): Promise<boolean> {
    const { count } = await supabase
      .from('merchants')
      .select('id', { count: 'exact', head: true })
      .eq('store_slug', slug)
    return count === 0
  },
}
```


### Block 4.6.2 — Create `src/services/products.service.ts`

```typescript
import { supabase } from '@/lib/supabase'
import type { InsertProduct, ProductWithVariants, UpdateProduct } from '@/types/app.types'

export const productsService = {
  // Get all products for a merchant (customer view — active only)
  async getByMerchant(merchantId: string): Promise<ProductWithVariants[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*, variants:product_variants(*), category:categories(*)')
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as ProductWithVariants[]
  },

  // Get all products for a merchant (merchant view — all statuses)
  async getByMerchantOwner(merchantId: string): Promise<ProductWithVariants[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*, variants:product_variants(*), category:categories(*)')
      .eq('merchant_id', merchantId)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as ProductWithVariants[]
  },

  // Get single product
  async getById(id: string): Promise<ProductWithVariants | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*, variants:product_variants(*), category:categories(*)')
      .eq('id', id)
      .single()
    if (error) return null
    return data as ProductWithVariants
  },

  async create(payload: InsertProduct): Promise<ProductWithVariants> {
    const { data, error } = await supabase
      .from('products')
      .insert(payload)
      .select('*, variants:product_variants(*), category:categories(*)')
      .single()
    if (error) throw error
    return data as ProductWithVariants
  },

  async update(id: string, payload: UpdateProduct): Promise<ProductWithVariants> {
    const { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .select('*, variants:product_variants(*), category:categories(*)')
      .single()
    if (error) throw error
    return data as ProductWithVariants
  },

  // Soft delete
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .update({ status: 'deleted' })
      .eq('id', id)
    if (error) throw error
  },
}
```


### Block 4.6.3 — Create `src/services/orders.service.ts`

```typescript
import { supabase } from '@/lib/supabase'
import type { InsertOrder, OrderWithItems } from '@/types/app.types'

export const ordersService = {
  // Customer: get all own orders
  async getMyOrders(customerId: string): Promise<OrderWithItems[]> {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*),
        merchant:merchants(id, store_name, logo_url)
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as unknown as OrderWithItems[]
  },

  // Merchant: get all store orders
  async getMerchantOrders(merchantId: string, status?: string): Promise<OrderWithItems[]> {
    let query = supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*),
        merchant:merchants(id, store_name, logo_url)
      `)
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as unknown as OrderWithItems[]
  },

  // Get single order
  async getById(id: string): Promise<OrderWithItems | null> {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*),
        merchant:merchants(id, store_name, logo_url)
      `)
      .eq('id', id)
      .single()
    if (error) return null
    return data as unknown as OrderWithItems
  },

  // Create order (from checkout)
  async create(order: InsertOrder, items: Array<{
    product_id: string
    variant_id?: string | null
    product_name: string
    variant_name?: string | null
    unit_price: number
    quantity: number
    line_total: number
  }>): Promise<OrderWithItems> {
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert(order)
      .select()
      .single()
    if (orderError) throw orderError

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(items.map(i => ({ ...i, order_id: newOrder.id })))
    if (itemsError) throw itemsError

    return ordersService.getById(newOrder.id) as Promise<OrderWithItems>
  },

  // Merchant: update order status
  async updateStatus(id: string, status: string, note?: string): Promise<void> {
    const { error } = await supabase
      .from('orders')
      .update({ status, merchant_note: note ?? null })
      .eq('id', id)
    if (error) throw error
  },
}
```


### Block 4.6.4 — Create `src/services/upload.service.ts`

```typescript
import { supabase } from '@/lib/supabase'
import * as FileSystem from 'expo-file-system'
import { decode } from 'base64-arraybuffer'

type BucketName = 'avatars' | 'merchant-assets' | 'product-images' | 'review-images'

export const uploadService = {
  async uploadImage(
    bucket: BucketName,
    folder: string,
    localUri: string,
    fileName?: string
  ): Promise<string> {
    const name = fileName ?? `${Date.now()}.jpg`
    const path = `${folder}/${name}`

    // Read as base64
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    })

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, decode(base64), {
        contentType: 'image/jpeg',
        upsert: true,
      })

    if (error) throw error

    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  },

  getPublicUrl(bucket: BucketName, path: string): string {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  },
}
```


***

## Step 4.7 — Root Layout \& Auth Guard

### Block 4.7.1 — Create `app/_layout.tsx`

```typescript
import '../global.css'
import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClientProvider } from '@tanstack/react-query'
import Toast from 'react-native-toast-message'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/stores/authStore'

export default function RootLayout() {
  const initialize = useAuthStore(s => s.initialize)
  const isInitialized = useAuthStore(s => s.isInitialized)

  useEffect(() => {
    initialize()
  }, [])

  // Don't render routes until auth is initialized (prevents flash of wrong screen)
  if (!isInitialized) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(customer)" />
            <Stack.Screen name="(merchant)" />
            <Stack.Screen name="(admin)" />
          </Stack>
          <StatusBar style="auto" />
          <Toast />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
```


### Block 4.7.2 — Create `app/index.tsx` (Redirect logic)

```typescript
import { Redirect } from 'expo-router'
import { useAuthStore } from '@/stores/authStore'

export default function Index() {
  const { session, profile } = useAuthStore()

  // Not logged in → show auth screens
  if (!session) return <Redirect href="/(auth)/welcome" />

  // Logged in: route by role
  if (profile?.role === 'merchant') return <Redirect href="/(merchant)/dashboard" />
  if (profile?.role === 'admin')    return <Redirect href="/(admin)/merchants" />
  return <Redirect href="/(customer)/(home)" />
}
```


### Block 4.7.3 — Create `app/(auth)/_layout.tsx`[^4]

```typescript
import { Stack } from 'expo-router'
import { useAuthStore } from '@/stores/authStore'
import { Redirect } from 'expo-router'

export default function AuthLayout() {
  const session = useAuthStore(s => s.session)

  // Redirect away from auth screens if already logged in
  if (session) return <Redirect href="/" />

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
    </Stack>
  )
}
```


### Block 4.7.4 — Create `app/(customer)/_layout.tsx`[^5]

```typescript
import { Tabs } from 'expo-router'
import { Redirect } from 'expo-router'
import { useAuthStore } from '@/stores/authStore'
import { useCartStore } from '@/stores/cartStore'
import { Ionicons } from '@expo/vector-icons'
import { View, Text } from 'react-native'

function CartBadge() {
  const count = useCartStore(s => s.getItemCount())
  if (count === 0) return null
  return (
    <View className="absolute -top-1 -right-1 bg-primary-500 rounded-full w-4 h-4 items-center justify-center">
      <Text className="text-white text-[9px] font-bold">{count > 9 ? '9+' : count}</Text>
    </View>
  )
}

export default function CustomerLayout() {
  const { session, profile } = useAuthStore()

  if (!session)                    return <Redirect href="/(auth)/welcome" />
  if (profile?.role === 'merchant') return <Redirect href="/(merchant)/dashboard" />

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#2563eb' }}>
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(store)"
        options={{ href: null }}  // hidden tab, navigated to programmatically
      />
      <Tabs.Screen
        name="(cart)"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="cart-outline" size={size} color={color} />
              <CartBadge />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="(orders)"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}
```


### Block 4.7.5 — Create `app/(merchant)/_layout.tsx`

```typescript
import { Tabs, Redirect } from 'expo-router'
import { useAuthStore } from '@/stores/authStore'
import { Ionicons } from '@expo/vector-icons'

export default function MerchantLayout() {
  const { session, profile, merchant } = useAuthStore()

  if (!session)                    return <Redirect href="/(auth)/welcome" />
  if (profile?.role !== 'merchant') return <Redirect href="/(customer)/(home)" />

  // New merchant with no store yet → onboarding
  if (!merchant)                   return <Redirect href="/(merchant)/onboarding" />

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#2563eb' }}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="store-settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
      {/* Hidden screens — not in tab bar */}
      <Tabs.Screen name="onboarding" options={{ href: null }} />
      <Tabs.Screen name="order"      options={{ href: null }} />
      <Tabs.Screen name="product"    options={{ href: null }} />
    </Tabs>
  )
}
```


***

## Step 4.8 — Auth Screens

### Block 4.8.1 — Create `app/(auth)/welcome.tsx`

```typescript
import { View, Text, Image } from 'react-native'
import { router } from 'expo-router'
import { Button } from '@/components/ui/Button'

export default function WelcomeScreen() {
  return (
    <View className="flex-1 bg-white items-center justify-end px-6 pb-12">
      <Image
        source={require('../../assets/welcome-illustration.png')}
        className="w-80 h-80 mb-8"
        resizeMode="contain"
      />
      <Text className="text-3xl font-bold text-gray-900 text-center mb-2">
        Shop Local, Delivered Fast
      </Text>
      <Text className="text-gray-500 text-center mb-10 text-base">
        Discover stores near you and get what you need today.
      </Text>
      <Button onPress={() => router.push('/(auth)/register')} className="w-full mb-3">
        Get Started
      </Button>
      <Button
        variant="outline"
        onPress={() => router.push('/(auth)/login')}
        className="w-full"
      >
        I already have an account
      </Button>
    </View>
  )
}
```


### Block 4.8.2 — Create `app/(auth)/login.tsx`

```typescript
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { router } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuthStore } from '@/stores/authStore'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import Toast from 'react-native-toast-message'

const schema = z.object({
  email:    z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type FormData = z.infer<typeof schema>

export default function LoginScreen() {
  const { signInWithEmail, isLoading } = useAuthStore()

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      await signInWithEmail(data.email, data.password)
      // Redirect handled automatically by root index.tsx via auth state change
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Login failed', text2: err.message })
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 px-6 pt-16">
        <TouchableOpacity onPress={() => router.back()} className="mb-8">
          <Text className="text-primary-600 text-base">← Back</Text>
        </TouchableOpacity>

        <Text className="text-2xl font-bold text-gray-900 mb-1">Welcome back</Text>
        <Text className="text-gray-500 mb-8">Sign in to your account</Text>

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Email"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={value}
              onChangeText={onChange}
              error={errors.email?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Password"
              placeholder="••••••••"
              secureTextEntry
              value={value}
              onChangeText={onChange}
              error={errors.password?.message}
            />
          )}
        />

        <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} className="mb-8 self-end">
          <Text className="text-primary-600">Forgot password?</Text>
        </TouchableOpacity>

        <Button onPress={handleSubmit(onSubmit)} loading={isLoading}>
          Sign In
        </Button>

        <View className="flex-row justify-center mt-6">
          <Text className="text-gray-500">Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text className="text-primary-600 font-semibold">Sign up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}
```


### Block 4.8.3 — Create `app/(auth)/register.tsx`

```typescript
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import Toast from 'react-native-toast-message'

const schema = z.object({
  fullName:        z.string().min(2, 'Name must be at least 2 characters'),
  email:           z.string().email('Invalid email'),
  password:        z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type FormData = z.infer<typeof schema>

export default function RegisterScreen() {
  const { signUpWithEmail, isLoading } = useAuthStore()
  const [role, setRole] = useState<'customer' | 'merchant'>('customer')

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      await signUpWithEmail(data.email, data.password, data.fullName, role)
      Toast.show({ type: 'success', text1: 'Check your email to confirm your account.' })
      router.push('/(auth)/login')
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Registration failed', text2: err.message })
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView className="flex-1 px-6 pt-16" showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} className="mb-8">
          <Text className="text-primary-600 text-base">← Back</Text>
        </TouchableOpacity>

        <Text className="text-2xl font-bold text-gray-900 mb-1">Create account</Text>
        <Text className="text-gray-500 mb-6">Join as a customer or merchant</Text>

        {/* Role selector */}
        <View className="flex-row mb-6 gap-3">
          {(['customer', 'merchant'] as const).map(r => (
            <TouchableOpacity
              key={r}
              onPress={() => setRole(r)}
              className={`flex-1 py-3 rounded-xl border-2 items-center
                ${role === r ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}
            >
              <Text className={`font-semibold capitalize
                ${role === r ? 'text-primary-700' : 'text-gray-500'}`}>
                {r === 'merchant' ? '🏪 Merchant' : '🛍️ Customer'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Controller control={control} name="fullName"
          render={({ field: { onChange, value } }) => (
            <Input label="Full Name" placeholder="Ahmad bin Ali" value={value} onChangeText={onChange} error={errors.fullName?.message} />
          )}
        />
        <Controller control={control} name="email"
          render={({ field: { onChange, value } }) => (
            <Input label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" value={value} onChangeText={onChange} error={errors.email?.message} />
          )}
        />
        <Controller control={control} name="password"
          render={({ field: { onChange, value } }) => (
            <Input label="Password" placeholder="Min 8 characters" secureTextEntry value={value} onChangeText={onChange} error={errors.password?.message} />
          )}
        />
        <Controller control={control} name="confirmPassword"
          render={({ field: { onChange, value } }) => (
            <Input label="Confirm Password" placeholder="Repeat password" secureTextEntry value={value} onChangeText={onChange} error={errors.confirmPassword?.message} />
          )}
        />

        <Button onPress={handleSubmit(onSubmit)} loading={isLoading} className="mt-4 mb-8">
          Create Account
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
```


***

## Step 4.9 — Customer Screens

### Block 4.9.1 — `app/(customer)/(home)/index.tsx`

```typescript
import { View, Text, ScrollView, TextInput, TouchableOpacity, RefreshControl } from 'react-native'
import { router } from 'expo-router'
import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { merchantsService } from '@/services/merchants.service'
import { StoreCard } from '@/components/merchant/StoreCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/stores/authStore'
import { Ionicons } from '@expo/vector-icons'

const INDUSTRIES = ['All', 'Food & Beverage', 'Retail', 'Pharmacy', 'Grocery', 'Fashion', 'Electronics']

export default function HomeScreen() {
  const { profile } = useAuthStore()
  const [selectedIndustry, setSelectedIndustry] = useState('All')

  const { data: merchants = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['merchants'],
    queryFn: () => merchantsService.getAll(),
  })

  const filtered = selectedIndustry === 'All'
    ? merchants
    : merchants.filter(m => m.industry === selectedIndustry)

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      {/* Header */}
      <View className="bg-white px-5 pt-14 pb-4">
        <Text className="text-gray-500 text-sm">Good day,</Text>
        <Text className="text-2xl font-bold text-gray-900">{profile?.full_name?.split(' ')[^0] ?? 'Welcome'} 👋</Text>
      </View>

      {/* Search bar */}
      <TouchableOpacity
        onPress={() => router.push('/(customer)/(home)/search')}
        className="mx-5 mt-4 mb-2 flex-row items-center bg-white border border-gray-200 rounded-xl px-4 py-3 gap-2"
      >
        <Ionicons name="search-outline" size={18} color="#9ca3af" />
        <Text className="text-gray-400">Search stores or products...</Text>
      </TouchableOpacity>

      {/* Industry filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-5 py-3"
        contentContainerStyle={{ gap: 8 }}
      >
        {INDUSTRIES.map(industry => (
          <TouchableOpacity
            key={industry}
            onPress={() => setSelectedIndustry(industry)}
            className={`px-4 py-2 rounded-full border
              ${selectedIndustry === industry
                ? 'bg-primary-500 border-primary-500'
                : 'bg-white border-gray-200'}`}
          >
            <Text className={selectedIndustry === industry ? 'text-white font-semibold text-sm' : 'text-gray-600 text-sm'}>
              {industry}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Store list */}
      <View className="px-5 pb-8">
        <Text className="text-lg font-bold text-gray-900 mb-3">
          {filtered.length} Stores Near You
        </Text>
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl mb-3" />)
          : filtered.map(merchant => (
              <StoreCard
                key={merchant.id}
                merchant={merchant}
                onPress={() => router.push(`/(customer)/(store)/${merchant.store_slug}`)}
              />
            ))
        }
      </View>
    </ScrollView>
  )
}
```


### Block 4.9.2 — `app/(customer)/(store)/[storeSlug].tsx`

```typescript
import { View, Text, SectionList, TouchableOpacity, Image } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { merchantsService } from '@/services/merchants.service'
import { productsService } from '@/services/products.service'
import { ProductCard } from '@/components/product/ProductCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/utils'
import { Ionicons } from '@expo/vector-icons'

export default function StoreScreen() {
  const { storeSlug } = useLocalSearchParams<{ storeSlug: string }>()

  const { data: merchant, isLoading: loadingMerchant } = useQuery({
    queryKey: ['merchant', storeSlug],
    queryFn:  () => merchantsService.getBySlug(storeSlug),
    enabled:  !!storeSlug,
  })

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['products', merchant?.id],
    queryFn:  () => productsService.getByMerchant(merchant!.id),
    enabled:  !!merchant?.id,
  })

  // Group products by category for SectionList
  const sections = products.reduce<Array<{ title: string; data: typeof products }>>((acc, product) => {
    const categoryName = product.category?.name ?? 'Other'
    const existing = acc.find(s => s.title === categoryName)
    if (existing) existing.data.push(product)
    else acc.push({ title: categoryName, data: [product] })
    return acc
  }, [])

  if (loadingMerchant) return <Skeleton className="flex-1" />

  if (!merchant) return (
    <View className="flex-1 items-center justify-center">
      <Text className="text-gray-500">Store not found</Text>
    </View>
  )

  return (
    <View className="flex-1 bg-gray-50">
      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        ListHeaderComponent={() => (
          <View className="bg-white">
            {/* Banner */}
            <Image
              source={{ uri: merchant.banner_url ?? 'https://via.placeholder.com/400x150' }}
              className="w-full h-36"
            />
            {/* Back button */}
            <TouchableOpacity
              onPress={() => router.back()}
              className="absolute top-12 left-4 bg-white/80 p-2 rounded-full"
            >
              <Ionicons name="arrow-back" size={20} color="#111" />
            </TouchableOpacity>
            {/* Store info */}
            <View className="px-5 pt-4 pb-5">
              <Text className="text-2xl font-bold text-gray-900">{merchant.store_name}</Text>
              <Text className="text-gray-500 text-sm mt-1">{merchant.industry}</Text>
              <View className="flex-row items-center gap-4 mt-2">
                <View className="flex-row items-center gap-1">
                  <Ionicons name="star" size={14} color="#f59e0b" />
                  <Text className="text-sm font-semibold">{merchant.average_rating?.toFixed(1) ?? '–'}</Text>
                  <Text className="text-sm text-gray-400">({merchant.review_count ?? 0})</Text>
                </View>
                {merchant.min_order_amount > 0 && (
                  <Text className="text-sm text-gray-500">
                    Min order: {formatCurrency(merchant.min_order_amount)}
                  </Text>
                )}
              </View>
              {merchant.description && (
                <Text className="text-gray-600 text-sm mt-2">{merchant.description}</Text>
              )}
            </View>
          </View>
        )}
        renderSectionHeader={({ section: { title } }) => (
          <View className="px-5 py-2 bg-gray-100">
            <Text className="text-sm font-bold text-gray-700 uppercase tracking-wide">{title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            onPress={() => router.push(`/(customer)/(store)/${storeSlug}/product/${item.id}`)}
          />
        )}
        stickySectionHeadersEnabled
      />
    </View>
  )
}
```


### Block 4.9.3 — `app/(customer)/(store)/[storeSlug]/product/[productId].tsx`

```typescript
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { Image } from 'expo-image'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productsService } from '@/services/products.service'
import { useCartStore } from '@/stores/cartStore'
import { VariantSelector } from '@/components/product/VariantSelector'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import { Haptics } from 'expo-haptics'
import Toast from 'react-native-toast-message'

export default function ProductDetailScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>()
  const { addItem, merchantId } = useCartStore()
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn:  () => productsService.getById(productId),
  })

  if (isLoading || !product) return null

  const selectedVariant = product.variants.find(v => v.id === selectedVariantId) ?? null
  const finalPrice = product.price + (selectedVariant?.price_modifier ?? 0)
  const requiresVariant = product.variants.length > 0 && !selectedVariant

  const handleAddToCart = async () => {
    if (requiresVariant) {
      Toast.show({ type: 'error', text1: 'Please select a variant' })
      return
    }
    try {
      addItem(product, selectedVariant, quantity)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Toast.show({ type: 'success', text1: `${product.name} added to cart!` })
    } catch (err: any) {
      if (err.message === 'DIFFERENT_MERCHANT') {
        Alert.alert(
          'Start new cart?',
          'Your cart contains items from a different store. Clear it to add this item?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Clear & Add',
              style: 'destructive',
              onPress: () => {
                useCartStore.getState().clearCart()
                addItem(product, selectedVariant, quantity)
              },
            },
          ]
        )
      }
    }
  }

  return (
    <View className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Images */}
        <Image
          source={{ uri: product.images?.[^0] ?? 'https://via.placeholder.com/400x300' }}
          style={{ width: '100%', height: 300 }}
          contentFit="cover"
        />

        <View className="px-5 pt-5 pb-32">
          {/* Price & Name */}
          <Text className="text-2xl font-bold text-gray-900">{product.name}</Text>
          <View className="flex-row items-center gap-3 mt-1">
            <Text className="text-xl font-bold text-primary-600">{formatCurrency(finalPrice)}</Text>
            {product.compare_at_price && product.compare_at_price > product.price && (
              <Text className="text-base text-gray-400 line-through">
                {formatCurrency(product.compare_at_price)}
              </Text>
            )}
          </View>

          {/* Description */}
          {product.description && (
            <Text className="text-gray-600 mt-4 leading-relaxed">{product.description}</Text>
          )}

          {/* Variants */}
          {product.variants.length > 0 && (
            <VariantSelector
              variants={product.variants}
              selectedId={selectedVariantId}
              onSelect={setSelectedVariantId}
            />
          )}

          {/* Quantity selector */}
          <View className="flex-row items-center gap-4 mt-6">
            <Text className="font-semibold text-gray-700">Quantity</Text>
            <TouchableOpacity
              onPress={() => setQuantity(q => Math.max(1, q - 1))}
              className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center"
            >
              <Text className="text-lg font-bold text-gray-700">−</Text>
            </TouchableOpacity>
            <Text className="text-lg font-semibold w-6 text-center">{quantity}</Text>
            <TouchableOpacity
              onPress={() => setQuantity(q => Math.min(product.stock_quantity, q + 1))}
              className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center"
            >
              <Text className="text-lg font-bold text-gray-700">+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Add to Cart */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4">
        <Button onPress={handleAddToCart}>
          Add to Cart — {formatCurrency(finalPrice * quantity)}
        </Button>
      </View>
    </View>
  )
}
```


### Block 4.9.4 — `app/(customer)/(cart)/index.tsx`

```typescript
import { View, Text, FlatList, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { useCartStore } from '@/stores/cartStore'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'

export default function CartScreen() {
  const { items, merchantName, updateQuantity, removeItem, getTotal, getItemCount } = useCartStore()

  if (items.length === 0) {
    return (
      <EmptyState
        icon="cart-outline"
        title="Your cart is empty"
        description="Add some items from a store to get started."
        actionLabel="Browse Stores"
        onAction={() => router.push('/(customer)/(home)')}
      />
    )
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-5 pt-14 pb-4">
        <Text className="text-2xl font-bold text-gray-900">Your Cart</Text>
        {merchantName && <Text className="text-gray-500 text-sm">{merchantName}</Text>}
      </View>

      <FlatList
        data={items}
        keyExtractor={i => `${i.productId}-${i.variantId}`}
        contentContainerStyle={{ padding: 20, gap: 12 }}
        renderItem={({ item }) => (
          <View className="bg-white rounded-xl p-4 flex-row gap-3">
            <Image
              source={{ uri: item.imageUrl ?? 'https://via.placeholder.com/80' }}
              style={{ width: 72, height: 72, borderRadius: 8 }}
              contentFit="cover"
            />
            <View className="flex-1">
              <Text className="font-semibold text-gray-900" numberOfLines={2}>{item.productName}</Text>
              {item.variantName && <Text className="text-gray-500 text-xs">{item.variantName}</Text>}
              <Text className="text-primary-600 font-bold mt-1">{formatCurrency(item.price)}</Text>
              <View className="flex-row items-center gap-3 mt-2">
                <TouchableOpacity
                  onPress={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                  className="w-7 h-7 rounded-full bg-gray-100 items-center justify-center"
                >
                  <Text className="font-bold text-gray-700">−</Text>
                </TouchableOpacity>
                <Text className="font-semibold">{item.quantity}</Text>
                <TouchableOpacity
                  onPress={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                  className="w-7 h-7 rounded-full bg-gray-100 items-center justify-center"
                >
                  <Text className="font-bold text-gray-700">+</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => removeItem(item.productId, item.variantId)}
                  className="ml-auto"
                >
                  <Text className="text-red-500 text-sm">Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        ListFooterComponent={() => (
          <View className="bg-white rounded-xl p-4 gap-2">
            <View className="flex-row justify-between">
              <Text className="text-gray-500">Subtotal ({getItemCount()} items)</Text>
              <Text className="font-semibold">{formatCurrency(getTotal())}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-gray-500">Delivery fee</Text>
              <Text className="text-gray-400">Calculated at checkout</Text>
            </View>
          </View>
        )}
      />

      <View className="px-5 pb-8 pt-3 bg-white border-t border-gray-100">
        <View className="flex-row justify-between mb-4">
          <Text className="text-lg font-bold text-gray-900">Total</Text>
          <Text className="text-lg font-bold text-primary-600">{formatCurrency(getTotal())}</Text>
        </View>
        <Button onPress={() => router.push('/(customer)/(cart)/checkout')}>
          Proceed to Checkout
        </Button>
      </View>
    </View>
  )
}
```


### Block 4.9.5 — `app/(customer)/(orders)/index.tsx`

```typescript
import { View, Text, FlatList, RefreshControl } from 'react-native'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ordersService } from '@/services/orders.service'
import { useAuthStore } from '@/stores/authStore'
import { OrderCard } from '@/components/merchant/OrderCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'

export default function OrdersScreen() {
  const { user } = useAuthStore()

  const { data: orders = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['my-orders', user?.id],
    queryFn:  () => ordersService.getMyOrders(user!.id),
    enabled:  !!user?.id,
  })

  if (isLoading) return (
    <View className="flex-1 bg-gray-50 pt-14 px-5">
      <Text className="text-2xl font-bold text-gray-900 mb-5">My Orders</Text>
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl mb-3" />)}
    </View>
  )

  if (orders.length === 0) return (
    <EmptyState
      icon="receipt-outline"
      title="No orders yet"
      description="Your order history will appear here."
      actionLabel="Start Shopping"
      onAction={() => router.push('/(customer)/(home)')}
    />
  )

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-5 pt-14 pb-4">
        <Text className="text-2xl font-bold text-gray-900">My Orders</Text>
      </View>
      <FlatList
        data={orders}
        keyExtractor={o => o.id}
        contentContainerStyle={{ padding: 20, gap: 12 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            onPress={() => router.push(`/(customer)/(orders)/${item.id}`)}
          />
        )}
      />
    </View>
  )
}
```


***

## Step 4.10 — Merchant Screens

### Block 4.10.1 — `app/(merchant)/onboarding.tsx`

```typescript
import { View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { router } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { merchantsService } from '@/services/merchants.service'
import { useAuthStore } from '@/stores/authStore'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { generateSlug } from '@/lib/utils'
import Toast from 'react-native-toast-message'
import { useState } from 'react'

const INDUSTRIES = ['Food & Beverage','Retail','Pharmacy','Grocery','Fashion','Electronics','Beauty & Health','Services','Other']

const schema = z.object({
  store_name:   z.string().min(3, 'Store name must be at least 3 characters'),
  industry:     z.string().min(1, 'Select an industry'),
  description:  z.string().optional(),
  phone:        z.string().min(10, 'Enter a valid phone number'),
  address_line1:z.string().min(5, 'Enter your address'),
  city:         z.string().min(2),
  state:        z.string().min(2),
  postcode:     z.string().length(5, 'Malaysian postcodes are 5 digits'),
})

type FormData = z.infer<typeof schema>

export default function OnboardingScreen() {
  const { user, refreshMerchant } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndustry, setSelectedIndustry] = useState('')

  const { control, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      const slug = generateSlug(data.store_name)
      const available = await merchantsService.isSlugAvailable(slug)
      const finalSlug = available ? slug : `${slug}-${Date.now().toString().slice(-4)}`

      await merchantsService.create({
        owner_id:     user!.id,
        store_name:   data.store_name,
        store_slug:   finalSlug,
        industry:     data.industry,
        description:  data.description,
        phone:        data.phone,
        address_line1:data.address_line1,
        city:         data.city,
        state:        data.state,
        postcode:     data.postcode,
        country:      'MY',
      })

      await refreshMerchant()
      router.replace('/(merchant)/dashboard')
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed to create store', text2: err.message })
    }
    setIsLoading(false)
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView className="flex-1 px-5 pt-14" showsVerticalScrollIndicator={false}>
        <Text className="text-2xl font-bold text-gray-900 mb-1">Set up your store</Text>
        <Text className="text-gray-500 mb-6">This takes 2 minutes. You can edit everything later.</Text>

        <Controller control={control} name="store_name"
          render={({ field: { onChange, value } }) => (
            <Input label="Store Name" placeholder="e.g. Kedai Ahmad" value={value}
              onChangeText={(v) => { onChange(v); setValue('store_name', v) }}
              error={errors.store_name?.message} />
          )}
        />

        {/* Industry grid */}
        <Text className="text-sm font-semibold text-gray-700 mb-2 mt-2">Industry *</Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {INDUSTRIES.map(ind => (
            <TouchableOpacity
              key={ind}
              onPress={() => { setSelectedIndustry(ind); setValue('industry', ind) }}
              className={`px-3 py-2 rounded-lg border ${selectedIndustry === ind ? 'bg-primary-500 border-primary-500' : 'border-gray-200'}`}
            >
              <Text className={`text-sm ${selectedIndustry === ind ? 'text-white font-semibold' : 'text-gray-600'}`}>{ind}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.industry && <Text className="text-red-500 text-xs mb-3">{errors.industry.message}</Text>}

        <Controller control={control} name="phone"
          render={({ field: { onChange, value } }) => (
            <Input label="Business Phone" placeholder="0123456789" keyboardType="phone-pad" value={value} onChangeText={onChange} error={errors.phone?.message} />
          )}
        />
        <Controller control={control} name="address_line1"
          render={({ field: { onChange, value } }) => (
            <Input label="Address" placeholder="No. 1, Jalan Example" value={value} onChangeText={onChange} error={errors.address_line1?.message} />
          )}
        />
        <Controller control={control} name="city"
          render={({ field: { onChange, value } }) => (
            <Input label="City" placeholder="Kuala Lumpur" value={value} onChangeText={onChange} error={errors.city?.message} />
          )}
        />
        <Controller control={control} name="state"
          render={({ field: { onChange, value } }) => (
            <Input label="State" placeholder="Selangor" value={value} onChangeText={onChange} error={errors.state?.message} />
          )}
        />
        <Controller control={control} name="postcode"
          render={({ field: { onChange, value } }) => (
            <Input label="Postcode" placeholder="50000" keyboardType="numeric" maxLength={5} value={value} onChangeText={onChange} error={errors.postcode?.message} />
          )}
        />

        <Button onPress={handleSubmit(onSubmit)} loading={isLoading} className="mt-6 mb-12">
          Launch My Store 🚀
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
```


### Block 4.10.2 — `app/(merchant)/dashboard.tsx`

```typescript
import { View, Text, ScrollView, RefreshControl } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { StatCard } from '@/components/merchant/StatCard'
import { OrderCard } from '@/components/merchant/OrderCard'
import { router } from 'expo-router'
import { formatCurrency } from '@/lib/utils'

export default function MerchantDashboard() {
  const { merchant } = useAuthStore()

  const { data: stats, isRefetching, refetch } = useQuery({
    queryKey: ['merchant-stats', merchant?.id],
    queryFn: async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { data: todayOrders } = await supabase
        .from('orders')
        .select('total_amount, status')
        .eq('merchant_id', merchant!.id)
        .gte('created_at', today.toISOString())

      const { data: pendingOrders } = await supabase
        .from('orders')
        .select('*')
        .eq('merchant_id', merchant!.id)
        .in('status', ['paid', 'confirmed', 'preparing'])
        .order('created_at', { ascending: false })
        .limit(5)

      const { count: totalProducts } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchant!.id)
        .neq('status', 'deleted')

      return {
        todayRevenue: todayOrders?.filter(o => o.status !== 'cancelled')
          .reduce((sum, o) => sum + Number(o.total_amount), 0) ?? 0,
        todayOrders:  todayOrders?.length ?? 0,
        pendingCount: pendingOrders?.length ?? 0,
        pendingOrders: pendingOrders ?? [],
        totalProducts: totalProducts ?? 0,
      }
    },
    enabled: !!merchant?.id,
  })

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <View className="bg-white px-5 pt-14 pb-4">
        <Text className="text-gray-500 text-sm">Your Store</Text>
        <Text className="text-2xl font-bold text-gray-900">{merchant?.store_name}</Text>
        <View className={`mt-1 self-start px-2 py-0.5 rounded-full
          ${merchant?.status === 'active' ? 'bg-green-100' : 'bg-yellow-100'}`}>
          <Text className={`text-xs font-semibold capitalize
            ${merchant?.status === 'active' ? 'text-green-700' : 'text-yellow-700'}`}>
            {merchant?.status?.replace('_', ' ')}
          </Text>
        </View>
      </View>

      <View className="p-5 gap-3">
        {/* Stat cards */}
        <View className="flex-row gap-3">
          <StatCard label="Today's Revenue" value={formatCurrency(stats?.todayRevenue ?? 0)} icon="cash-outline" color="green" />
          <StatCard label="Today's Orders"  value={String(stats?.todayOrders ?? 0)} icon="receipt-outline" color="blue" />
        </View>
        <View className="flex-row gap-3">
          <StatCard label="Pending Orders"  value={String(stats?.pendingCount ?? 0)} icon="time-outline"    color="orange" />
          <StatCard label="Total Products"  value={String(stats?.totalProducts ?? 0)} icon="cube-outline"    color="purple" />
        </View>

        {/* Recent pending orders */}
        {(stats?.pendingOrders?.length ?? 0) > 0 && (
          <View className="mt-2">
            <Text className="text-base font-bold text-gray-900 mb-3">Action Required</Text>
            {stats!.pendingOrders.map((order: any) => (
              <OrderCard
                key={order.id}
                order={order}
                onPress={() => router.push(`/(merchant)/order/${order.id}`)}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  )
}
```


***

## Step 4.11 — Core UI Components

### Block 4.11.1 — `src/components/ui/Button.tsx`

```typescript
import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native'
import { cn } from '@/lib/utils'

interface ButtonProps {
  children: React.ReactNode
  onPress:  () => void
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'
  size?:    'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  className?: string
}

const variants = {
  primary: 'bg-primary-600 border-transparent',
  outline: 'bg-transparent border-primary-600',
  ghost:   'bg-transparent border-transparent',
  danger:  'bg-red-500 border-transparent',
}

const textColors = {
  primary: 'text-white',
  outline: 'text-primary-600',
  ghost:   'text-gray-700',
  danger:  'text-white',
}

const sizes = {
  sm: 'py-2 px-4 rounded-lg',
  md: 'py-3 px-6 rounded-xl',
  lg: 'py-4 px-8 rounded-2xl',
}

export function Button({
  children, onPress, variant = 'primary', size = 'md',
  loading = false, disabled = false, className,
}: ButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={cn(
        'border-2 items-center justify-center flex-row gap-2',
        variants[variant],
        sizes[size],
        (disabled || loading) && 'opacity-50',
        className,
      )}
      activeOpacity={0.8}
    >
      {loading && <ActivityIndicator size="small" color={variant === 'primary' ? '#fff' : '#2563eb'} />}
      <Text className={cn('font-semibold text-base', textColors[variant])}>
        {children}
      </Text>
    </TouchableOpacity>
  )
}
```


### Block 4.11.2 — `src/components/ui/Input.tsx`

```typescript
import { View, Text, TextInput, TextInputProps } from 'react-native'
import { cn } from '@/lib/utils'

interface InputProps extends TextInputProps {
  label?:     string
  error?:     string
  hint?:      string
  className?: string
}

export function Input({ label, error, hint, className, ...props }: InputProps) {
  return (
    <View className="mb-4">
      {label && <Text className="text-sm font-semibold text-gray-700 mb-1">{label}</Text>}
      <TextInput
        className={cn(
          'border rounded-xl px-4 py-3 text-gray-900 text-base bg-white',
          error ? 'border-red-400' : 'border-gray-200',
          className,
        )}
        placeholderTextColor="#9ca3af"
        {...props}
      />
      {error && <Text className="text-red-500 text-xs mt-1">{error}</Text>}
      {hint && !error && <Text className="text-gray-400 text-xs mt-1">{hint}</Text>}
    </View>
  )
}
```


### Block 4.11.3 — `src/components/ui/Skeleton.tsx`

```typescript
import { useEffect, useRef } from 'react'
import { Animated, View } from 'react-native'
import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,   duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start()
  }, [])

  return (
    <Animated.View
      style={{ opacity }}
      className={cn('bg-gray-200 rounded-xl', className)}
    />
  )
}
```


### Block 4.11.4 — `src/components/merchant/StoreCard.tsx`

```typescript
import { View, Text, TouchableOpacity } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import type { Merchant } from '@/types/app.types'

interface Props {
  merchant: Merchant & { average_rating?: number; review_count?: number }
  onPress:  () => void
}

export function StoreCard({ merchant, onPress }: Props) {
  return (
    <TouchableOpacity onPress={onPress} className="bg-white rounded-2xl mb-3 overflow-hidden shadow-sm" activeOpacity={0.8}>
      <Image
        source={{ uri: merchant.banner_url ?? 'https://via.placeholder.com/400x120' }}
        style={{ width: '100%', height: 100 }}
        contentFit="cover"
      />
      <View className="p-4 flex-row gap-3 items-center">
        <Image
          source={{ uri: merchant.logo_url ?? 'https://via.placeholder.com/50' }}
          style={{ width: 48, height: 48, borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb' }}
          contentFit="cover"
        />
        <View className="flex-1">
          <Text className="font-bold text-gray-900 text-base" numberOfLines={1}>{merchant.store_name}</Text>
          <Text className="text-gray-500 text-xs">{merchant.industry}</Text>
          <View className="flex-row items-center gap-1 mt-1">
            <Ionicons name="star" size={12} color="#f59e0b" />
            <Text className="text-xs font-semibold text-gray-700">
              {merchant.average_rating?.toFixed(1) ?? 'New'}
            </Text>
            {merchant.review_count != null && (
              <Text className="text-xs text-gray-400">({merchant.review_count})</Text>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
      </View>
    </TouchableOpacity>
  )
}
```


***

## Step 4.12 — TanStack Query Client

### Block 4.12.1 — Create `src/lib/queryClient.ts`

```typescript
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:  1000 * 60 * 2,  // 2 minutes
      retry:      2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error: any) => {
        console.error('[Mutation Error]', error.message)
      },
    },
  },
})
```


***

## Step 4.13 — Test the App End-to-End

Run each check in order. Do not proceed to Phase 5 until all pass.

```bash
# 4.13.1 — Start dev server
npx expo start

# 4.13.2 — Press 'w' to open web version in browser
# 4.13.3 — Scan QR code with Expo Go to test on physical phone
```

**Manual test checklist:**

- [ ] **Welcome screen** loads without errors
- [ ] **Register** as a customer — confirm email — login
- [ ] **Login** redirects to customer home screen
- [ ] **Home screen** shows loading skeletons then merchant list (empty at first — that's OK)
- [ ] **Register a merchant** account — login — see onboarding screen
- [ ] Fill in onboarding form — submit — see merchant dashboard
- [ ] **Merchant dashboard** shows store name and stat cards
- [ ] From merchant account: navigate to Products → no products yet
- [ ] **Sign out** from profile → goes back to welcome screen
- [ ] **Log back in** as customer → still shows customer home

```bash
# 4.13.4 — Check TypeScript for errors
npx tsc --noEmit
# Must show zero errors before committing

# 4.13.5 — Commit working state
git add .
git commit -m "feat: phase 4 complete — scaffold, auth, navigation, core screens"
```


***

## Phase 4 Completion Criteria

Phase 4 is **locked and ready for Phase 5** when ALL of the following are true:

- [ ] `npx tsc --noEmit` returns **zero errors**
- [ ] App runs on both **web** (`w`) and **mobile** (Expo Go) without crashing
- [ ] Auth flow works: register → confirm email → login → role-based redirect
- [ ] Merchant onboarding creates a `merchants` row in Supabase with correct `owner_id`
- [ ] Profile auto-creation trigger fires (check Supabase `profiles` table after signup)
- [ ] Cart correctly blocks adding items from two different merchants
- [ ] All 5 customer tab screens render without runtime errors
- [ ] All 4 merchant tab screens render without runtime errors
- [ ] `git log --oneline` shows a clean commit for Phase 4

Phase 5 (payment integration) will wire `app/(customer)/(cart)/checkout.tsx` to Razorpay and Billplz. Every service function, store, and type defined in Phase 4 is the exact contract Phase 5 depends on.[^6][^2][^4][^3]
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^20][^21][^22][^23][^24][^25][^26][^27][^28][^29][^30][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://dev.to/cathylai/how-to-set-up-nativewind-tailwind-css-in-your-expo-react-native-app-5g23

[^2]: https://supabase.com/docs/guides/auth/quickstarts/react-native

[^3]: https://oneuptime.com/blog/post/2026-01-15-react-native-zustand-state/view

[^4]: https://docs.expo.dev/router/advanced/authentication/

[^5]: https://dev.to/aaronksaunders/simplifying-auth-and-role-based-routing-with-stackprotected-in-expo-router-592m

[^6]: https://docs.expo.dev/router/basics/core-concepts/

[^7]: https://docs.expo.dev/router/introduction/

[^8]: https://www.youtube.com/watch?v=mzRgSxf5oRk

[^9]: https://www.reddit.com/r/reactnative/comments/1r9s5pa/react_navigation_vs_expo_router_what_are_you/

[^10]: https://github.com/expo/router/discussions/1

[^11]: https://www.answeroverflow.com/m/1034072605306667028

[^12]: https://github.com/expo/router/discussions/380

[^13]: https://uniquedevs.com/en/blog/how-to-master-expo-router-basics-best-practices-examples-and-comparisons/

[^14]: https://dev.to/fedorish/google-sign-in-using-supabase-and-react-native-expo-14jf

[^15]: https://www.welcomedeveloper.com/posts/navigation-expo-router-part2/

[^16]: https://expo.dev/blog/expo-app-folder-structure-best-practices

[^17]: https://docs.expo.dev/router/basics/layout/

[^18]: https://www.codesofphoenix.com/articles/expo/expo-router-nav

[^19]: https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native

[^20]: https://docs.expo.dev/router/advanced/protected/

[^21]: https://www.youtube.com/watch?v=XCTaMu0qnFY

[^22]: https://www.youtube.com/watch?v=zHZjJDTTHJg

[^23]: https://github.com/keith-kurak/expo-router-codemash-2025-lessons/blob/main/02-auth-and-api-routes.md

[^24]: https://dev.to/y3asin/react-native-expo-with-nativewind-v4-and-typescript-38j3

[^25]: https://www.youtube.com/watch?v=tAQvsjwnaW8

[^26]: https://4geeks.com/lesson/zustand-global-state-react-native

[^27]: https://www.youtube.com/watch?v=iqGcfw8SfBc

[^28]: https://github.com/expo/router/issues/334

[^29]: https://dev.to/ekwoster/building-scalable-applications-with-zustand-a-modern-state-management-solution-for-react-848

[^30]: https://www.youtube.com/watch?v=U2Hg-MAAz_M

