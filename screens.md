<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Continue with Cart, Orders, Profile

Here are all 10 files in exact copy-paste order. Zero placeholders.

***

## Cart Section (3 files)

### File 1 — `app/(customer)/(cart)/_layout.tsx`

```typescript
import { Stack } from 'expo-router'

export default function CartStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="checkout"
        options={{ animation: 'slide_from_right' }}
      />
    </Stack>
  )
}
```


***

### File 2 — `app/(customer)/(cart)/index.tsx`

```typescript
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  Animated,
} from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { useRef } from 'react'
import { Swipeable } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCartStore } from '@/stores/cartStore'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'

// ─── Swipeable delete row ──────────────────────────────────────────────────────
function RightAction(
  progress: Animated.AnimatedInterpolation<number>,
  _dragX: Animated.AnimatedInterpolation<number>,
  onDelete: () => void
) {
  const scale = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: [0.8, 1],
    extrapolate: 'clamp',
  })
  return (
    <TouchableOpacity
      onPress={onDelete}
      className="bg-red-500 justify-center items-center rounded-2xl ml-2 px-5 mb-3"
      style={{ width: 80 }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name="trash-outline" size={22} color="#fff" />
        <Text className="text-white text-xs mt-1 font-semibold">Remove</Text>
      </Animated.View>
    </TouchableOpacity>
  )
}

// ─── Single cart item row ──────────────────────────────────────────────────────
function CartItemRow({
  item,
  onRemove,
  onIncrement,
  onDecrement,
}: {
  item: any
  onRemove:    () => void
  onIncrement: () => void
  onDecrement: () => void
}) {
  const swipeRef = useRef<Swipeable>(null)

  const handleDelete = () => {
    swipeRef.current?.close()
    onRemove()
  }

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={40}
      renderRightActions={(progress, drag) => RightAction(progress, drag, handleDelete)}
    >
      <View
        className="bg-white rounded-2xl flex-row gap-3 p-3 mb-3"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 6,
          elevation: 2,
        }}
      >
        {/* Product image */}
        <Image
          source={
            item.imageUrl
              ? { uri: item.imageUrl }
              : require('../../../../assets/placeholder-logo.png')
          }
          style={{ width: 76, height: 76, borderRadius: 14 }}
          contentFit="cover"
        />

        <View className="flex-1 justify-between py-0.5">
          <View>
            <Text
              className="text-gray-900 font-semibold text-sm leading-tight"
              numberOfLines={2}
            >
              {item.productName}
            </Text>
            {item.variantName && (
              <View className="bg-gray-100 self-start rounded-full px-2 py-0.5 mt-1">
                <Text className="text-gray-500 text-xs">{item.variantName}</Text>
              </View>
            )}
          </View>

          <View className="flex-row items-center justify-between mt-2">
            <Text className="text-primary-600 font-bold text-base">
              {formatCurrency(item.price)}
            </Text>

            {/* Qty stepper */}
            <View className="flex-row items-center gap-2 bg-gray-50 rounded-xl px-2 py-1">
              <TouchableOpacity
                onPress={onDecrement}
                className="w-7 h-7 rounded-lg bg-white items-center justify-center"
                style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 }}
              >
                <Ionicons
                  name={item.quantity === 1 ? 'trash-outline' : 'remove'}
                  size={14}
                  color={item.quantity === 1 ? '#ef4444' : '#374151'}
                />
              </TouchableOpacity>

              <Text className="text-gray-900 font-bold text-sm w-5 text-center">
                {item.quantity}
              </Text>

              <TouchableOpacity
                onPress={onIncrement}
                className="w-7 h-7 rounded-lg bg-primary-500 items-center justify-center"
              >
                <Ionicons name="add" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Swipeable>
  )
}

// ─── Order summary card ────────────────────────────────────────────────────────
function SummaryCard({ subtotal }: { subtotal: number }) {
  return (
    <View
      className="bg-white rounded-2xl p-4 mb-4"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
    >
      <Text className="font-bold text-gray-900 mb-3">Order Summary</Text>

      <View className="gap-2">
        <View className="flex-row justify-between">
          <Text className="text-gray-500 text-sm">Subtotal</Text>
          <Text className="text-gray-900 font-semibold text-sm">
            {formatCurrency(subtotal)}
          </Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-gray-500 text-sm">Delivery fee</Text>
          <Text className="text-gray-400 text-sm italic">Calculated at checkout</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-gray-500 text-sm">Discount</Text>
          <Text className="text-green-600 font-semibold text-sm">—</Text>
        </View>

        <View className="border-t border-gray-100 pt-2 mt-1">
          <View className="flex-row justify-between">
            <Text className="font-bold text-gray-900">Estimated Total</Text>
            <Text className="font-bold text-primary-600 text-lg">
              {formatCurrency(subtotal)}
            </Text>
          </View>
          <Text className="text-gray-400 text-xs mt-0.5">
            + delivery fee will be added at checkout
          </Text>
        </View>
      </View>
    </View>
  )
}

// ─── Empty state ───────────────────────────────────────────────────────────────
function EmptyCart() {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <View className="w-24 h-24 rounded-full bg-primary-50 items-center justify-center mb-5">
        <Ionicons name="bag-outline" size={44} color="#2563eb" />
      </View>
      <Text className="text-xl font-bold text-gray-900 text-center">
        Your cart is empty
      </Text>
      <Text className="text-gray-400 text-sm text-center mt-2 leading-relaxed">
        Browse stores near you and add something delicious or useful.
      </Text>
      <TouchableOpacity
        onPress={() => router.push('/(customer)/(home)')}
        className="mt-6 bg-primary-500 rounded-2xl px-8 py-3"
      >
        <Text className="text-white font-semibold">Browse Stores</Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function CartScreen() {
  const insets = useSafeAreaInsets()
  const {
    items,
    merchantId,
    updateQuantity,
    removeItem,
    clearCart,
    getTotal,
    getItemCount,
  } = useCartStore()

  // Get merchant name from first item (we store it in cart)
  const merchantName = items[^0]?.productName ? undefined : undefined

  const handleClearCart = () => {
    Alert.alert('Clear cart?', 'Remove all items from your cart?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: clearCart,
      },
    ])
  }

  if (items.length === 0) {
    return (
      <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
        <View className="px-5 pt-4 pb-3">
          <Text className="text-2xl font-bold text-gray-900">Cart</Text>
        </View>
        <EmptyCart />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white px-5 pt-4 pb-3 flex-row items-center justify-between border-b border-gray-100">
        <View>
          <Text className="text-2xl font-bold text-gray-900">Cart</Text>
          <Text className="text-gray-400 text-sm">{getItemCount()} item{getItemCount() !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity onPress={handleClearCart} className="flex-row items-center gap-1">
          <Ionicons name="trash-outline" size={14} color="#ef4444" />
          <Text className="text-red-500 text-sm font-medium">Clear all</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => `${i.productId}-${i.variantId ?? 'none'}`}
        contentContainerStyle={{ padding: 16, paddingBottom: 200 }}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={() => <SummaryCard subtotal={getTotal()} />}
        renderItem={({ item }) => (
          <CartItemRow
            item={item}
            onRemove={() => removeItem(item.productId, item.variantId)}
            onIncrement={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
            onDecrement={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
          />
        )}
      />

      {/* Sticky checkout bar */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 pt-3"
        style={{ paddingBottom: insets.bottom + 8 }}
      >
        <View className="flex-row justify-between items-baseline mb-3">
          <Text className="text-gray-500 text-sm">Total</Text>
          <Text className="text-2xl font-bold text-gray-900">
            {formatCurrency(getTotal())}
          </Text>
        </View>
        <Button onPress={() => router.push('/(customer)/(cart)/checkout')}>
          Proceed to Checkout →
        </Button>
      </View>
    </View>
  )
}
```


