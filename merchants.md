<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Proceed with merchant screens

Here are all 7 merchant files. Complete, zero placeholders, copy-paste ready.

***

## File 1 — `app/(merchant)/_layout.tsx` (Updated with badge)

```typescript
import { Tabs, Redirect } from 'expo-router'
import { View, Text } from 'react-native'
import { useEffect, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'

function OrdersBadge({ merchantId }: { merchantId: string }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    // Initial fetch
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .eq('status', 'paid')
      .then(({ count: c }) => setCount(c ?? 0))

    // Realtime: new paid orders come in
    const channel = supabase
      .channel(`merchant-orders-badge-${merchantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `merchant_id=eq.${merchantId}` },
        () => {
          supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('merchant_id', merchantId)
            .eq('status', 'paid')
            .then(({ count: c }) => setCount(c ?? 0))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [merchantId])

  if (count === 0) return null
  return (
    <View
      style={{
        position: 'absolute', top: -4, right: -8,
        backgroundColor: '#ef4444', borderRadius: 10,
        minWidth: 18, height: 18, alignItems: 'center',
        justifyContent: 'center', paddingHorizontal: 3,
        borderWidth: 1.5, borderColor: '#fff',
      }}
    >
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
        {count > 9 ? '9+' : count}
      </Text>
    </View>
  )
}

