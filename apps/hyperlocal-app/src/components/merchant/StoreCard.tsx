import { View, Text, TouchableOpacity } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import type { Merchant } from '@/types/app.types'

interface Props {
  merchant: Merchant
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