***

### File 3 — `app/(customer)/(cart)/checkout.tsx`

```typescript
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useCartStore } from '@/stores/cartStore'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import Toast from 'react-native-toast-message'
import type { Address } from '@/types/app.types'

// ─── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View
      className="bg-white rounded-2xl p-4 mb-3"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
    >
      <Text className="font-bold text-gray-900 mb-3">{title}</Text>
      {children}
    </View>
  )
}

// ─── Address picker ────────────────────────────────────────────────────────────
function AddressPicker({
  addresses,
  selected,
  onSelect,
}: {
  addresses: Address[]
  selected:  Address | null
  onSelect:  (a: Address) => void
}) {
  if (addresses.length === 0) {
    return (
      <TouchableOpacity
        onPress={() => router.push('/(customer)/(profile)/addresses')}
        className="flex-row items-center gap-3 p-3 border-2 border-dashed border-gray-200 rounded-xl"
      >
        <Ionicons name="add-circle-outline" size={20} color="#2563eb" />
        <Text className="text-primary-600 font-medium">Add delivery address</Text>
      </TouchableOpacity>
    )
  }

  return (
    <View className="gap-2">
      {addresses.map((addr) => (
        <TouchableOpacity
          key={addr.id}
          onPress={() => onSelect(addr)}
          className={`flex-row items-start gap-3 p-3 rounded-xl border-2
            ${selected?.id === addr.id ? 'border-primary-500 bg-primary-50' : 'border-gray-100'}`}
        >
          <View
            className={`w-5 h-5 rounded-full border-2 mt-0.5 items-center justify-center
              ${selected?.id === addr.id ? 'border-primary-500' : 'border-gray-300'}`}
          >
            {selected?.id === addr.id && (
              <View className="w-2.5 h-2.5 rounded-full bg-primary-500" />
            )}
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="font-semibold text-gray-900 text-sm">{addr.label}</Text>
              {addr.is_default && (
                <View className="bg-primary-100 rounded-full px-1.5 py-0.5">
                  <Text className="text-primary-700 text-[10px] font-semibold">Default</Text>
                </View>
              )}
            </View>
            <Text className="text-gray-600 text-xs mt-0.5">{addr.recipient_name} · {addr.phone}</Text>
            <Text className="text-gray-500 text-xs mt-0.5" numberOfLines={2}>
              {addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ''}, {addr.city}, {addr.state} {addr.postcode}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        onPress={() => router.push('/(customer)/(profile)/addresses')}
        className="flex-row items-center gap-2 pt-1"
      >
        <Ionicons name="add-circle-outline" size={16} color="#2563eb" />
        <Text className="text-primary-600 text-sm font-medium">Add new address</Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── Payment method picker ─────────────────────────────────────────────────────
type PaymentMethod = 'razorpay' | 'billplz' | 'cod'

const PAYMENT_OPTIONS: { id: PaymentMethod; label: string; subtitle: string; icon: string }[] = [
  { id: 'razorpay', label: 'Card / E-wallet', subtitle: 'Visa, Mastercard, Touch \'n Go, GrabPay', icon: '💳' },
  { id: 'billplz',  label: 'Online Banking (FPX)', subtitle: 'Maybank, CIMB, RHB, and more',        icon: '🏦' },
  { id: 'cod',      label: 'Cash on Delivery',     subtitle: 'Pay when your order arrives',         icon: '💵' },
]

function PaymentPicker({
  selected,
  onSelect,
}: {
  selected: PaymentMethod | null
  onSelect: (m: PaymentMethod) => void
}) {
  return (
    <View className="gap-2">
      {PAYMENT_OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt.id}
          onPress={() => onSelect(opt.id)}
          className={`flex-row items-center gap-3 p-3 rounded-xl border-2
            ${selected === opt.id ? 'border-primary-500 bg-primary-50' : 'border-gray-100'}`}
        >
          <Text className="text-2xl">{opt.icon}</Text>
          <View className="flex-1">
            <Text className="font-semibold text-gray-900 text-sm">{opt.label}</Text>
            <Text className="text-gray-400 text-xs mt-0.5">{opt.subtitle}</Text>
          </View>
          <View
            className={`w-5 h-5 rounded-full border-2
              ${selected === opt.id ? 'border-primary-500' : 'border-gray-300'}`}
          >
            {selected === opt.id && (
              <View className="flex-1 m-0.5 rounded-full bg-primary-500" />
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  )
}

// ─── Order items summary ───────────────────────────────────────────────────────
function OrderItems() {
  const items = useCartStore((s) => s.items)
  const getTotal = useCartStore((s) => s.getTotal)

  return (
    <View className="gap-2">
      {items.map((item) => (
        <View
          key={`${item.productId}-${item.variantId}`}
          className="flex-row justify-between items-center"
        >
          <View className="flex-1">
            <Text className="text-gray-800 text-sm font-medium" numberOfLines={1}>
              {item.productName}
              {item.variantName ? ` (${item.variantName})` : ''}
            </Text>
            <Text className="text-gray-400 text-xs">× {item.quantity}</Text>
          </View>
          <Text className="text-gray-900 font-semibold text-sm ml-2">
            {formatCurrency(item.price * item.quantity)}
          </Text>
        </View>
      ))}

      <View className="border-t border-gray-100 pt-2 mt-1 flex-row justify-between">
        <Text className="text-gray-500 text-sm">Subtotal</Text>
        <Text className="text-gray-900 font-semibold text-sm">
          {formatCurrency(getTotal())}
        </Text>
      </View>
      <View className="flex-row justify-between">
        <Text className="text-gray-500 text-sm">Delivery</Text>
        <Text className="text-gray-400 text-sm italic">Calculated</Text>
      </View>
    </View>
  )
}

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function CheckoutScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()
  const { items, merchantId, getTotal, clearCart } = useCartStore()

  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null)
  const [paymentMethod, setPaymentMethod]     = useState<PaymentMethod | null>(null)
  const [isPlacing, setIsPlacing]             = useState(false)

  // Fetch saved addresses
  const { data: addresses = [] } = useQuery<Address[]>({
    queryKey: ['addresses', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user!.id)
        .order('is_default', { ascending: false })
      // Auto-select default
      const def = data?.find((a) => a.is_default)
      if (def) setSelectedAddress(def)
      return data ?? []
    },
    enabled: !!user?.id,
  })

  const canPlace = !!selectedAddress && !!paymentMethod && items.length > 0

  const handlePlaceOrder = async () => {
    if (!canPlace) return
    setIsPlacing(true)
    try {
      // Phase 5 will call payment Edge Functions here
      // For now, create the order record directly
      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          merchant_id:      merchantId!,
          customer_id:      user!.id,
          status:           'pending',
          subtotal:         getTotal(),
          delivery_fee:     0,
          discount_amount:  0,
          total_amount:     getTotal(),
          payment_method:   paymentMethod,
          payment_status:   paymentMethod === 'cod' ? 'unpaid' : 'pending_verification',
          delivery_address: {
            name:     selectedAddress.recipient_name,
            phone:    selectedAddress.phone,
            line1:    selectedAddress.address_line1,
            line2:    selectedAddress.address_line2,
            city:     selectedAddress.city,
            state:    selectedAddress.state,
            postcode: selectedAddress.postcode,
          },
        })
        .select()
        .single()

      if (error) throw error

      // Insert order items
      await supabase.from('order_items').insert(
        items.map((i) => ({
          order_id:     order.id,
          product_id:   i.productId,
          variant_id:   i.variantId,
          product_name: i.productName,
          variant_name: i.variantName,
          unit_price:   i.price,
          quantity:     i.quantity,
          line_total:   i.price * i.quantity,
        }))
      )

      clearCart()
      router.replace(`/(customer)/(orders)/${order.id}`)
      Toast.show({ type: 'success', text1: 'Order placed! 🎉', text2: `Order #${order.order_number}` })
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed to place order', text2: err.message })
    }
    setIsPlacing(false)
  }

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white px-5 pt-4 pb-3 flex-row items-center gap-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Checkout</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
        <Section title="🏠  Delivery Address">
          <AddressPicker
            addresses={addresses}
            selected={selectedAddress}
            onSelect={setSelectedAddress}
          />
        </Section>

        <Section title="📦  Your Order">
          <OrderItems />
        </Section>

        <Section title="💳  Payment Method">
          <PaymentPicker selected={paymentMethod} onSelect={setPaymentMethod} />
        </Section>

        {/* Terms note */}
        <Text className="text-gray-400 text-xs text-center px-4 mt-2 leading-relaxed">
          By placing your order you agree to our Terms of Service and Privacy Policy.
          Delivery fees are calculated by the delivery provider.
        </Text>
      </ScrollView>

      {/* Sticky bottom CTA */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 pt-3"
        style={{ paddingBottom: insets.bottom + 8 }}
      >
        <View className="flex-row justify-between items-baseline mb-3">
          <Text className="text-gray-500 text-sm">Total (excl. delivery)</Text>
          <Text className="text-xl font-bold text-gray-900">{formatCurrency(getTotal())}</Text>
        </View>
        <Button
          onPress={handlePlaceOrder}
          disabled={!canPlace}
          loading={isPlacing}
        >
          {paymentMethod === 'cod' ? 'Place Order (COD)' : 'Continue to Payment →'}
        </Button>
        {!canPlace && (
          <Text className="text-gray-400 text-xs text-center mt-2">
            {!selectedAddress ? 'Select a delivery address' : 'Select a payment method'}
          </Text>
        )}
      </View>
    </View>
  )
}
```


***

## Orders Section (3 files)

### File 4 — `app/(customer)/(orders)/_layout.tsx`

```typescript
import { Stack } from 'expo-router'