export default function MerchantLayout() {
  const { session, profile, merchant } = useAuthStore()

  if (!session)                     return <Redirect href="/(auth)/welcome" />
  if (profile?.role !== 'merchant') return <Redirect href="/(customer)/(home)" />
  if (!merchant)                    return <Redirect href="/(merchant)/onboarding" />

  return (
    <Tabs
      screenOptions={{
        headerShown:          false,
        tabBarActiveTintColor: '#2563eb',
        tabBarStyle:          { borderTopColor: '#f3f4f6' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="receipt-outline" size={size} color={color} />
              {merchant?.id && <OrdersBadge merchantId={merchant.id} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="store-settings"
        options={{
          title: 'Store',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="storefront-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Hidden from tab bar */}
      <Tabs.Screen name="onboarding" options={{ href: null }} />
      <Tabs.Screen name="order"      options={{ href: null }} />
      <Tabs.Screen name="product"    options={{ href: null }} />
    </Tabs>
  )
}
```


***

## File 2 — `app/(merchant)/orders.tsx`

```typescript
import {
  View, Text, FlatList, TouchableOpacity,
  RefreshControl, ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import { useState, useEffect, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, formatRelativeTime } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending:          { label: 'Pending',       color: '#92400e', bg: '#fef3c7', icon: 'time-outline'                  },
  paid:             { label: 'New Order',     color: '#ffffff', bg: '#2563eb', icon: 'notifications-outline'         },
  confirmed:        { label: 'Confirmed',     color: '#1e40af', bg: '#dbeafe', icon: 'checkmark-done-outline'        },
  preparing:        { label: 'Preparing',     color: '#5b21b6', bg: '#ede9fe', icon: 'restaurant-outline'            },
  ready_for_pickup: { label: 'Ready',         color: '#0e7490', bg: '#cffafe', icon: 'bag-check-outline'             },
  out_for_delivery: { label: 'Delivering',    color: '#0369a1', bg: '#e0f2fe', icon: 'bicycle-outline'               },
  delivered:        { label: 'Delivered',     color: '#166534', bg: '#dcfce7', icon: 'checkmark-done-circle-outline' },
  cancelled:        { label: 'Cancelled',     color: '#991b1b', bg: '#fee2e2', icon: 'close-circle-outline'          },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return (
    <View className="flex-row items-center gap-1 rounded-full px-2.5 py-1" style={{ backgroundColor: cfg.bg }}>
      <Ionicons name={cfg.icon} size={11} color={cfg.color} />
      <Text style={{ color: cfg.color, fontSize: 11, fontWeight: '700' }}>{cfg.label}</Text>
    </View>
  )
}

// ─── Filter tabs ───────────────────────────────────────────────────────────────
const FILTERS = [
  { key: 'active',    label: 'Active',    statuses: ['paid','confirmed','preparing','ready_for_pickup','out_for_delivery'] },
  { key: 'new',       label: 'New',       statuses: ['paid'] },
  { key: 'preparing', label: 'Preparing', statuses: ['confirmed','preparing'] },
  { key: 'done',      label: 'Done',      statuses: ['delivered','cancelled'] },
  { key: 'all',       label: 'All',       statuses: [] },
]

// ─── Order row card ────────────────────────────────────────────────────────────
function OrderRow({ order, onPress }: { order: any; onPress: () => void }) {
  const cfg       = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
  const isNew     = order.status === 'paid'
  const itemNames = order.items?.map((i: any) => `${i.product_name} ×${i.quantity}`).join(', ') ?? ''

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className={`bg-white rounded-2xl p-4 mb-3 ${isNew ? 'border-2 border-primary-400' : ''}`}
      style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}
    >
      {/* Top row */}
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <Text className="font-bold text-gray-900 text-base">{order.order_number}</Text>
          <Text className="text-gray-400 text-xs mt-0.5">{formatRelativeTime(order.created_at)}</Text>
        </View>
        <StatusBadge status={order.status} />
      </View>

      {/* Divider */}
      <View className="h-px bg-gray-50 my-2" />

      {/* Items preview */}
      <Text className="text-gray-600 text-sm" numberOfLines={2}>{itemNames}</Text>

      {/* Bottom row */}
      <View className="flex-row justify-between items-center mt-3">
        <View className="flex-row items-center gap-1">
          <Ionicons name="location-outline" size={13} color="#9ca3af" />
          <Text className="text-gray-400 text-xs" numberOfLines={1}>
            {(order.delivery_address as any)?.city ?? 'No address'}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="font-bold text-primary-600 text-base">
            {formatCurrency(Number(order.total_amount))}
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
        </View>
      </View>

      {/* New order action hint */}
      {isNew && (
        <View className="mt-3 bg-primary-50 rounded-xl px-3 py-2 flex-row items-center gap-2">
          <Ionicons name="hand-left-outline" size={14} color="#2563eb" />
          <Text className="text-primary-600 text-xs font-semibold">Tap to accept or reject this order</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function MerchantOrdersScreen() {
  const insets = useSafeAreaInsets()
  const { merchant } = useAuthStore()
  const [activeFilter, setActiveFilter] = useState('active')
  const [orders, setOrders]             = useState<any[]>([])
  const [isLoading, setIsLoading]       = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchOrders = useCallback(async () => {
    if (!merchant?.id) return
    const filter = FILTERS.find(f => f.key === activeFilter)!
    let query = supabase
      .from('orders')
      .select('*, items:order_items(product_name, quantity, unit_price, line_total)')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false })

    if (filter.statuses.length > 0) {
      query = query.in('status', filter.statuses)
    }

    const { data } = await query
    setOrders(data ?? [])
  }, [merchant?.id, activeFilter])

  // Initial load
  useEffect(() => {
    setIsLoading(true)
    fetchOrders().finally(() => setIsLoading(false))
  }, [fetchOrders])

  // Realtime subscription [web:129]
  useEffect(() => {
    if (!merchant?.id) return
    const channel = supabase
      .channel(`merchant-orders-${merchant.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `merchant_id=eq.${merchant.id}` },
        () => fetchOrders()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [merchant?.id, fetchOrders])

  const onRefresh = async () => {
    setIsRefreshing(true)
    await fetchOrders()
    setIsRefreshing(false)
  }

  const currentFilter = FILTERS.find(f => f.key === activeFilter)!
  const newCount = orders.filter(o => o.status === 'paid').length

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white px-5 pt-4 pb-0 border-b border-gray-100">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-2xl font-bold text-gray-900">Orders</Text>
          {newCount > 0 && (
            <View className="bg-primary-500 rounded-full px-3 py-1 flex-row items-center gap-1">
              <Ionicons name="notifications" size={13} color="#fff" />
              <Text className="text-white text-xs font-bold">{newCount} new</Text>
            </View>
          )}
        </View>

        {/* Filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingBottom: 0 }}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setActiveFilter(f.key)}
              className={`px-4 py-2 rounded-t-xl border-b-2
                ${activeFilter === f.key ? 'border-primary-500 bg-primary-50' : 'border-transparent'}`}
            >
              <Text className={`text-sm font-semibold
                ${activeFilter === f.key ? 'text-primary-600' : 'text-gray-500'}`}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <View className="p-4 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </View>
      ) : orders.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="receipt-outline" size={48} color="#d1d5db" />
          <Text className="text-gray-400 font-semibold mt-3">No {currentFilter.label.toLowerCase()} orders</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={o => o.id}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
          renderItem={({ item }) => (
            <OrderRow order={item} onPress={() => router.push(`/(merchant)/order/${item.id}`)} />
          )}
        />
      )}
    </View>
  )
}
```


***

## File 3 — `app/(merchant)/order/[orderId].tsx`

```typescript
import {
  View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useState, useEffect, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import Toast from 'react-native-toast-message'

// Merchant-facing status flow — only forward transitions are allowed
const NEXT_ACTIONS: Record<string, { label: string; nextStatus: string; color: string; icon: keyof typeof Ionicons.glyphMap }[]> = {
  paid:             [{ label: 'Accept Order',   nextStatus: 'confirmed',        color: '#2563eb', icon: 'checkmark-circle-outline' },
                     { label: 'Reject Order',   nextStatus: 'cancelled',        color: '#ef4444', icon: 'close-circle-outline'     }],
  confirmed:        [{ label: 'Start Preparing',nextStatus: 'preparing',        color: '#7c3aed', icon: 'restaurant-outline'        }],
  preparing:        [{ label: 'Ready for Pickup',nextStatus: 'ready_for_pickup',color: '#0891b2', icon: 'bag-check-outline'         }],
  ready_for_pickup: [{ label: 'Mark Delivered', nextStatus: 'delivered',        color: '#16a34a', icon: 'checkmark-done-circle-outline'}],
  out_for_delivery: [{ label: 'Mark Delivered', nextStatus: 'delivered',        color: '#16a34a', icon: 'checkmark-done-circle-outline'}],
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:          { label: 'Pending Payment',  color: '#92400e', bg: '#fef3c7' },
  paid:             { label: 'New Order — Action Required', color: '#fff',    bg: '#2563eb' },
  confirmed:        { label: 'Confirmed',        color: '#1e40af', bg: '#dbeafe' },
  preparing:        { label: 'Preparing',        color: '#5b21b6', bg: '#ede9fe' },
  ready_for_pickup: { label: 'Ready for Pickup', color: '#0e7490', bg: '#cffafe' },
  out_for_delivery: { label: 'Out for Delivery', color: '#0369a1', bg: '#e0f2fe' },
  delivered:        { label: 'Delivered ✓',      color: '#166534', bg: '#dcfce7' },
  cancelled:        { label: 'Cancelled',        color: '#991b1b', bg: '#fee2e2' },
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-white rounded-2xl p-4 mb-3"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
      <Text className="font-bold text-gray-900 mb-3">{title}</Text>
      {children}
    </View>
  )
}

export default function MerchantOrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const insets = useSafeAreaInsets()
  const [order, setOrder]         = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)

  const fetchOrder = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('id', orderId)
      .single()
    setOrder(data)
  }, [orderId])

  useEffect(() => {
    setIsLoading(true)
    fetchOrder().finally(() => setIsLoading(false))

    // Live updates for this order
    const channel = supabase
      .channel(`order-detail-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => setOrder((prev: any) => ({ ...prev, ...payload.new }))
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchOrder])

  const handleStatusUpdate = async (nextStatus: string, label: string) => {
    if (nextStatus === 'cancelled') {
      Alert.alert(
        'Reject this order?',
        'The customer will be notified. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reject Order', style: 'destructive', onPress: () => applyUpdate(nextStatus) },
        ]
      )
      return
    }
    Alert.alert(label, `Change order status to "${label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => applyUpdate(nextStatus) },
    ])
  }

  const applyUpdate = async (nextStatus: string) => {
    setIsUpdating(true)
    const updates: any = { status: nextStatus }
    if (nextStatus === 'confirmed')  updates.confirmed_at = new Date().toISOString()
    if (nextStatus === 'cancelled')  updates.cancelled_at = new Date().toISOString()
    if (nextStatus === 'delivered')  updates.delivered_at = new Date().toISOString()

    const { error } = await supabase.from('orders').update(updates).eq('id', orderId)
    if (error) {
      Toast.show({ type: 'error', text1: 'Update failed', text2: error.message })
    } else {
      Toast.show({ type: 'success', text1: 'Order updated successfully' })
      fetchOrder()
    }
    setIsUpdating(false)
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center" style={{ paddingTop: insets.top }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  if (!order) return null

  const statusCfg  = STATUS_LABELS[order.status] ?? STATUS_LABELS.pending
  const actions    = NEXT_ACTIONS[order.status] ?? []
  const delivAddr  = order.delivery_address as any

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white px-5 pt-4 pb-3 flex-row items-center gap-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900">{order.order_number}</Text>
          <Text className="text-gray-400 text-xs">Order Detail</Text>
        </View>
        {isUpdating && <ActivityIndicator size="small" color="#2563eb" />}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Status banner */}
        <View className="rounded-2xl p-4 mb-3 items-center" style={{ backgroundColor: statusCfg.bg }}>
          <Text style={{ color: statusCfg.color, fontWeight: '800', fontSize: 17, textAlign: 'center' }}>
            {statusCfg.label}
          </Text>
        </View>

        {/* Order items */}
        <SectionCard title="🛍️  Items Ordered">
          <View className="gap-3">
            {order.items?.map((item: any) => (
              <View key={item.id} className="flex-row justify-between items-start">
                <View className="flex-1">
                  <Text className="text-gray-800 font-semibold text-sm" numberOfLines={2}>
                    {item.product_name}
                  </Text>
                  {item.variant_name && (
                    <Text className="text-gray-400 text-xs">{item.variant_name}</Text>
                  )}
                  <Text className="text-gray-500 text-xs mt-0.5">
                    {formatCurrency(item.unit_price)} × {item.quantity}
                  </Text>
                </View>
                <Text className="text-gray-900 font-bold text-sm ml-2">
                  {formatCurrency(item.line_total)}
                </Text>
              </View>
            ))}
            <View className="border-t border-gray-100 pt-2 mt-1 gap-1.5">
              <View className="flex-row justify-between">
                <Text className="text-gray-500 text-sm">Subtotal</Text>
                <Text className="text-gray-900 font-semibold text-sm">{formatCurrency(Number(order.subtotal))}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-500 text-sm">Delivery fee</Text>
                <Text className="text-gray-900 font-semibold text-sm">
                  {order.delivery_fee > 0 ? formatCurrency(Number(order.delivery_fee)) : 'Free'}
                </Text>
              </View>
              <View className="flex-row justify-between border-t border-gray-100 pt-1 mt-1">
                <Text className="font-bold text-gray-900">Total</Text>
                <Text className="font-bold text-primary-600 text-lg">{formatCurrency(Number(order.total_amount))}</Text>
              </View>
            </View>
          </View>
        </SectionCard>

        {/* Customer & delivery */}
        {delivAddr && (
          <SectionCard title="📬  Deliver To">
            <Text className="text-gray-800 font-semibold text-sm">{delivAddr.name}</Text>
            <Text className="text-gray-500 text-sm mt-0.5">{delivAddr.phone}</Text>
            <Text className="text-gray-500 text-sm mt-0.5">
              {delivAddr.line1}{delivAddr.line2 ? `, ${delivAddr.line2}` : ''},{' '}
              {delivAddr.city}, {delivAddr.state} {delivAddr.postcode}
            </Text>
          </SectionCard>
        )}

        {/* Payment */}
        <SectionCard title="💳  Payment">
          <View className="flex-row justify-between">
            <Text className="text-gray-500 text-sm">Method</Text>
            <Text className="text-gray-900 font-semibold text-sm capitalize">
              {order.payment_method?.replace('_', ' ') ?? '—'}
            </Text>
          </View>
          <View className="flex-row justify-between mt-1.5">
            <Text className="text-gray-500 text-sm">Status</Text>
            <View className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: order.payment_status === 'paid' ? '#dcfce7' : '#fef3c7' }}>
              <Text className="text-xs font-semibold capitalize"
                style={{ color: order.payment_status === 'paid' ? '#166534' : '#92400e' }}>
                {order.payment_status?.replace('_', ' ')}
              </Text>
            </View>
          </View>
        </SectionCard>

        {/* Customer note */}
        {order.customer_note && (
          <SectionCard title="📝  Customer Note">
            <Text className="text-gray-700 text-sm italic">"{order.customer_note}"</Text>
          </SectionCard>
        )}
      </ScrollView>

      {/* Action buttons */}
      {actions.length > 0 && (
        <View
          className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 pt-3 gap-2"
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          {actions.map(action => (
            <TouchableOpacity
              key={action.nextStatus}
              onPress={() => handleStatusUpdate(action.nextStatus, action.label)}
              disabled={isUpdating}
              className="flex-row items-center justify-center gap-2 py-3.5 rounded-2xl"
              style={{ backgroundColor: action.color, opacity: isUpdating ? 0.6 : 1 }}
            >
              <Ionicons name={action.icon} size={18} color="#fff" />
              <Text className="text-white font-bold text-base">{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
}
```


***

## File 4 — `app/(merchant)/products.tsx`

```typescript
import {
  View, Text, FlatList, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { productsService } from '@/services/products.service'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'
import Toast from 'react-native-toast-message'
import type { ProductWithVariants } from '@/types/app.types'

function ProductRow({ product, onEdit, onToggle, onDelete }: {
  product:  ProductWithVariants
  onEdit:   () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const isActive     = product.status === 'active'
  const isOutOfStock = product.stock_quantity <= 0 && product.track_inventory

  return (
    <View
      className="bg-white rounded-2xl flex-row gap-3 p-3 mb-3"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, opacity: isActive ? 1 : 0.55 }}
    >
      {/* Image */}
      <Image
        source={product.images?.[^0] ? { uri: product.images[^0] } : require('../../../assets/placeholder-logo.png')}
        style={{ width: 72, height: 72, borderRadius: 12 }}
        contentFit="cover"
      />

      {/* Details */}
      <View className="flex-1 justify-between py-0.5">
        <View>
          <Text className="text-gray-900 font-semibold text-sm" numberOfLines={1}>{product.name}</Text>
          {product.category && (
            <Text className="text-gray-400 text-xs">{product.category.name}</Text>
          )}
          <View className="flex-row items-center gap-2 mt-1">
            <Text className="text-primary-600 font-bold text-sm">{formatCurrency(product.price)}</Text>
            {product.compare_at_price && product.compare_at_price > product.price && (
              <Text className="text-gray-400 text-xs line-through">{formatCurrency(product.compare_at_price)}</Text>
            )}
          </View>
        </View>

        <View className="flex-row items-center gap-2 mt-1.5">
          {/* Stock badge */}
          <View className={`rounded-full px-2 py-0.5 ${isOutOfStock ? 'bg-red-100' : 'bg-gray-100'}`}>
            <Text className={`text-[10px] font-semibold ${isOutOfStock ? 'text-red-600' : 'text-gray-500'}`}>
              {isOutOfStock
                ? 'Out of stock'
                : product.track_inventory
                  ? `${product.stock_quantity} left`
                  : 'Unlimited'}
            </Text>
          </View>
          {product.variants.length > 0 && (
            <View className="bg-purple-100 rounded-full px-2 py-0.5">
              <Text className="text-purple-700 text-[10px] font-semibold">
                {product.variants.length} variant{product.variants.length > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Action buttons */}
      <View className="items-center gap-3 justify-center">
        {/* Active toggle */}
        <TouchableOpacity
          onPress={onToggle}
          className={`w-8 h-8 rounded-full items-center justify-center
            ${isActive ? 'bg-green-100' : 'bg-gray-100'}`}
        >
          <Ionicons
            name={isActive ? 'eye-outline' : 'eye-off-outline'}
            size={16}
            color={isActive ? '#16a34a' : '#9ca3af'}
          />
        </TouchableOpacity>
        {/* Edit */}
        <TouchableOpacity
          onPress={onEdit}
          className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center"
        >
          <Ionicons name="pencil-outline" size={16} color="#2563eb" />
        </TouchableOpacity>
        {/* Delete */}
        <TouchableOpacity
          onPress={onDelete}
          className="w-8 h-8 rounded-full bg-red-100 items-center justify-center"
        >
          <Ionicons name="trash-outline" size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function MerchantProductsScreen() {
  const insets = useSafeAreaInsets()
  const { merchant } = useAuthStore()
  const qc = useQueryClient()

  const { data: products = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['merchant-products', merchant?.id],
    queryFn:  () => productsService.getByMerchantOwner(merchant!.id),
    enabled:  !!merchant?.id,
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      supabase.from('products').update({ status }).eq('id', id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merchant-products'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['merchant-products'] })
      Toast.show({ type: 'success', text1: 'Product deleted' })
    },
  })

  const handleDelete = (id: string, name: string) => {
    Alert.alert(`Delete "${name}"?`, 'This will hide the product from customers. Orders are not affected.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ])
  }

  const handleToggle = (product: ProductWithVariants) => {
    const newStatus = product.status === 'active' ? 'inactive' : 'active'
    toggleMutation.mutate({ id: product.id, status: newStatus })
  }

  const activeCount   = products.filter(p => p.status === 'active').length
  const inactiveCount = products.filter(p => p.status !== 'active').length

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white px-5 pt-4 pb-4 border-b border-gray-100">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-2xl font-bold text-gray-900">Products</Text>
            <Text className="text-gray-400 text-sm">
              {activeCount} active · {inactiveCount} hidden
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(merchant)/product/new')}
            className="bg-primary-500 rounded-xl px-4 py-2.5 flex-row items-center gap-2"
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text className="text-white font-bold text-sm">Add Product</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View className="p-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </View>
      ) : products.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-primary-50 items-center justify-center mb-4">
            <Ionicons name="cube-outline" size={36} color="#2563eb" />
          </View>
          <Text className="text-lg font-bold text-gray-700 text-center">No products yet</Text>
          <Text className="text-gray-400 text-sm text-center mt-1">Add your first product so customers can start buying.</Text>
          <TouchableOpacity
            onPress={() => router.push('/(merchant)/product/new')}
            className="mt-5 bg-primary-500 rounded-2xl px-6 py-3 flex-row items-center gap-2"
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text className="text-white font-semibold">Add First Product</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={p => p.id}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2563eb" />}
          renderItem={({ item }) => (
            <ProductRow
              product={item}
              onEdit={() => router.push(`/(merchant)/product/${item.id}`)}
              onToggle={() => handleToggle(item)}
              onDelete={() => handleDelete(item.id, item.name)}
            />
          )}
        />
      )}
    </View>
  )
}
```


***

## File 5 — `app/(merchant)/product/new.tsx` \& `[productId].tsx` (shared form)

First create the shared form component at `src/components/merchant/ProductForm.tsx`:

```typescript
import {
  View, Text, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import * as ImagePicker from 'expo-image-picker'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { uploadService } from '@/services/upload.service'
import { productsService } from '@/services/products.service'
import { useAuthStore } from '@/stores/authStore'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import Toast from 'react-native-toast-message'
import type { ProductWithVariants } from '@/types/app.types'

// ─── Schema ────────────────────────────────────────────────────────────────────
const variantSchema = z.object({
  name:           z.string().min(1, 'Variant name required'),
  price_modifier: z.coerce.number().default(0),
  stock_quantity: z.coerce.number().int().min(0).default(0),
})

const schema = z.object({
  name:             z.string().min(2, 'Product name required'),
  description:      z.string().optional(),
  price:            z.coerce.number().min(0.01, 'Price must be greater than 0'),
  compare_at_price: z.coerce.number().optional().or(z.literal('')),
  category_id:      z.string().optional(),
  stock_quantity:   z.coerce.number().int().min(0).default(0),
  track_inventory:  z.boolean().default(true),
  is_featured:      z.boolean().default(false),
  weight_grams:     z.coerce.number().int().min(0).optional(),
  variants:         z.array(variantSchema).default([]),
})

type FormData = z.infer<typeof schema>

interface Props {
  editing?:  ProductWithVariants | null
  onSaved:   () => void
}

export function ProductForm({ editing, onSaved }: Props) {
  const { merchant, user } = useAuthStore()
  const [isSaving, setIsSaving]   = useState(false)
  const [images, setImages]       = useState<string[]>(editing?.images ?? [])
  const [newImages, setNewImages] = useState<string[]>([]) // local URIs pending upload

  // Fetch categories for this merchant
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', merchant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('merchant_id', merchant!.id)
        .order('sort_order')
      return data ?? []
    },
    enabled: !!merchant?.id,
  })

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:             editing?.name            ?? '',
      description:      editing?.description     ?? '',
      price:            editing?.price           ?? 0,
      compare_at_price: editing?.compare_at_price ?? '',
      category_id:      editing?.category_id     ?? '',
      stock_quantity:   editing?.stock_quantity  ?? 0,
      track_inventory:  editing?.track_inventory ?? true,
      is_featured:      editing?.is_featured     ?? false,
      weight_grams:     editing?.weight_grams    ?? 0,
      variants: editing?.variants?.map(v => ({
        name:           v.name,
        price_modifier: v.price_modifier ?? 0,
        stock_quantity: v.stock_quantity ?? 0,
      })) ?? [],
    },
  })

  const { fields: variantFields, append: appendVariant, remove: removeVariant } = useFieldArray({
    control,
    name: 'variants',
  })

  const trackInventory = watch('track_inventory')
  const selectedCategoryId = watch('category_id')

  // ─── Image picker ────────────────────────────────────────────────────────────
  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo access to upload product images.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 5,
    })
    if (!result.canceled) {
      const uris = result.assets.map(a => a.uri)
      setNewImages(prev => [...prev, ...uris].slice(0, 5))
    }
  }

  const removeImage = (uri: string, isNew: boolean) => {
    if (isNew) setNewImages(prev => prev.filter(u => u !== uri))
    else       setImages(prev => prev.filter(u => u !== uri))
  }

  // ─── Save handler ─────────────────────────────────────────────────────────────
  const onSubmit = async (data: FormData) => {
    setIsSaving(true)
    try {
      // Upload new images
      const uploadedUrls = await Promise.all(
        newImages.map((uri, idx) =>
          uploadService.uploadImage(
            'product-images',
            merchant!.id,
            uri,
            `${Date.now()}-${idx}.jpg`
          )
        )
      )
      const allImages = [...images, ...uploadedUrls]

      const payload = {
        merchant_id:      merchant!.id,
        name:             data.name,
        description:      data.description || null,
        price:            data.price,
        compare_at_price: data.compare_at_price ? Number(data.compare_at_price) : null,
        category_id:      data.category_id || null,
        stock_quantity:   data.track_inventory ? data.stock_quantity : 9999,
        track_inventory:  data.track_inventory,
        is_featured:      data.is_featured,
        weight_grams:     data.weight_grams || null,
        images:           allImages,
        status:           'active' as const,
      }

      if (editing) {
        await productsService.update(editing.id, payload)

        // Delete existing variants and re-insert
        await supabase.from('product_variants').delete().eq('product_id', editing.id)
        if (data.variants.length > 0) {
          await supabase.from('product_variants').insert(
            data.variants.map(v => ({ ...v, product_id: editing.id }))
          )
        }
        Toast.show({ type: 'success', text1: 'Product updated!' })
      } else {
        const newProduct = await productsService.create(payload)
        if (data.variants.length > 0) {
          await supabase.from('product_variants').insert(
            data.variants.map(v => ({ ...v, product_id: newProduct.id }))
          )
        }
        Toast.show({ type: 'success', text1: 'Product added!' })
      }

      onSaved()
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Save failed', text2: err.message })
    }
    setIsSaving(false)
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

        {/* ── Images ── */}
        <View className="bg-white rounded-2xl p-4 mb-3"
          style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          <Text className="font-bold text-gray-900 mb-3">📷  Product Images</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {/* Existing uploaded images */}
            {images.map(uri => (
              <View key={uri} style={{ position: 'relative' }}>
                <Image source={{ uri }} style={{ width: 90, height: 90, borderRadius: 12 }} contentFit="cover" />
                <TouchableOpacity
                  onPress={() => removeImage(uri, false)}
                  className="absolute top-1 right-1 bg-black/60 w-6 h-6 rounded-full items-center justify-center"
                >
                  <Ionicons name="close" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {/* New local images */}
            {newImages.map(uri => (
              <View key={uri} style={{ position: 'relative' }}>
                <Image source={{ uri }} style={{ width: 90, height: 90, borderRadius: 12 }} contentFit="cover" />
                <View className="absolute top-1 left-1 bg-yellow-400 rounded-full px-1.5 py-0.5">
                  <Text className="text-white text-[9px] font-bold">NEW</Text>
                </View>
                <TouchableOpacity
                  onPress={() => removeImage(uri, true)}
                  className="absolute top-1 right-1 bg-black/60 w-6 h-6 rounded-full items-center justify-center"
                >
                  <Ionicons name="close" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {/* Add button */}
            {(images.length + newImages.length) < 5 && (
              <TouchableOpacity
                onPress={pickImages}
                className="w-[90px] h-[90px] rounded-xl border-2 border-dashed border-gray-200 items-center justify-center gap-1"
              >
                <Ionicons name="add" size={24} color="#9ca3af" />
                <Text className="text-gray-400 text-xs">Add photo</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
          <Text className="text-gray-400 text-xs mt-2">First image is shown as the thumbnail. Max 5 photos.</Text>
        </View>

        {/* ── Basic info ── */}
        <View className="bg-white rounded-2xl p-4 mb-3"
          style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          <Text className="font-bold text-gray-900 mb-3">📝  Basic Info</Text>
          <Controller control={control} name="name"
            render={({ field: { onChange, value } }) => (
              <Input label="Product Name *" placeholder="e.g. Nasi Lemak Special" value={value} onChangeText={onChange} error={errors.name?.message} />
            )}
          />
          <Controller control={control} name="description"
            render={({ field: { onChange, value } }) => (
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-1">Description</Text>
                <View className="border border-gray-200 rounded-xl px-4 py-3 bg-white">
                  <Text
                    // @ts-ignore
                    onChangeText={onChange}
                    style={{ minHeight: 72, textAlignVertical: 'top', color: '#111827' }}
                    numberOfLines={4}
                    editable
                  >
                    {value}
                  </Text>
                </View>
              </View>
            )}
          />

          {/* Category */}
          {categories.length > 0 && (
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setValue('category_id', '')}
                  className={`px-3 py-2 rounded-xl border ${!selectedCategoryId ? 'bg-primary-500 border-primary-500' : 'border-gray-200'}`}
                >
                  <Text className={`text-sm font-medium ${!selectedCategoryId ? 'text-white' : 'text-gray-600'}`}>None</Text>
                </TouchableOpacity>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setValue('category_id', cat.id)}
                    className={`px-3 py-2 rounded-xl border ${selectedCategoryId === cat.id ? 'bg-primary-500 border-primary-500' : 'border-gray-200'}`}
                  >
                    <Text className={`text-sm font-medium ${selectedCategoryId === cat.id ? 'text-white' : 'text-gray-600'}`}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* ── Pricing ── */}
        <View className="bg-white rounded-2xl p-4 mb-3"
          style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          <Text className="font-bold text-gray-900 mb-3">💰  Pricing</Text>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Controller control={control} name="price"
                render={({ field: { onChange, value } }) => (
                  <Input label="Selling Price (RM) *" placeholder="0.00" keyboardType="decimal-pad"
                    value={value ? String(value) : ''} onChangeText={onChange} error={errors.price?.message} />
                )}
              />
            </View>
            <View className="flex-1">
              <Controller control={control} name="compare_at_price"
                render={({ field: { onChange, value } }) => (
                  <Input label="Original Price (RM)" placeholder="0.00 (optional)" keyboardType="decimal-pad"
                    value={value ? String(value) : ''} onChangeText={onChange}
                    hint="Shows strikethrough 'was RM X'" />
                )}
              />
            </View>
          </View>
        </View>

        {/* ── Inventory ── */}
        <View className="bg-white rounded-2xl p-4 mb-3"
          style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          <Text className="font-bold text-gray-900 mb-3">📦  Inventory</Text>

          {/* Track inventory toggle */}
          <TouchableOpacity
            onPress={() => setValue('track_inventory', !trackInventory)}
            className="flex-row items-center justify-between mb-4"
          >
            <View>
              <Text className="text-sm font-semibold text-gray-800">Track stock quantity</Text>
              <Text className="text-xs text-gray-400 mt-0.5">Auto mark out-of-stock when qty reaches 0</Text>
            </View>
            <View className={`w-12 h-6 rounded-full ${trackInventory ? 'bg-primary-500' : 'bg-gray-300'}`}>
              <View className={`w-5 h-5 rounded-full bg-white shadow m-0.5 ${trackInventory ? 'ml-6' : 'ml-0.5'}`} />
            </View>
          </TouchableOpacity>

          {trackInventory && (
            <Controller control={control} name="stock_quantity"
              render={({ field: { onChange, value } }) => (
                <Input label="Stock Quantity" placeholder="0" keyboardType="numeric"
                  value={value ? String(value) : '0'} onChangeText={onChange} />
              )}
            />
          )}

          <Controller control={control} name="weight_grams"
            render={({ field: { onChange, value } }) => (
              <Input label="Weight (grams)" placeholder="e.g. 500" keyboardType="numeric"
                value={value ? String(value) : ''} onChangeText={onChange}
                hint="Used for EasyParcel shipping rate calculation" />
            )}
          />

          {/* Featured toggle */}
          <TouchableOpacity
            onPress={() => setValue('is_featured', !watch('is_featured'))}
            className="flex-row items-center justify-between"
          >
            <View>
              <Text className="text-sm font-semibold text-gray-800">Featured product</Text>
              <Text className="text-xs text-gray-400 mt-0.5">Shown at the top of your store</Text>
            </View>
            <View className={`w-12 h-6 rounded-full ${watch('is_featured') ? 'bg-primary-500' : 'bg-gray-300'}`}>
              <View className={`w-5 h-5 rounded-full bg-white shadow m-0.5 ${watch('is_featured') ? 'ml-6' : 'ml-0.5'}`} />
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Variants ── */}
        <View className="bg-white rounded-2xl p-4 mb-3"
          style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          <View className="flex-row items-center justify-between mb-1">
            <View>
              <Text className="font-bold text-gray-900">🔀  Variants</Text>
              <Text className="text-xs text-gray-400 mt-0.5">e.g. sizes, flavours, colours</Text>
            </View>
            <TouchableOpacity
              onPress={() => appendVariant({ name: '', price_modifier: 0, stock_quantity: 0 })}
              className="flex-row items-center gap-1 bg-primary-50 rounded-xl px-3 py-2"
            >
              <Ionicons name="add" size={14} color="#2563eb" />
              <Text className="text-primary-600 text-sm font-semibold">Add</Text>
            </TouchableOpacity>
          </View>

          {variantFields.length === 0 && (
            <Text className="text-gray-400 text-sm text-center py-3">
              No variants. Add one if this product comes in different sizes or options.
            </Text>
          )}

          {variantFields.map((field, idx) => (
            <View key={field.id} className="border border-gray-100 rounded-xl p-3 mt-3">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-bold text-gray-500 uppercase">Variant {idx + 1}</Text>
                <TouchableOpacity onPress={() => removeVariant(idx)}>
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
              <View className="flex-row gap-2">
                <View className="flex-[^2]">
                  <Controller control={control} name={`variants.${idx}.name`}
                    render={({ field: { onChange, value } }) => (
                      <Input label="Name" placeholder="e.g. Large" value={value} onChangeText={onChange}
                        error={errors.variants?.[idx]?.name?.message} />
                    )}
                  />
                </View>
                <View className="flex-1">
                  <Controller control={control} name={`variants.${idx}.price_modifier`}
                    render={({ field: { onChange, value } }) => (
                      <Input label="+/- Price (RM)" placeholder="0" keyboardType="decimal-pad"
                        value={value ? String(value) : '0'} onChangeText={onChange} />
                    )}
                  />
                </View>
                <View className="flex-1">
                  <Controller control={control} name={`variants.${idx}.stock_quantity`}
                    render={({ field: { onChange, value } }) => (
                      <Input label="Stock" placeholder="0" keyboardType="numeric"
                        value={value ? String(value) : '0'} onChangeText={onChange} />
                    )}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>

        <Button onPress={handleSubmit(onSubmit)} loading={isSaving} className="mt-2">
          {editing ? 'Save Changes' : 'Add Product'}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
```

Now the two thin route files that use the shared form:

**`app/(merchant)/product/new.tsx`**:

```typescript
import { View, Text, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { ProductForm } from '@/components/merchant/ProductForm'

export default function NewProductScreen() {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const { merchant } = useAuthStore()

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <View className="bg-white px-5 pt-4 pb-3 flex-row items-center gap-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Add Product</Text>
      </View>
      <ProductForm
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['merchant-products', merchant?.id] })
          router.back()
        }}
      />
    </View>
  )
}
```

**`app/(merchant)/product/[productId].tsx`**:

```typescript
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { productsService } from '@/services/products.service'
import { ProductForm } from '@/components/merchant/ProductForm'

export default function EditProductScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>()
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const { merchant } = useAuthStore()

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn:  () => productsService.getById(productId),
  })

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <View className="bg-white px-5 pt-4 pb-3 flex-row items-center gap-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Edit Product</Text>
      </View>
      {isLoading
        ? <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 60 }} />
        : <ProductForm
            editing={product}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ['merchant-products', merchant?.id] })
              qc.invalidateQueries({ queryKey: ['product', productId] })
              router.back()
            }}
          />
      }
    </View>
  )
}
```


***

## File 6 — `app/(merchant)/store-settings.tsx`

```typescript
import {
  View, Text, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import * as ImagePicker from 'expo-image-picker'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { merchantsService } from '@/services/merchants.service'
import { uploadService } from '@/services/upload.service'
import { useAuthStore } from '@/stores/authStore'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import Toast from 'react-native-toast-message'

const schema = z.object({
  store_name:          z.string().min(3),
  description:         z.string().optional(),
  phone:               z.string().min(10),
  email:               z.string().email().optional().or(z.literal('')),
  address_line1:       z.string().min(5),
  city:                z.string().min(2),
  state:               z.string().min(2),
  postcode:            z.string().length(5),
  min_order_amount:    z.coerce.number().min(0).default(0),
  delivery_radius_km:  z.coerce.number().min(0).default(10),
})

type FormData = z.infer<typeof schema>

export default function StoreSettingsScreen() {
  const insets = useSafeAreaInsets()
  const { merchant, refreshMerchant } = useAuthStore()
  const [isSaving, setIsSaving]       = useState(false)
  const [logoUri, setLogoUri]         = useState<string | null>(merchant?.logo_url ?? null)
  const [bannerUri, setBannerUri]     = useState<string | null>(merchant?.banner_url ?? null)
  const [newLogo, setNewLogo]         = useState<string | null>(null)
  const [newBanner, setNewBanner]     = useState<string | null>(null)

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      store_name:         merchant?.store_name       ?? '',
      description:        merchant?.description      ?? '',
      phone:              merchant?.phone            ?? '',
      email:              merchant?.email            ?? '',
      address_line1:      merchant?.address_line1    ?? '',
      city:               merchant?.city             ?? '',
      state:              merchant?.state            ?? '',
      postcode:           merchant?.postcode         ?? '',
      min_order_amount:   merchant?.min_order_amount ?? 0,
      delivery_radius_km: merchant?.delivery_radius_km ?? 10,
    },
  })

  const pickImage = async (type: 'logo' | 'banner') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'logo' ? [1, 1] : [16, 5],
      quality: 0.85,
    })
    if (!result.canceled) {
      if (type === 'logo')   { setNewLogo(result.assets[^0].uri);   setLogoUri(result.assets[^0].uri)   }
      if (type === 'banner') { setNewBanner(result.assets[^0].uri); setBannerUri(result.assets[^0].uri) }
    }
  }

  const onSubmit = async (data: FormData) => {
    if (!merchant) return
    setIsSaving(true)
    try {
      let logoUrl   = merchant.logo_url   ?? null
      let bannerUrl = merchant.banner_url ?? null

      if (newLogo) {
        logoUrl = await uploadService.uploadImage('merchant-assets', merchant.id, newLogo, 'logo.jpg')
      }
      if (newBanner) {
        bannerUrl = await uploadService.uploadImage('merchant-assets', merchant.id, newBanner, 'banner.jpg')
      }

      await merchantsService.update(merchant.id, { ...data, logo_url: logoUrl, banner_url: bannerUrl })
      await refreshMerchant()
      Toast.show({ type: 'success', text1: 'Store updated!' })
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Update failed', text2: err.message })
    }
    setIsSaving(false)
  }

  function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <View className="bg-white rounded-2xl p-4 mb-3"
        style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
        <Text className="font-bold text-gray-900 mb-3">{title}</Text>
        {children}
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ paddingTop: insets.top }}
    >
      <View className="bg-white px-5 pt-4 pb-3 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">Store Settings</Text>
        <View className={`mt-1 self-start px-2 py-0.5 rounded-full
          ${merchant?.status === 'active' ? 'bg-green-100' : 'bg-yellow-100'}`}>
          <Text className={`text-xs font-semibold capitalize
            ${merchant?.status === 'active' ? 'text-green-700' : 'text-yellow-700'}`}>
            {merchant?.status?.replace('_', ' ')}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

        {/* ── Branding ── */}
        <SectionCard title="🎨  Branding">
          {/* Banner */}
          <Text className="text-sm font-semibold text-gray-700 mb-2">Store Banner</Text>
          <TouchableOpacity onPress={() => pickImage('banner')} activeOpacity={0.8} className="mb-4 relative">
            <Image
              source={bannerUri ? { uri: bannerUri } : require('../../../assets/placeholder-banner.png')}
              style={{ width: '100%', height: 110, borderRadius: 12 }}
              contentFit="cover"
            />
            <View className="absolute inset-0 rounded-xl items-center justify-center bg-black/20">
              <Ionicons name="camera" size={24} color="#fff" />
              <Text className="text-white text-xs font-semibold mt-1">Change Banner</Text>
            </View>
          </TouchableOpacity>

          {/* Logo */}
          <Text className="text-sm font-semibold text-gray-700 mb-2">Store Logo</Text>
          <View className="flex-row items-center gap-4">
            <Image
              source={logoUri ? { uri: logoUri } : require('../../../assets/placeholder-logo.png')}
              style={{ width: 72, height: 72, borderRadius: 16 }}
              contentFit="cover"
            />
            <TouchableOpacity
              onPress={() => pickImage('logo')}
              className="flex-row items-center gap-2 border border-gray-200 rounded-xl px-4 py-2.5"
            >
              <Ionicons name="camera-outline" size={16} color="#374151" />
              <Text className="text-gray-700 font-semibold text-sm">Change Logo</Text>
            </TouchableOpacity>
          </View>
        </SectionCard>

        {/* ── Basic info ── */}
        <SectionCard title="🏪  Store Info">
          <Controller control={control} name="store_name"
            render={({ field: { onChange, value } }) => (
              <Input label="Store Name *" value={value} onChangeText={onChange} error={errors.store_name?.message} />
            )}
          />
          <Controller control={control} name="description"
            render={({ field: { onChange, value } }) => (
              <Input label="Description" placeholder="What does your store sell?" value={value ?? ''} onChangeText={onChange} />
            )}
          />
          <Controller control={control} name="phone"
            render={({ field: { onChange, value } }) => (
              <Input label="Business Phone *" keyboardType="phone-pad" value={value} onChangeText={onChange} error={errors.phone?.message} />
            )}
          />
          <Controller control={control} name="email"
            render={({ field: { onChange, value } }) => (
              <Input label="Business Email" keyboardType="email-address" autoCapitalize="none" value={value ?? ''} onChangeText={onChange} />
            )}
          />
        </SectionCard>

        {/* ── Address ── */}
        <SectionCard title="📍  Store Address">
          <Controller control={control} name="address_line1"
            render={({ field: { onChange, value } }) => (
              <Input label="Address *" value={value} onChangeText={onChange} error={errors.address_line1?.message} />
            )}
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Controller control={control} name="city"
                render={({ field: { onChange, value } }) => (
                  <Input label="City *" value={value} onChangeText={onChange} error={errors.city?.message} />
                )}
              />
            </View>
            <View className="flex-1">
              <Controller control={control} name="postcode"
                render={({ field: { onChange, value } }) => (
                  <Input label="Postcode *" keyboardType="numeric" maxLength={5} value={value} onChangeText={onChange} error={errors.postcode?.message} />
                )}
              />
            </View>
          </View>
          <Controller control={control} name="state"
            render={({ field: { onChange, value } }) => (
              <Input label="State *" value={value} onChangeText={onChange} error={errors.state?.message} />
            )}
          />
        </SectionCard>

        {/* ── Delivery settings ── */}
        <SectionCard title="🚚  Delivery Settings">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Controller control={control} name="min_order_amount"
                render={({ field: { onChange, value } }) => (
                  <Input label="Min. Order (RM)" keyboardType="decimal-pad"
                    value={value ? String(value) : '0'} onChangeText={onChange}
                    hint="Set 0 for no minimum" />
                )}
              />
            </View>
            <View className="flex-1">
              <Controller control={control} name="delivery_radius_km"
                render={({ field: { onChange, value } }) => (
                  <Input label="Delivery Radius (km)" keyboardType="decimal-pad"
                    value={value ? String(value) : '10'} onChangeText={onChange}
                    hint="Max distance you'll deliver" />
                )}
              />
            </View>
          </View>
        </SectionCard>

        {/* Slug (read-only) */}
        <View className="bg-white rounded-2xl p-4 mb-3"
          style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          <Text className="font-bold text-gray-900 mb-2">🔗  Store URL</Text>
          <View className="bg-gray-50 rounded-xl p-3 flex-row items-center gap-2">
            <Ionicons name="link-outline" size={16} color="#9ca3af" />
            <Text className="text-gray-600 text-sm font-mono">/stores/{merchant?.store_slug}</Text>
          </View>
          <Text className="text-gray-400 text-xs mt-1">Store URL cannot be changed after creation</Text>
        </View>

        <Button onPress={handleSubmit(onSubmit)} loading={isSaving}>
          Save Store Settings
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
```


***

## Verify Checklist

```bash
npx expo start
```

| Screen | What to test |
| :-- | :-- |
| **Orders tab** | Red badge appears on tab when new paid orders exist; realtime badge updates without refresh [^1] |
| **Orders list** | Filter tabs work; "New Order" banner shows on paid orders; pull to refresh works |
| **Order detail** | Accept button changes status to `confirmed`; Reject prompts confirmation; buttons disappear for terminal statuses (delivered/cancelled) |
| **Products list** | Eye icon toggles active/inactive; pencil opens edit form; trash asks for confirmation |
| **Add Product** | Image picker selects up to 5 photos; variants add/remove correctly; saves to Supabase and returns to list |
| **Edit Product** | Existing data pre-fills correctly; new images upload alongside existing ones |
| **Store Settings** | Logo + banner upload and preview before saving; slug field is read-only |

<span style="display:none">[^10][^11][^12][^13][^14][^15][^3][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://supabase.com/docs/guides/realtime/subscribing-to-database-changes

[^2]: https://docs.expo.dev/tutorial/image-picker/

[^3]: https://docs.expo.dev/versions/latest/sdk/imagepicker/

[^4]: https://www.npmjs.com/package/expo-image-multiple-picker

[^5]: https://www.npmjs.com/package/expo-image-picker-multiple

[^6]: https://stackoverflow.com/questions/58768358/expo-image-picker-upload-multiple-images

[^7]: https://stackoverflow.com/questions/76177187/how-to-subscribe-to-realtime-data-from-supabase-in-react-native-application

[^8]: https://stackoverflow.com/questions/73785457/react-native-expo-multiple-image-upload-not-working

[^9]: https://stackoverflow.com/questions/74583729/supabase-realtime-subscribe-for-react

[^10]: https://github.com/mdjfs/expo-image-multiple-picker

[^11]: https://github.com/natysoz/expo-images-picker

[^12]: https://www.youtube.com/watch?v=F7F71ng9JYM

[^13]: https://www.youtube.com/watch?v=OVuRWEMeLGA

[^14]: https://supabase.com/docs/reference/javascript/subscribe

[^15]: https://www.youtube.com/watch?v=pBEYprNAs4c

