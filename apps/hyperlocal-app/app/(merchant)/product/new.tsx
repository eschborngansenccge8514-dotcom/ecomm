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
