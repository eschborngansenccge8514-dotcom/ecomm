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
              : require('../../../assets/placeholder-logo.png')
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

      {/* Bottom row: total + order number + Chat */}
      <View className="flex-row justify-between items-end mt-3">
        <View>
          <Text className="text-gray-400 text-xs">{order.order_number}</Text>
          <Text className="text-gray-400 text-xs">{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
        </View>
        
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation()
              router.push({
                pathname: '/(customer)/support',
                params: { 
                  merchantId: order.merchant?.owner_id, 
                  storeName: order.merchant?.store_name,
                  orderId: order.id,
                }
              })
            }}
            className="flex-row items-center gap-1.5 bg-primary-50 px-3 py-1.5 rounded-lg"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={14} color="#2563eb" />
            <Text className="text-primary-600 font-bold text-xs">Ask AI</Text>
          </TouchableOpacity>

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