export default function OrdersStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="[orderId]"
        options={{ animation: 'slide_from_right' }}
      />
    </Stack>
  )
}
```


***

### File 5 — `app/(customer)/(orders)/index.tsx`

```typescript
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ordersService } from '@/services/orders.service'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, formatRelativeTime } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending:          { label: 'Pending',        color: '#92400e', bg: '#fef3c7', icon: 'time-outline'           },
  paid:             { label: 'Paid',           color: '#065f46', bg: '#d1fae5', icon: 'checkmark-circle-outline'},
  confirmed:        { label: 'Confirmed',      color: '#1e40af', bg: '#dbeafe', icon: 'checkmark-done-outline'  },
  preparing:        { label: 'Preparing',      color: '#5b21b6', bg: '#ede9fe', icon: 'restaurant-outline'      },
  ready_for_pickup: { label: 'Ready',          color: '#0e7490', bg: '#cffafe', icon: 'bag-check-outline'       },
  out_for_delivery: { label: 'On the way',     color: '#0369a1', bg: '#e0f2fe', icon: 'bicycle-outline'         },
  delivered:        { label: 'Delivered',      color: '#166534', bg: '#dcfce7', icon: 'checkmark-done-circle-outline'},
  cancelled:        { label: 'Cancelled',      color: '#991b1b', bg: '#fee2e2', icon: 'close-circle-outline'    },
  refunded:         { label: 'Refunded',       color: '#4b5563', bg: '#f3f4f6', icon: 'return-down-back-outline'},
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return (
    <View
      className="flex-row items-center gap-1 rounded-full px-2.5 py-1 self-start"
      style={{ backgroundColor: cfg.bg }}
    >
      <Ionicons name={cfg.icon} size={12} color={cfg.color} />
      <Text style={{ color: cfg.color, fontSize: 11, fontWeight: '700' }}>
        {cfg.label}
      </Text>
    </View>
  )
}

// ─── Filter tabs ───────────────────────────────────────────────────────────────
const FILTER_TABS = [
  { key: 'all',      label: 'All'       },
  { key: 'active',   label: 'Active'    },
  { key: 'delivered',label: 'Delivered' },
  { key: 'cancelled',label: 'Cancelled' },
]

const ACTIVE_STATUSES = ['pending','paid','confirmed','preparing','ready_for_pickup','out_for_delivery']

function filterOrders(orders: any[], tab: string) {
  if (tab === 'all')       return orders
  if (tab === 'active')    return orders.filter(o => ACTIVE_STATUSES.includes(o.status))
  return orders.filter(o => o.status === tab)
}

