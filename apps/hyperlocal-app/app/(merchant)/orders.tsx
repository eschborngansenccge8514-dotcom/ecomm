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

  // Realtime subscription
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
