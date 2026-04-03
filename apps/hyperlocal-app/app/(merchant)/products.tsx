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
      className="bg-white rounded-3xl flex-row gap-4 p-4 mb-4 border border-gray-100 shadow-soft"
      style={{ opacity: isActive ? 1 : 0.6 }}
    >
      {/* Image with overlay for status */}
      <View>
        <Image
          source={product.images?.[0] ? { uri: product.images[0] } : require('../../assets/placeholder-logo.png')}
          style={{ width: 84, height: 84, borderRadius: 20 }}
          contentFit="cover"
        />
        {!isActive && (
          <View className="absolute inset-0 bg-gray-900/40 rounded-[20px] items-center justify-center">
            <Ionicons name="eye-off" size={20} color="#fff" />
          </View>
        )}
      </View>

      {/* Details */}
      <View className="flex-1 justify-between">
        <View>
          <View className="flex-row justify-between items-start">
            <View className="flex-1 mr-2">
              <Text className="text-gray-900 font-bold text-base font-heading" numberOfLines={1}>{product.name}</Text>
              {product.category && (
                <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">{product.category.name}</Text>
              )}
            </View>
          </View>
          
          <View className="flex-row items-center gap-2 mt-2">
            <Text className="text-primary-600 font-bold text-lg font-heading">{formatCurrency(product.price)}</Text>
            {product.compare_at_price && product.compare_at_price > product.price && (
              <Text className="text-gray-300 text-xs line-through font-medium">{formatCurrency(product.compare_at_price)}</Text>
            )}
          </View>
        </View>

        <View className="flex-row items-center gap-2 mt-2">
          {/* Stock badge */}
          <View className={`rounded-full px-2.5 py-1 flex-row items-center gap-1.5 ${isOutOfStock ? 'bg-red-50' : 'bg-gray-50'}`}>
            <View className={`w-1.5 h-1.5 rounded-full ${isOutOfStock ? 'bg-red-500' : 'bg-gray-400'}`} />
            <Text className={`text-[10px] font-bold uppercase tracking-tighter font-semibold ${isOutOfStock ? 'text-red-700' : 'text-gray-600'}`}>
              {isOutOfStock
                ? 'OUT OF STOCK'
                : product.track_inventory
                  ? `${product.stock_quantity} IN STOCK`
                  : 'UNLIMITED STOCK'}
            </Text>
          </View>
        </View>
      </View>

      {/* Vertical Action Column */}
      <View className="justify-between py-0.5">
        <TouchableOpacity
          onPress={onToggle}
          className={`w-9 h-9 rounded-2xl items-center justify-center border
            ${isActive ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}
        >
          <Ionicons
            name={isActive ? 'eye-outline' : 'eye-off-outline'}
            size={18}
            color={isActive ? '#16a34a' : '#94a3b8'}
          />
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={onEdit}
          className="w-9 h-9 rounded-2xl bg-primary-50 border border-primary-100 items-center justify-center"
        >
          <Ionicons name="pencil-outline" size={18} color="#2563eb" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onDelete}
          className="w-9 h-9 rounded-2xl bg-red-50 border border-red-100 items-center justify-center"
        >
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
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
    mutationFn: async ({ id, status }: { id: string; status: any }) => {
      const { error } = await supabase.from('products').update({ status }).eq('id', id)
      if (error) throw error
    },
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
      {/* Premium Header */}
      <View className="bg-white px-6 pt-4 pb-6 border-b border-gray-100 shadow-soft rounded-b-[32px]">
        <View className="flex-row items-end justify-between">
          <View>
            <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Catalog Management</Text>
            <Text className="text-3xl font-bold text-gray-900 font-heading">Products</Text>
            <View className="flex-row items-center gap-2 mt-1">
              <View className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <Text className="text-gray-500 text-xs font-medium">
                {activeCount} Live Items · {inactiveCount} Archived
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(merchant)/product/new')}
            className="bg-primary-600 rounded-[22px] px-5 py-3 flex-row items-center gap-2 shadow-soft"
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text className="text-white font-bold text-sm font-semibold">Add New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View className="p-6 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-3xl" />)}
        </View>
      ) : products.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <View className="w-24 h-24 rounded-[32px] bg-white border border-gray-100 shadow-soft items-center justify-center mb-6">
            <Ionicons name="cube-outline" size={44} color="#cbd5e1" />
          </View>
          <Text className="text-xl font-bold text-gray-900 text-center font-heading">Empty Showcase</Text>
          <Text className="text-gray-400 text-sm text-center mt-2 leading-5 font-medium">Your store is empty. Add products to start reaching customers in your area.</Text>
          <TouchableOpacity
            onPress={() => router.push('/(merchant)/product/new')}
            className="mt-8 bg-primary-600 rounded-3xl px-8 py-4 flex-row items-center gap-2 shadow-soft"
          >
            <Ionicons name="rocket-outline" size={18} color="#fff" />
            <Text className="text-white font-bold text-base font-semibold">Add First Product</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={p => p.id}
          contentContainerStyle={{ padding: 20 }}
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
