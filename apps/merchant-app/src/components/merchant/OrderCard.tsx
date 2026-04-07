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
    <TouchableOpacity 
      onPress={onPress} 
      className="bg-white rounded-3xl p-5 mb-4 border border-gray-100 shadow-soft" 
      activeOpacity={0.8}
    >
      <View className="flex-row justify-between items-center mb-4">
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5 mb-1.5">
            <Ionicons name="person-outline" size={12} color="#94a3b8" />
            <Text className="text-sm font-bold text-gray-900 font-heading" numberOfLines={1}>
              {order.buyer_name ?? 'Guest Buyer'}
            </Text>
          </View>
          <Text className="text-gray-400 text-xs font-medium">
            {formatRelativeTime(order.created_at)} • {order.items?.length ?? 0} {order.items?.length === 1 ? 'item' : 'items'}
          </Text>
        </View>
        <View className={`${bgClass} px-3 py-1.5 rounded-2xl`}>
          <Text className={`${textClass} text-[10px] font-bold uppercase tracking-widest font-semibold`}>
            {order.status.replace('_', ' ')}
          </Text>
        </View>
      </View>

      <View className="flex-row justify-between items-center bg-gray-50/80 p-4 rounded-2xl">
        <View>
          <Text className="text-gray-400 text-[9px] uppercase font-bold tracking-widest mb-1">REFERENCE</Text>
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="receipt-outline" size={12} color="#64748b" />
            <Text className="text-gray-600 font-mono text-xs">#{order.id.slice(-8).toUpperCase()}</Text>
          </View>
        </View>
        <View className="items-end">
          <Text className="text-gray-400 text-[9px] uppercase font-bold tracking-widest mb-1">REVENUE</Text>
          <Text className="text-primary-600 font-bold text-lg font-heading">
            {formatCurrency(Number(order.total_amount))}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}
