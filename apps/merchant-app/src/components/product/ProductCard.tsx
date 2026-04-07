import { View, Text, TouchableOpacity } from 'react-native'
import { Image } from 'expo-image'
import { formatCurrency } from '@/lib/utils'
import type { ProductWithVariants } from '@/types/app.types'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'

interface ProductCardProps {
  product: ProductWithVariants
  onPress: () => void
  index?: number
}

export function ProductCard({ product, onPress, index = 0 }: ProductCardProps) {
  const hasMultipleVariants = product.variants.length > 1
  const minPrice = Math.min(...product.variants.map(v => product.price + (v.price_modifier ?? 0)), product.price)

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <TouchableOpacity 
        onPress={onPress} 
        className="bg-white mx-4 my-2 px-4 py-4 rounded-[20px] flex-row gap-4 border border-gray-100" 
        activeOpacity={0.8}
        style={{
          shadowColor: '#94a3b8',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 2,
        }}
      >
        <Image
          source={{ uri: product.images?.[0] ?? 'https://via.placeholder.com/100' }}
          style={{ width: 96, height: 96, borderRadius: 16 }}
          contentFit="cover"
        />
        <View className="flex-1 justify-between py-1">
          <View>
            <Text className="text-gray-900 font-bold font-heading text-lg leading-tight" numberOfLines={2}>
              {product.name}
            </Text>
            {product.description && (
              <Text className="text-gray-500 font-sans text-xs mt-1 leading-snug" numberOfLines={2}>
                {product.description}
              </Text>
            )}
          </View>
          
          <View className="flex-row items-center justify-between mt-3">
            <View>
              <Text className="text-primary-600 font-bold font-sans text-base">
                {hasMultipleVariants ? `From ${formatCurrency(minPrice)}` : formatCurrency(product.price)}
              </Text>
              {product.compare_at_price != null && product.compare_at_price > product.price && (
                <Text className="text-gray-400 font-sans text-xs line-through mt-0.5">
                  {formatCurrency(product.compare_at_price)}
                </Text>
              )}
            </View>
            <View className="bg-primary-50 w-8 h-8 rounded-full items-center justify-center">
              <Ionicons name="add" size={20} color="#2563eb" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}
