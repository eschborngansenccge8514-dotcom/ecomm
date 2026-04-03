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
] as const

// ─── Order row card ────────────────────────────────────────────────────────────
function OrderRow({ order, onPress }: { order: any; onPress: () => void }) {
  const cfg       = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
  const isNew     = order.status === 'paid'
  const itemNames = order.items?.map((i: any) => `${i.product_name} ×${i.quantity}`).join(', ') ?? ''

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className={`bg-white rounded-[32px] p-5 mb-4 border border-gray-100 shadow-soft ${isNew ? 'border-primary-200' : ''}`}
    >
      {/* Top row */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-1 mr-3">
          <View className="flex-row items-center gap-2 mb-1">
            <Text className="font-bold text-gray-900 text-base font-heading">#{order.order_number}</Text>
            {isNew && (
              <View className="bg-primary-500 rounded-full w-2 h-2" />
            )}
          </View>
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="person-outline" size={12} color="#94a3b8" />
            <Text className="text-gray-900 font-bold text-xs font-heading">
              {order.buyer_name ?? 'Guest Buyer'}
            </Text>
            <Text className="text-gray-300 text-[10px] uppercase font-bold tracking-tighter">
              • {formatRelativeTime(order.created_at)}
            </Text>
          </View>
        </View>
        <StatusBadge status={order.status} />
      </View>

      {/* Items preview with background */}
      <View className="bg-gray-50/80 rounded-2xl p-3 mb-4">
        <Text className="text-gray-500 text-xs font-medium leading-5" numberOfLines={2}>
          {itemNames}
        </Text>
      </View>

      {/* Bottom row */}
      <View className="flex-row justify-between items-center px-1">
        <View className="flex-row items-center gap-2">
          <View className="w-8 h-8 rounded-full bg-gray-50 items-center justify-center border border-gray-100">
            <Ionicons name="location-outline" size={14} color="#64748b" />
          </View>
          <Text className="text-gray-500 text-xs font-semibold truncate max-w-[140px]" numberOfLines={1}>
            {(order.delivery_address as any)?.city ?? 'No address'}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-gray-400 text-[9px] uppercase font-bold tracking-widest mb-0.5">TOTAL DUE</Text>
          <View className="flex-row items-center gap-1">
            <Text className="font-bold text-primary-600 text-lg font-heading">
              {formatCurrency(Number(order.total_amount))}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          </View>
        </View>
      </View>

      {/* New order action hint */}
      {isNew && (
        <View className="mt-4 bg-primary-600 rounded-2xl p-3 flex-row items-center justify-center gap-2 shadow-sm">
          <Ionicons name="flash-outline" size={14} color="#fff" />
          <Text className="text-white text-xs font-bold font-semibold">TAP TO PROCESS ORDER</Text>
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
      {/* Premium Header */}
      <View className="bg-white px-6 pt-4 pb-0 border-b border-gray-100 shadow-soft rounded-b-[32px]">
        <View className="flex-row items-center justify-between mb-5">
          <View>
            <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Order Pipeline</Text>
            <Text className="text-3xl font-bold text-gray-900 font-heading">Orders</Text>
          </View>
          {newCount > 0 && (
            <View className="bg-primary-500 rounded-2xl px-3 py-1.5 flex-row items-center gap-1.5 shadow-sm">
              <View className="w-2 h-2 rounded-full bg-white opacity-80" />
              <Text className="text-white text-[10px] font-bold uppercase tracking-widest font-semibold">{newCount} ACTIONABLE</Text>
            </View>
          )}
        </View>

        {/* Filter tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={{ gap: 12, paddingBottom: 0, paddingHorizontal: 4 }}
        >
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setActiveFilter(f.key)}
              className={`pb-4 px-1 ${activeFilter === f.key ? 'border-b-4 border-primary-500' : 'border-b-4 border-transparent'}`}
            >
              <Text className={`text-sm font-bold uppercase tracking-widest font-heading
                ${activeFilter === f.key ? 'text-primary-600' : 'text-gray-400'}`}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <View className="p-6 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-3xl" />)}
        </View>
      ) : orders.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <View className="w-24 h-24 rounded-[32px] bg-white border border-gray-100 shadow-soft items-center justify-center mb-6">
            <Ionicons name="receipt-outline" size={44} color="#cbd5e1" />
          </View>
          <Text className="text-xl font-bold text-gray-900 text-center font-heading">No Orders found</Text>
          <Text className="text-gray-400 text-sm text-center mt-2 leading-5 font-medium">
            There are no {currentFilter.label.toLowerCase()} orders at the moment. Check other filters or wait for new customers!
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={o => o.id}
          contentContainerStyle={{ padding: 20 }}
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
