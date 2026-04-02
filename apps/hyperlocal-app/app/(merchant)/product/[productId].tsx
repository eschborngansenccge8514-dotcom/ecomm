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
