import { View, Text, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { formatCurrency, formatRelativeTime } from '@/lib/utils'
import type { OrderWithItems } from '@/types/app.types'

interface OrderCardProps {
  order:   OrderWithItems
  onPress: () => void
}

const statusColors: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-700',
  paid:       'bg-blue-100 text-blue-700',
  confirmed:  'bg-indigo-100 text-indigo-700',
  preparing:  'bg-purple-100 text-purple-700',
  ready:      'bg-cyan-100 text-cyan-700',
  delivering: 'bg-teal-100 text-teal-700',
  completed:  'bg-green-100 text-green-700',
  cancelled:  'bg-red-100 text-red-700',
}

export function OrderCard({ order, onPress }: OrderCardProps) {
  const statusParts = statusColors[order.status]?.split(' ') ?? ['bg-gray-100', 'text-gray-700']
  const bgClass = statusParts[0]
  const textClass = statusParts[1]

  return (
    <TouchableOpacity onPress={onPress} className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm" activeOpacity={0.7}>
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1">
          <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>
            {order.merchant?.store_name ?? 'Store'}
          </Text>
          <Text className="text-xs text-gray-500 mt-0.5">
            {formatRelativeTime(order.created_at)} • {order.items?.length ?? 0} {order.items?.length === 1 ? 'item' : 'items'}
          </Text>
        </View>
        <View className={`${bgClass} px-2.5 py-1 rounded-full`}>
          <Text className={`${textClass} text-[10px] font-bold uppercase tracking-wider`}>
            {order.status.replace('_', ' ')}
          </Text>
        </View>
      </View>

      <View className="flex-row justify-between items-center bg-gray-50 p-2.5 rounded-xl">
        <View>
          <Text className="text-gray-400 text-[10px] uppercase font-bold tracking-tight">Order ID</Text>
          <Text className="text-gray-700 font-mono text-xs">#{order.id.slice(-8).toUpperCase()}</Text>
        </View>
        <View className="items-end">
          <Text className="text-gray-400 text-[10px] uppercase font-bold tracking-tight">Total Amount</Text>
          <Text className="text-primary-600 font-bold text-sm">
            {formatCurrency(Number(order.total_amount))}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}
