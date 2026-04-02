import {
  View, Text, FlatList, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { productsService } from '@/services/products.service'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'
import Toast from 'react-native-toast-message'
import type { ProductWithVariants } from '@/types/app.types'

function ProductRow({ product, onEdit, onToggle, onDelete }: {
  product:  ProductWithVariants
  onEdit:   () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const isActive     = product.status === 'active'
  const isOutOfStock = product.stock_quantity <= 0 && product.track_inventory

  return (
    <View
      className="bg-white rounded-2xl flex-row gap-3 p-3 mb-3"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, opacity: isActive ? 1 : 0.55 }}
    >
      {/* Image */}
      <Image
        source={product.images?.[0] ? { uri: product.images[0] } : require('../../assets/placeholder-logo.png')}
        style={{ width: 72, height: 72, borderRadius: 12 }}
        contentFit="cover"
      />

      {/* Details */}
      <View className="flex-1 justify-between py-0.5">
        <View>
          <Text className="text-gray-900 font-semibold text-sm" numberOfLines={1}>{product.name}</Text>
          {product.category && (
            <Text className="text-gray-400 text-xs">{product.category.name}</Text>
          )}
          <View className="flex-row items-center gap-2 mt-1">
            <Text className="text-primary-600 font-bold text-sm">{formatCurrency(product.price)}</Text>
            {product.compare_at_price && product.compare_at_price > product.price && (
              <Text className="text-gray-400 text-xs line-through">{formatCurrency(product.compare_at_price)}</Text>
            )}
          </View>
        </View>

        <View className="flex-row items-center gap-2 mt-1.5">
          {/* Stock badge */}
          <View className={`rounded-full px-2 py-0.5 ${isOutOfStock ? 'bg-red-100' : 'bg-gray-100'}`}>
            <Text className={`text-[10px] font-semibold ${isOutOfStock ? 'text-red-600' : 'text-gray-500'}`}>
              {isOutOfStock
                ? 'Out of stock'
                : product.track_inventory
                  ? `${product.stock_quantity} left`
                  : 'Unlimited'}
            </Text>
          </View>
          {product.variants.length > 0 && (
            <View className="bg-purple-100 rounded-full px-2 py-0.5">
              <Text className="text-purple-700 text-[10px] font-semibold">
                {product.variants.length} variant{product.variants.length > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Action buttons */}
      <View className="items-center gap-3 justify-center">
        {/* Active toggle */}
        <TouchableOpacity
          onPress={onToggle}
          className={`w-8 h-8 rounded-full items-center justify-center
            ${isActive ? 'bg-green-100' : 'bg-gray-100'}`}
        >
          <Ionicons
            name={isActive ? 'eye-outline' : 'eye-off-outline'}
            size={16}
            color={isActive ? '#16a34a' : '#9ca3af'}
          />
        </TouchableOpacity>
        {/* Edit */}
        <TouchableOpacity
          onPress={onEdit}
          className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center"
        >
          <Ionicons name="pencil-outline" size={16} color="#2563eb" />
        </TouchableOpacity>
        {/* Delete */}
        <TouchableOpacity
          onPress={onDelete}
          className="w-8 h-8 rounded-full bg-red-100 items-center justify-center"
        >
          <Ionicons name="trash-outline" size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function MerchantProductsScreen() {
  const insets = useSafeAreaInsets()
  const { merchant } = useAuthStore()
  const qc = useQueryClient()

  const { data: products = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['merchant-products', merchant?.id],
    queryFn:  () => productsService.getByMerchantOwner(merchant!.id),
    enabled:  !!merchant?.id,
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      supabase.from('products').update({ status }).eq('id', id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merchant-products'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['merchant-products'] })
      Toast.show({ type: 'success', text1: 'Product deleted' })
    },
  })

  const handleDelete = (id: string, name: string) => {
    Alert.alert(`Delete "${name}"?`, 'This will hide the product from customers. Orders are not affected.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ])
  }

  const handleToggle = (product: ProductWithVariants) => {
    const newStatus = product.status === 'active' ? 'inactive' : 'active'
    toggleMutation.mutate({ id: product.id, status: newStatus })
  }

  const activeCount   = products.filter(p => p.status === 'active').length
  const inactiveCount = products.filter(p => p.status !== 'active').length

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white px-5 pt-4 pb-4 border-b border-gray-100">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-2xl font-bold text-gray-900">Products</Text>
            <Text className="text-gray-400 text-sm">
              {activeCount} active · {inactiveCount} hidden
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(merchant)/product/new')}
            className="bg-primary-500 rounded-xl px-4 py-2.5 flex-row items-center gap-2"
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text className="text-white font-bold text-sm">Add Product</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View className="p-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </View>
      ) : products.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-primary-50 items-center justify-center mb-4">
            <Ionicons name="cube-outline" size={36} color="#2563eb" />
          </View>
          <Text className="text-lg font-bold text-gray-700 text-center">No products yet</Text>
          <Text className="text-gray-400 text-sm text-center mt-1">Add your first product so customers can start buying.</Text>
          <TouchableOpacity
            onPress={() => router.push('/(merchant)/product/new')}
            className="mt-5 bg-primary-500 rounded-2xl px-6 py-3 flex-row items-center gap-2"
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text className="text-white font-semibold">Add First Product</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={p => p.id}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2563eb" />}
          renderItem={({ item }) => (
            <ProductRow
              product={item}
              onEdit={() => router.push(`/(merchant)/product/${item.id}`)}
              onToggle={() => handleToggle(item)}
              onDelete={() => handleDelete(item.id, item.name)}
            />
          )}
        />
      )}
    </View>
  )
}