// ─── Order card ────────────────────────────────────────────────────────────────
function OrderCard({ order, onPress }: { order: any; onPress: () => void }) {
  const itemCount = order.items?.length ?? 0
  const firstItem = order.items?.[^0]

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="bg-white rounded-2xl p-4 mb-3"
      style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}
    >
      {/* Top row: store + time */}
      <View className="flex-row items-center gap-3 mb-3">
        <Image
          source={
            order.merchant?.logo_url
              ? { uri: order.merchant.logo_url }
              : require('../../../../assets/placeholder-logo.png')
          }
          style={{ width: 40, height: 40, borderRadius: 10 }}
          contentFit="cover"
        />
        <View className="flex-1">
          <Text className="font-bold text-gray-900 text-sm" numberOfLines={1}>
            {order.merchant?.store_name ?? 'Store'}
          </Text>
          <Text className="text-gray-400 text-xs">{formatRelativeTime(order.created_at)}</Text>
        </View>
        <StatusBadge status={order.status} />
      </View>

      {/* Divider */}
      <View className="h-px bg-gray-50 mb-3" />

      {/* Items preview */}
      <Text className="text-gray-700 text-sm" numberOfLines={2}>
        {order.items?.map((i: any) => `${i.product_name} ×${i.quantity}`).join(', ') ?? 'Items'}
      </Text>

      {/* Bottom row: total + order number */}
      <View className="flex-row justify-between items-center mt-3">
        <View>
          <Text className="text-gray-400 text-xs">{order.order_number}</Text>
          <Text className="text-gray-400 text-xs">{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
        </View>
        <View className="items-end">
          <Text className="text-primary-600 font-bold text-base">
            {formatCurrency(Number(order.total_amount))}
          </Text>
          <View className="flex-row items-center gap-1">
            <Text className="text-gray-400 text-xs">View details</Text>
            <Ionicons name="chevron-forward" size={12} color="#9ca3af" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function OrdersScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('all')

  const { data: orders = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['my-orders', user?.id],
    queryFn:  () => ordersService.getMyOrders(user!.id),
    enabled:  !!user?.id,
  })

  const filtered = filterOrders(orders, activeTab)

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white px-5 pt-4 pb-0 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900 mb-3">My Orders</Text>

        {/* Filter tabs */}
        <View className="flex-row gap-1">
          {FILTER_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className={`px-3 py-2 rounded-t-xl border-b-2
                ${activeTab === tab.key
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-transparent'}`}
            >
              <Text
                className={`text-sm font-semibold
                  ${activeTab === tab.key ? 'text-primary-600' : 'text-gray-500'}`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View className="p-4 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
            <Ionicons name="receipt-outline" size={36} color="#9ca3af" />
          </View>
          <Text className="text-lg font-bold text-gray-700 text-center">
            No {activeTab === 'all' ? '' : activeTab} orders
          </Text>
          <Text className="text-gray-400 text-sm text-center mt-1">
            {activeTab === 'all'
              ? 'Your order history will appear here.'
              : `You have no ${activeTab} orders.`}
          </Text>
          {activeTab === 'all' && (
            <TouchableOpacity
              onPress={() => router.push('/(customer)/(home)')}
              className="mt-5 bg-primary-500 rounded-2xl px-6 py-3"
            >
              <Text className="text-white font-semibold">Start Shopping</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#2563eb"
            />
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onPress={() => router.push(`/(customer)/(orders)/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  )
}
```


***

### File 6 — `app/(customer)/(orders)/[orderId].tsx`

```typescript
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ordersService } from '@/services/orders.service'
import { formatCurrency } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'

// ─── Status config (same as orders list) ──────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap; description: string }> = {
  pending:          { label: 'Pending Payment',    color: '#92400e', bg: '#fef3c7', icon: 'time-outline',                  description: 'Waiting for payment confirmation'       },
  paid:             { label: 'Payment Received',   color: '#065f46', bg: '#d1fae5', icon: 'checkmark-circle-outline',       description: 'Your payment was received'              },
  confirmed:        { label: 'Order Confirmed',    color: '#1e40af', bg: '#dbeafe', icon: 'checkmark-done-outline',          description: 'The merchant confirmed your order'     },
  preparing:        { label: 'Preparing',          color: '#5b21b6', bg: '#ede9fe', icon: 'restaurant-outline',              description: 'Merchant is preparing your order'      },
  ready_for_pickup: { label: 'Ready for Pickup',   color: '#0e7490', bg: '#cffafe', icon: 'bag-check-outline',               description: 'Your order is packed and ready'        },
  out_for_delivery: { label: 'Out for Delivery',   color: '#0369a1', bg: '#e0f2fe', icon: 'bicycle-outline',                 description: 'Courier is on the way to you'          },
  delivered:        { label: 'Delivered',          color: '#166534', bg: '#dcfce7', icon: 'checkmark-done-circle-outline',   description: 'Order successfully delivered'          },
  cancelled:        { label: 'Cancelled',          color: '#991b1b', bg: '#fee2e2', icon: 'close-circle-outline',            description: 'This order was cancelled'              },
  refunded:         { label: 'Refunded',           color: '#4b5563', bg: '#f3f4f6', icon: 'return-down-back-outline',        description: 'Refund has been processed'             },
}

// Order steps in sequence
const ORDER_STEPS = [
  'pending',
  'paid',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'out_for_delivery',
  'delivered',
]

// ─── Tracking timeline ─────────────────────────────────────────────────────────
function TrackingTimeline({ currentStatus }: { currentStatus: string }) {
  const isCancelled = currentStatus === 'cancelled' || currentStatus === 'refunded'

  if (isCancelled) {
    const cfg = STATUS_CONFIG[currentStatus]
    return (
      <View className="items-center py-4 gap-2">
        <View
          className="w-16 h-16 rounded-full items-center justify-center"
          style={{ backgroundColor: cfg.bg }}
        >
          <Ionicons name={cfg.icon} size={32} color={cfg.color} />
        </View>
        <Text style={{ color: cfg.color, fontWeight: '700', fontSize: 15 }}>{cfg.label}</Text>
        <Text className="text-gray-400 text-sm text-center">{cfg.description}</Text>
      </View>
    )
  }

  const currentIdx = ORDER_STEPS.indexOf(currentStatus)

  return (
    <View className="py-2">
      {ORDER_STEPS.map((step, idx) => {
        const cfg      = STATUS_CONFIG[step]
        const isDone   = idx <= currentIdx
        const isActive = idx === currentIdx
        const isLast   = idx === ORDER_STEPS.length - 1

        return (
          <View key={step} className="flex-row gap-3">
            {/* Line + dot column */}
            <View className="items-center" style={{ width: 28 }}>
              {/* Top connector line */}
              {idx > 0 && (
                <View
                  style={{
                    width: 2,
                    height: 16,
                    backgroundColor: idx <= currentIdx ? '#2563eb' : '#e5e7eb',
                  }}
                />
              )}
              {/* Dot */}
              <View
                style={{
                  width: isActive ? 28 : 20,
                  height: isActive ? 28 : 20,
                  borderRadius: isActive ? 14 : 10,
                  backgroundColor: isDone
                    ? (isActive ? '#2563eb' : '#93c5fd')
                    : '#e5e7eb',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginVertical: isActive ? -4 : 0,
                }}
              >
                {isDone && (
                  <Ionicons
                    name={isActive ? cfg.icon : 'checkmark'}
                    size={isActive ? 14 : 11}
                    color="#fff"
                  />
                )}
              </View>
              {/* Bottom connector line */}
              {!isLast && (
                <View
                  style={{
                    width: 2,
                    flex: 1,
                    minHeight: 16,
                    backgroundColor: idx < currentIdx ? '#2563eb' : '#e5e7eb',
                  }}
                />
              )}
            </View>

            {/* Text column */}
            <View
              className={`pb-4 flex-1 ${idx === 0 ? 'pt-1' : 'pt-0'}`}
              style={{ paddingTop: idx > 0 && idx <= currentIdx ? 16 : 16 }}
            >
              <Text
                style={{
                  fontWeight: isActive ? '700' : '500',
                  fontSize: isActive ? 14 : 13,
                  color: isDone ? '#111827' : '#9ca3af',
                }}
              >
                {cfg.label}
              </Text>
              {isActive && (
                <Text className="text-gray-500 text-xs mt-0.5">{cfg.description}</Text>
              )}
            </View>
          </View>
        )
      })}
    </View>
  )
}

// ─── Section card ──────────────────────────────────────────────────────────────
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View
      className="bg-white rounded-2xl p-4 mb-3"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
    >
      <Text className="font-bold text-gray-900 mb-3">{title}</Text>
      {children}
    </View>
  )
}

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const insets = useSafeAreaInsets()

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn:  () => ordersService.getById(orderId),
    refetchInterval: 30_000, // poll every 30s for live updates
  })

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50 p-4" style={{ paddingTop: insets.top + 60 }}>
        <Skeleton className="h-32 rounded-2xl mb-3" />
        <Skeleton className="h-48 rounded-2xl mb-3" />
        <Skeleton className="h-32 rounded-2xl" />
      </View>
    )
  }

  if (!order) return (
    <View className="flex-1 items-center justify-center">
      <Text className="text-gray-400">Order not found</Text>
    </View>
  )

  const cfg         = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
  const deliveryAddr = order.delivery_address as any

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white px-5 pt-4 pb-3 flex-row items-center gap-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900">Order Details</Text>
          <Text className="text-gray-400 text-xs">{order.order_number}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status hero */}
        <View
          className="rounded-2xl p-5 mb-3 items-center"
          style={{ backgroundColor: cfg.bg }}
        >
          <View
            className="w-16 h-16 rounded-full bg-white/60 items-center justify-center mb-3"
          >
            <Ionicons name={cfg.icon} size={32} color={cfg.color} />
          </View>
          <Text style={{ color: cfg.color, fontWeight: '800', fontSize: 18 }}>
            {cfg.label}
          </Text>
          <Text style={{ color: cfg.color, opacity: 0.75, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
            {cfg.description}
          </Text>

          {/* Delivery tracking link */}
          {order.delivery_tracking_url && (
            <TouchableOpacity
              onPress={() => Linking.openURL(order.delivery_tracking_url!)}
              className="mt-3 bg-white/80 rounded-full px-4 py-2 flex-row items-center gap-2"
            >
              <Ionicons name="location-outline" size={14} color={cfg.color} />
              <Text style={{ color: cfg.color, fontWeight: '600', fontSize: 13 }}>
                Track delivery
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Store info */}
        <SectionCard title="🏪  Store">
          <View className="flex-row items-center gap-3">
            <Image
              source={
                order.merchant?.logo_url
                  ? { uri: order.merchant.logo_url }
                  : require('../../../../assets/placeholder-logo.png')
              }
              style={{ width: 44, height: 44, borderRadius: 10 }}
              contentFit="cover"
            />
            <View>
              <Text className="font-bold text-gray-900">{order.merchant?.store_name}</Text>
              <TouchableOpacity
                onPress={() => router.push(`/(customer)/(store)/${order.merchant?.store_name}`)}
              >
                <Text className="text-primary-600 text-xs font-medium">Visit store →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SectionCard>

        {/* Progress tracker */}
        <SectionCard title="📍  Order Progress">
          <TrackingTimeline currentStatus={order.status} />
        </SectionCard>

        {/* Order items */}
        <SectionCard title="🛍️  Items Ordered">
          <View className="gap-3">
            {order.items?.map((item: any) => (
              <View key={item.id} className="flex-row justify-between items-start">
                <View className="flex-1">
                  <Text className="text-gray-800 font-medium text-sm" numberOfLines={2}>
                    {item.product_name}
                  </Text>
                  {item.variant_name && (
                    <Text className="text-gray-400 text-xs">{item.variant_name}</Text>
                  )}
                  <Text className="text-gray-500 text-xs mt-0.5">
                    {formatCurrency(item.unit_price)} × {item.quantity}
                  </Text>
                </View>
                <Text className="text-gray-900 font-semibold text-sm ml-2">
                  {formatCurrency(item.line_total)}
                </Text>
              </View>
            ))}

            {/* Price breakdown */}
            <View className="border-t border-gray-100 pt-3 gap-1.5 mt-1">
              <View className="flex-row justify-between">
                <Text className="text-gray-500 text-sm">Subtotal</Text>
                <Text className="text-gray-900 text-sm font-medium">
                  {formatCurrency(Number(order.subtotal))}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-500 text-sm">Delivery fee</Text>
                <Text className="text-gray-900 text-sm font-medium">
                  {order.delivery_fee > 0
                    ? formatCurrency(Number(order.delivery_fee))
                    : 'Free'}
                </Text>
              </View>
              {order.discount_amount > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-green-600 text-sm">Discount</Text>
                  <Text className="text-green-600 text-sm font-medium">
                    -{formatCurrency(Number(order.discount_amount))}
                  </Text>
                </View>
              )}
              <View className="flex-row justify-between border-t border-gray-100 pt-2 mt-1">
                <Text className="text-gray-900 font-bold">Total</Text>
                <Text className="text-primary-600 font-bold text-lg">
                  {formatCurrency(Number(order.total_amount))}
                </Text>
              </View>
            </View>
          </View>
        </SectionCard>

        {/* Delivery address */}
        {deliveryAddr && (
          <SectionCard title="📬  Delivery Address">
            <Text className="text-gray-800 font-semibold text-sm">
              {deliveryAddr.name}
            </Text>
            <Text className="text-gray-500 text-sm mt-0.5">{deliveryAddr.phone}</Text>
            <Text className="text-gray-500 text-sm mt-0.5">
              {deliveryAddr.line1}
              {deliveryAddr.line2 ? `, ${deliveryAddr.line2}` : ''},
              {' '}{deliveryAddr.city}, {deliveryAddr.state} {deliveryAddr.postcode}
            </Text>
          </SectionCard>
        )}

        {/* Payment info */}
        <SectionCard title="💳  Payment">
          <View className="flex-row justify-between">
            <Text className="text-gray-500 text-sm">Method</Text>
            <Text className="text-gray-900 text-sm font-medium capitalize">
              {order.payment_method?.replace('_', ' ') ?? '—'}
            </Text>
          </View>
          <View className="flex-row justify-between mt-1.5">
            <Text className="text-gray-500 text-sm">Status</Text>
            <View
              className="rounded-full px-2 py-0.5"
              style={{
                backgroundColor:
                  order.payment_status === 'paid' ? '#dcfce7' : '#fef3c7',
              }}
            >
              <Text
                className="text-xs font-semibold capitalize"
                style={{
                  color: order.payment_status === 'paid' ? '#166534' : '#92400e',
                }}
              >
                {order.payment_status?.replace('_', ' ')}
              </Text>
            </View>
          </View>
          {order.payment_reference && (
            <View className="flex-row justify-between mt-1.5">
              <Text className="text-gray-500 text-sm">Reference</Text>
              <Text className="text-gray-700 text-xs font-mono">{order.payment_reference}</Text>
            </View>
          )}
        </SectionCard>

        {/* Leave review (delivered orders only) */}
        {order.status === 'delivered' && (
          <TouchableOpacity
            className="bg-primary-500 rounded-2xl p-4 flex-row items-center justify-center gap-2"
          >
            <Ionicons name="star-outline" size={18} color="#fff" />
            <Text className="text-white font-bold">Leave a Review</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  )
}
```


***

## Profile Section (4 files)

### File 7 — `app/(customer)/(profile)/_layout.tsx`

```typescript
import { Stack } from 'expo-router'

export default function ProfileStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="edit"      options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="addresses" options={{ animation: 'slide_from_right' }} />
    </Stack>
  )
}
```


***

### File 8 — `app/(customer)/(profile)/index.tsx`

```typescript
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '@/stores/authStore'

// ─── Menu item ─────────────────────────────────────────────────────────────────
function MenuItem({
  icon,
  label,
  sublabel,
  onPress,
  danger = false,
  badge,
}: {
  icon:      keyof typeof Ionicons.glyphMap
  label:     string
  sublabel?: string
  onPress:   () => void
  danger?:   boolean
  badge?:    string
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row items-center gap-3 py-3.5 px-4"
    >
      <View
        className={`w-10 h-10 rounded-xl items-center justify-center
          ${danger ? 'bg-red-50' : 'bg-gray-100'}`}
      >
        <Ionicons name={icon} size={20} color={danger ? '#ef4444' : '#374151'} />
      </View>
      <View className="flex-1">
        <Text
          className={`font-semibold text-sm ${danger ? 'text-red-500' : 'text-gray-900'}`}
        >
          {label}
        </Text>
        {sublabel && (
          <Text className="text-gray-400 text-xs mt-0.5">{sublabel}</Text>
        )}
      </View>
      {badge && (
        <View className="bg-primary-500 rounded-full px-2 py-0.5 mr-1">
          <Text className="text-white text-[10px] font-bold">{badge}</Text>
        </View>
      )}
      {!danger && (
        <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
      )}
    </TouchableOpacity>
  )
}

function MenuGroup({ children }: { children: React.ReactNode }) {
  return (
    <View
      className="bg-white rounded-2xl overflow-hidden mb-3"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
    >
      {children}
    </View>
  )
}

function Separator() {
  return <View className="h-px bg-gray-50 mx-4" />
}

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const { profile, signOut } = useAuthStore()

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: signOut,
      },
    ])
  }

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View className="bg-white px-5 pt-4 pb-5 mb-3">
          <Text className="text-2xl font-bold text-gray-900 mb-4">Profile</Text>

          {/* Avatar + name card */}
          <View className="flex-row items-center gap-4">
            <View style={{ position: 'relative' }}>
              <Image
                source={
                  profile?.avatar_url
                    ? { uri: profile.avatar_url }
                    : require('../../../../assets/placeholder-logo.png')
                }
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  borderWidth: 3,
                  borderColor: '#dbeafe',
                }}
                contentFit="cover"
              />
              <TouchableOpacity
                onPress={() => router.push('/(customer)/(profile)/edit')}
                className="absolute bottom-0 right-0 bg-primary-500 w-6 h-6 rounded-full items-center justify-center"
                style={{ borderWidth: 2, borderColor: '#fff' }}
              >
                <Ionicons name="pencil" size={10} color="#fff" />
              </TouchableOpacity>
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-gray-900">
                {profile?.full_name ?? 'Your Name'}
              </Text>
              <Text className="text-gray-400 text-sm" numberOfLines={1}>
                {profile?.phone ?? 'Add phone number'}
              </Text>
              <View className="flex-row items-center gap-1 mt-1">
                <View className="w-2 h-2 rounded-full bg-green-500" />
                <Text className="text-green-600 text-xs font-medium">Active account</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(customer)/(profile)/edit')}
              className="bg-primary-50 rounded-xl px-3 py-2"
            >
              <Text className="text-primary-600 text-sm font-semibold">Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Account group */}
        <View className="px-4">
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
            Account
          </Text>
          <MenuGroup>
            <MenuItem
              icon="person-outline"
              label="Edit Profile"
              sublabel="Name, phone, avatar"
              onPress={() => router.push('/(customer)/(profile)/edit')}
            />
            <Separator />
            <MenuItem
              icon="location-outline"
              label="Saved Addresses"
              sublabel="Manage delivery addresses"
              onPress={() => router.push('/(customer)/(profile)/addresses')}
            />
            <Separator />
            <MenuItem
              icon="notifications-outline"
              label="Notifications"
              sublabel="Push, email preferences"
              onPress={() => {}}
            />
          </MenuGroup>

          {/* Orders group */}
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1 mt-2">
            Shopping
          </Text>
          <MenuGroup>
            <MenuItem
              icon="receipt-outline"
              label="Order History"
              sublabel="View all past orders"
              onPress={() => router.push('/(customer)/(orders)')}
            />
            <Separator />
            <MenuItem
              icon="star-outline"
              label="My Reviews"
              sublabel="Reviews you've written"
              onPress={() => {}}
            />
            <Separator />
            <MenuItem
              icon="pricetag-outline"
              label="Promo Codes"
              sublabel="Enter or view your codes"
              onPress={() => {}}
            />
          </MenuGroup>

          {/* Support group */}
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1 mt-2">
            Support
          </Text>
          <MenuGroup>
            <MenuItem
              icon="help-circle-outline"
              label="Help Center"
              onPress={() => {}}
            />
            <Separator />
            <MenuItem
              icon="chatbubble-outline"
              label="Contact Us"
              onPress={() => {}}
            />
            <Separator />
            <MenuItem
              icon="shield-outline"
              label="Privacy Policy"
              onPress={() => {}}
            />
            <Separator />
            <MenuItem
              icon="document-text-outline"
              label="Terms of Service"
              onPress={() => {}}
            />
          </MenuGroup>

          {/* Sign out */}
          <MenuGroup>
            <MenuItem
              icon="log-out-outline"
              label="Sign Out"
              danger
              onPress={handleSignOut}
            />
          </MenuGroup>

          {/* App version */}
          <Text className="text-center text-gray-300 text-xs mt-2">
            Hyperlocal v1.0.0
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}
```


***

### File 9 — `app/(customer)/(profile)/edit.tsx`

```typescript
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import * as ImagePicker from 'expo-image-picker'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { uploadService } from '@/services/upload.service'
import { useAuthStore } from '@/stores/authStore'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import Toast from 'react-native-toast-message'

const schema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  phone:     z.string().min(10, 'Enter a valid Malaysian phone number').optional().or(z.literal('')),
})

type FormData = z.infer<typeof schema>

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets()
  const { user, profile, refreshProfile } = useAuthStore()
  const [isSaving, setIsSaving]   = useState(false)
  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url ?? null)

  const { control, handleSubmit, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: profile?.full_name ?? '',
      phone:     profile?.phone ?? '',
    },
  })

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow access to photos to change your avatar.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (!result.canceled && result.assets[^0]) {
      setAvatarUri(result.assets[^0].uri)
    }
  }

  const onSubmit = async (data: FormData) => {
    setIsSaving(true)
    try {
      let avatarUrl = profile?.avatar_url ?? null

      // Upload new avatar if changed
      if (avatarUri && avatarUri !== profile?.avatar_url) {
        avatarUrl = await uploadService.uploadImage(
          'avatars',
          user!.id,
          avatarUri,
          'avatar.jpg'
        )
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name:  data.full_name,
          phone:      data.phone || null,
          avatar_url: avatarUrl,
        })
        .eq('id', user!.id)

      if (error) throw error

      await refreshProfile()
      Toast.show({ type: 'success', text1: 'Profile updated!' })
      router.back()
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Update failed', text2: err.message })
    }
    setIsSaving(false)
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="bg-white px-5 pt-4 pb-3 flex-row items-center gap-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900 flex-1">Edit Profile</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar picker */}
        <View className="items-center mb-8">
          <View style={{ position: 'relative' }}>
            <Image
              source={
                avatarUri
                  ? { uri: avatarUri }
                  : require('../../../../assets/placeholder-logo.png')
              }
              style={{ width: 100, height: 100, borderRadius: 50 }}
              contentFit="cover"
            />
            <TouchableOpacity
              onPress={pickAvatar}
              className="absolute bottom-0 right-0 bg-primary-500 w-9 h-9 rounded-full items-center justify-center"
              style={{ borderWidth: 3, borderColor: '#f9fafb' }}
            >
              <Ionicons name="camera" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text className="text-gray-400 text-xs mt-2">Tap to change photo</Text>
        </View>

        {/* Form */}
        <View
          className="bg-white rounded-2xl p-4"
          style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
        >
          <Controller
            control={control}
            name="full_name"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Full Name"
                placeholder="Ahmad bin Ali"
                value={value}
                onChangeText={onChange}
                error={errors.full_name?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Phone Number"
                placeholder="0123456789"
                keyboardType="phone-pad"
                value={value}
                onChangeText={onChange}
                error={errors.phone?.message}
                hint="Used for delivery notifications"
              />
            )}
          />

          {/* Email (read-only) */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-1">Email</Text>
            <View className="border border-gray-100 rounded-xl px-4 py-3 bg-gray-50 flex-row items-center gap-2">
              <Text className="text-gray-400 flex-1">{user?.email}</Text>
              <View className="bg-green-100 rounded-full px-2 py-0.5">
                <Text className="text-green-700 text-[10px] font-bold">Verified</Text>
              </View>
            </View>
            <Text className="text-gray-400 text-xs mt-1">Email cannot be changed</Text>
          </View>
        </View>

        <Button
          onPress={handleSubmit(onSubmit)}
          loading={isSaving}
          className="mt-5"
        >
          Save Changes
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
```


***

### File 10 — `app/(customer)/(profile)/addresses.tsx`

```typescript
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import Toast from 'react-native-toast-message'
import type { Address } from '@/types/app.types'

// ─── Form schema ───────────────────────────────────────────────────────────────
const schema = z.object({
  label:          z.string().min(1, 'Required'),
  recipient_name: z.string().min(2, 'Enter recipient name'),
  phone:          z.string().min(10, 'Enter valid phone number'),
  address_line1:  z.string().min(5, 'Enter street address'),
  address_line2:  z.string().optional(),
  city:           z.string().min(2, 'Enter city'),
  state:          z.string().min(2, 'Enter state'),
  postcode:       z.string().length(5, '5-digit postcode required'),
})
type FormData = z.infer<typeof schema>

const LABEL_PRESETS = ['Home', 'Office', 'Parent\'s House', 'Other']
const STATES = ['Johor','Kedah','Kelantan','Melaka','Negeri Sembilan','Pahang','Perak','Perlis','Pulau Pinang','Sabah','Sarawak','Selangor','Terengganu','W.P. Kuala Lumpur','W.P. Labuan','W.P. Putrajaya']

// ─── Add/Edit bottom sheet modal ──────────────────────────────────────────────
function AddressFormModal({
  visible,
  editing,
  onClose,
  onSaved,
  userId,
}: {
  visible:  boolean
  editing:  Address | null
  onClose:  () => void
  onSaved:  () => void
  userId:   string
}) {
  const [isSaving, setIsSaving] = useState(false)

  const { control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      label:          editing?.label          ?? 'Home',
      recipient_name: editing?.recipient_name ?? '',
      phone:          editing?.phone          ?? '',
      address_line1:  editing?.address_line1  ?? '',
      address_line2:  editing?.address_line2  ?? '',
      city:           editing?.city           ?? '',
      state:          editing?.state          ?? 'Selangor',
      postcode:       editing?.postcode       ?? '',
    },
  })

  const selectedLabel = watch('label')

  const onSubmit = async (data: FormData) => {
    setIsSaving(true)
    try {
      if (editing) {
        await supabase.from('addresses').update({ ...data }).eq('id', editing.id)
        Toast.show({ type: 'success', text1: 'Address updated' })
      } else {
        await supabase.from('addresses').insert({ ...data, user_id: userId, country: 'MY' })
        Toast.show({ type: 'success', text1: 'Address added' })
      }
      onSaved()
      onClose()
      reset()
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message })
    }
    setIsSaving(false)
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        className="flex-1 bg-white"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Modal header */}
        <View className="flex-row items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <Text className="text-xl font-bold text-gray-900">
            {editing ? 'Edit Address' : 'New Address'}
          </Text>
          <TouchableOpacity onPress={onClose} className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center">
            <Ionicons name="close" size={18} color="#374151" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Label presets */}
          <Text className="text-sm font-semibold text-gray-700 mb-2">Label</Text>
          <View className="flex-row gap-2 mb-4">
            {LABEL_PRESETS.map((l) => (
              <TouchableOpacity
                key={l}
                onPress={() => setValue('label', l)}
                className={`px-3 py-2 rounded-xl border
                  ${selectedLabel === l ? 'bg-primary-500 border-primary-500' : 'border-gray-200'}`}
              >
                <Text className={`text-sm font-semibold ${selectedLabel === l ? 'text-white' : 'text-gray-600'}`}>
                  {l}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Controller control={control} name="recipient_name"
            render={({ field: { onChange, value } }) => (
              <Input label="Recipient Name" placeholder="Full name" value={value} onChangeText={onChange} error={errors.recipient_name?.message} />
            )}
          />
          <Controller control={control} name="phone"
            render={({ field: { onChange, value } }) => (
              <Input label="Phone Number" placeholder="0123456789" keyboardType="phone-pad" value={value} onChangeText={onChange} error={errors.phone?.message} />
            )}
          />
          <Controller control={control} name="address_line1"
            render={({ field: { onChange, value } }) => (
              <Input label="Address Line 1" placeholder="No. 1, Jalan Example" value={value} onChangeText={onChange} error={errors.address_line1?.message} />
            )}
          />
          <Controller control={control} name="address_line2"
            render={({ field: { onChange, value } }) => (
              <Input label="Address Line 2 (Optional)" placeholder="Unit, Floor, Block" value={value ?? ''} onChangeText={onChange} />
            )}
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Controller control={control} name="city"
                render={({ field: { onChange, value } }) => (
                  <Input label="City" placeholder="Petaling Jaya" value={value} onChangeText={onChange} error={errors.city?.message} />
                )}
              />
            </View>
            <View className="flex-1">
              <Controller control={control} name="postcode"
                render={({ field: { onChange, value } }) => (
                  <Input label="Postcode" placeholder="47500" keyboardType="numeric" maxLength={5} value={value} onChangeText={onChange} error={errors.postcode?.message} />
                )}
              />
            </View>
          </View>

          {/* State picker */}
          <Text className="text-sm font-semibold text-gray-700 mb-2">State</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            <View className="flex-row gap-2">
              {STATES.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setValue('state', s)}
                  className={`px-3 py-2 rounded-xl border whitespace-nowrap
                    ${watch('state') === s ? 'bg-primary-500 border-primary-500' : 'border-gray-200'}`}
                >
                  <Text className={`text-xs font-medium ${watch('state') === s ? 'text-white' : 'text-gray-600'}`}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          {errors.state && <Text className="text-red-500 text-xs mb-3">{errors.state.message}</Text>}

          <Button onPress={handleSubmit(onSubmit)} loading={isSaving}>
            {editing ? 'Update Address' : 'Save Address'}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── Address card ──────────────────────────────────────────────────────────────
function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  address:      Address
  onEdit:       () => void
  onDelete:     () => void
  onSetDefault: () => void
}) {
  return (
    <View
      className={`bg-white rounded-2xl p-4 mb-3
        ${address.is_default ? 'border-2 border-primary-400' : ''}`}
      style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-row items-center gap-2">
          <View className="bg-primary-50 rounded-lg px-2 py-1">
            <Text className="text-primary-700 text-xs font-bold">{address.label}</Text>
          </View>
          {address.is_default && (
            <View className="bg-primary-500 rounded-lg px-2 py-1">
              <Text className="text-white text-xs font-bold">Default</Text>
            </View>
          )}
        </View>
        <View className="flex-row gap-2">
          <TouchableOpacity onPress={onEdit}>
            <Ionicons name="pencil-outline" size={18} color="#6b7280" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete}>
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      <Text className="font-semibold text-gray-900 text-sm">{address.recipient_name}</Text>
      <Text className="text-gray-500 text-sm mt-0.5">{address.phone}</Text>
      <Text className="text-gray-500 text-sm mt-0.5" numberOfLines={2}>
        {address.address_line1}
        {address.address_line2 ? `, ${address.address_line2}` : ''},{' '}
        {address.city}, {address.state} {address.postcode}
      </Text>

      {!address.is_default && (
        <TouchableOpacity onPress={onSetDefault} className="mt-3 self-start">
          <Text className="text-primary-600 text-xs font-semibold">Set as default</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function AddressesScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [modalVisible, setModalVisible] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)

  const { data: addresses = [], isLoading, refetch } = useQuery<Address[]>({
    queryKey: ['addresses', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user!.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!user?.id,
  })

  const handleDelete = (id: string) => {
    Alert.alert('Delete address?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('addresses').delete().eq('id', id)
          refetch()
          Toast.show({ type: 'success', text1: 'Address deleted' })
        },
      },
    ])
  }

  const handleSetDefault = async (id: string) => {
    // Unset all defaults first, then set this one
    await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', user!.id)
    await supabase
      .from('addresses')
      .update({ is_default: true })
      .eq('id', id)
    refetch()
    Toast.show({ type: 'success', text1: 'Default address updated' })
  }

  const openAdd = () => {
    setEditingAddress(null)
    setModalVisible(true)
  }

  const openEdit = (addr: Address) => {
    setEditingAddress(addr)
    setModalVisible(true)
  }

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white px-5 pt-4 pb-3 flex-row items-center justify-between border-b border-gray-100">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900">Saved Addresses</Text>
        </View>
        <TouchableOpacity onPress={openAdd} className="bg-primary-500 rounded-xl px-3 py-2 flex-row items-center gap-1">
          <Ionicons name="add" size={16} color="#fff" />
          <Text className="text-white text-sm font-bold">Add</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="p-4 gap-3">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </View>
      ) : addresses.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-primary-50 items-center justify-center mb-4">
            <Ionicons name="location-outline" size={36} color="#2563eb" />
          </View>
          <Text className="text-lg font-bold text-gray-700 text-center">No addresses yet</Text>
          <Text className="text-gray-400 text-sm text-center mt-1">
            Add a delivery address to get started.
          </Text>
          <TouchableOpacity onPress={openAdd} className="mt-5 bg-primary-500 rounded-2xl px-6 py-3">
            <Text className="text-white font-semibold">Add Address</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <AddressCard
              address={item}
              onEdit={() => openEdit(item)}
              onDelete={() => handleDelete(item.id)}
              onSetDefault={() => handleSetDefault(item.id)}
            />
          )}
        />
      )}

      {/* Add/Edit modal */}
      <AddressFormModal
        visible={modalVisible}
        editing={editingAddress}
        userId={user!.id}
        onClose={() => setModalVisible(false)}
        onSaved={() => {
          refetch()
          qc.invalidateQueries({ queryKey: ['addresses'] })
        }}
      />
    </View>
  )
}
```


***

## Run \& Verify Checklist

```bash
npx expo start
```

| Screen | What to check |
| :-- | :-- |
| **Cart** | Swipe left on item to reveal red delete button; qty stepper works; empty state shows Browse button |
| **Checkout** | Addresses load and auto-select default; payment options all selectable; Place Order creates a row in Supabase `orders` table |
| **Orders list** | Filter tabs (All / Active / Delivered / Cancelled) all filter correctly; pull-to-refresh works |
| **Order detail** | Blue tracking timeline advances correctly per status; price breakdown is accurate; cancelled orders show a flat status card instead |
| **Profile** | Avatar, name and phone render from Supabase; Sign out shows confirmation alert |
| **Edit profile** | Camera icon opens photo picker; changes save to Supabase and reflect immediately |
| **Addresses** | Add/Edit modal slides up as a sheet; state picker scrolls horizontally; Set as Default updates correctly; Delete asks for confirmation |

<span style="display:none">[^1][^10][^11][^12][^13][^14][^15][^2][^3][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://www.geeksforgeeks.org/reactjs/create-timeline-app-using-react-native/

[^2]: https://www.syncfusion.com/blogs/post/react-timeline-component

[^3]: https://shadcn.io/template/timdehof-shadcn-timeline

[^4]: https://dev.to/running_squirrel/how-to-add-a-vertical-timeline-to-your-react-native-app-5afn

[^5]: https://marmelab.com/blog/2019/01/17/react-timeline.html

[^6]: https://docs.expo.dev/router/advanced/modals/

[^7]: https://www.youtube.com/watch?v=o3LqpgOMiM0

[^8]: https://www.reddit.com/r/reactnative/comments/1ebyyd3/gorhom_bottom_sheet_and_routes_with_expo_router/

[^9]: https://www.npmjs.com/package/react-native-timeline-flatlist

[^10]: https://www.youtube.com/watch?v=gNzuJVRmyDk

[^11]: https://github.com/tanu2534/react-native-timeline-view

[^12]: https://github.com/expo/router/discussions/512

[^13]: https://stackoverflow.com/questions/58778299

[^14]: https://www.linkedin.com/pulse/bottom-sheet-navigation-exporeact-native-adam-beleko-sdife

[^15]: https://mui.com/material-ui/react-timeline/

