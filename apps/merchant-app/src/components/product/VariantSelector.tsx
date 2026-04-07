import { View, Text, TouchableOpacity } from 'react-native'
import { formatCurrency } from '@/lib/utils'
import type { ProductVariant } from '@/types/app.types'

interface VariantSelectorProps {
  variants:   ProductVariant[]
  selectedId: string | null
  onSelect:   (id: string) => void
  trackInventory?: boolean
}

export function VariantSelector({ variants, selectedId, onSelect, trackInventory = true }: VariantSelectorProps) {
  return (
    <View className="mt-6">
      <Text className="font-semibold text-gray-700 mb-2 Small">Options</Text>
      <View className="flex-row flex-wrap gap-2">
        {variants.map(variant => (
          <TouchableOpacity
            key={variant.id}
            onPress={() => onSelect(variant.id)}
            className={`px-4 py-3 rounded-xl border-2 items-center min-w-[100px]
              ${selectedId === variant.id ? 'border-primary-500 bg-primary-50' : 'border-gray-100 bg-white'}`}
          >
            <Text className={`font-semibold capitalize
              ${selectedId === variant.id ? 'text-primary-700' : 'text-gray-700'}`}>
              {variant.name}
            </Text>
            {(variant.price_modifier ?? 0) !== 0 && (
              <Text className={`text-[10px] mt-0.5
                ${selectedId === variant.id ? 'text-primary-600' : 'text-gray-400'}`}>
                {(variant.price_modifier ?? 0) > 0 ? '+' : ''}{formatCurrency(variant.price_modifier ?? 0)}
              </Text>
            )}
            {trackInventory && variant.stock_quantity <= 0 && (
              <Text className="text-red-500 text-[10px] uppercase font-bold mt-1">Sold out</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}
