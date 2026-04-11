import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { Image } from 'expo-image'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { productsService } from '@/services/products.service'
import { useCartStore } from '@/stores/cartStore'
import { VariantSelector } from '@/components/product/VariantSelector'
import { ProductAttributes } from '@/components/product/ProductAttributes'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import { isStoreOpen } from '@/lib/merchant-utils'
import * as Haptics from 'expo-haptics'
import Toast from 'react-native-toast-message'
import type { ProductWithMerchant } from '@/services/products.service'

export default function ProductDetailScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>()
  const { addItem, merchantId, getItemCount } = useCartStore()
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const insets = useSafeAreaInsets()
  const cartCount = getItemCount()

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ['product', productId],
    queryFn:  () => productsService.getById(productId) as Promise<ProductWithMerchant>,
    enabled:  !!productId,
  })

  if (isLoading) return (
    <View className="flex-1 bg-white items-center justify-center">
      <Text className="text-gray-400">Loading product...</Text>
    </View>
  )

  if (isError || !product) return (
    <View className="flex-1 bg-white items-center justify-center px-8">
      <Text className="text-lg font-bold text-gray-900 mb-2">Product not found</Text>
      <Text className="text-gray-500 text-center mb-6">This product may no longer be available.</Text>
      <TouchableOpacity onPress={() => router.back()} className="px-6 py-3 bg-gray-900 rounded-full">
        <Text className="text-white font-bold">Go Back</Text>
      </TouchableOpacity>
    </View>
  )

  const selectedVariant = product.variants.find(v => v.id === selectedVariantId) ?? null
  const finalPrice = product.price + (selectedVariant?.price_modifier ?? 0)
  const requiresVariant = product.variants.length > 0 && !selectedVariant

  const handleAddToCart = async () => {
    const { isOpen, nextStatusChange } = isStoreOpen(product.merchant)
    
    if (!isOpen) {
      Alert.alert(
        'Store Closed',
        `This store is currently closed. It will reopen at ${nextStatusChange ?? 'its scheduled time'}. You can't add items to cart right now.`,
        [{ text: 'OK' }]
      )
      return
    }

    if (requiresVariant) {
      Toast.show({ type: 'error', text1: 'Please select a variant' })
      return
    }
    try {
      addItem(product, selectedVariant, quantity)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Toast.show({ type: 'success', text1: `${product.name} added to cart!` })
    } catch (err: any) {
      if (err.message === 'DIFFERENT_MERCHANT') {
        Alert.alert(
          'Start new cart?',
          'Your cart contains items from a different store. Clear it to add this item?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Clear & Add',
              style: 'destructive',
              onPress: () => {
                useCartStore.getState().clearCart()
                addItem(product, selectedVariant, quantity)
              },
            },
          ]
        )
      }
    }
  }

  return (
    <View className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Images */}
        <Image
          source={{ uri: product.images?.[0] ?? 'https://via.placeholder.com/600x450' }}
          style={{ width: '100%', height: 350 }}
          contentFit="cover"
        />

        {/* Back button — top left */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ position: 'absolute', top: insets.top + 8, left: 16, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 }}
        >
          <Ionicons name="arrow-back" size={20} color="#0f172a" />
        </TouchableOpacity>

        {/* Cart button — top right */}
        <TouchableOpacity
          onPress={() => router.push('/(customer)/(cart)')}
          style={{ position: 'absolute', top: insets.top + 8, right: 16, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', shadowColor: '#2563eb', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
        >
          <Ionicons name="bag" size={20} color="#fff" />
          {cartCount > 0 && (
            <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <View className="px-5 pt-8 pb-32">
          {/* Price & Name */}
          <Text className="text-3xl font-bold text-gray-900 leading-tight">{product.name}</Text>
          <View className="flex-row items-center gap-3 mt-4">
            <Text className="text-2xl font-bold text-primary-600">{formatCurrency(finalPrice)}</Text>
            {product.compare_at_price && product.compare_at_price > product.price && (
              <Text className="text-lg text-gray-400 line-through">
                {formatCurrency(product.compare_at_price)}
              </Text>
            )}
          </View>

          {/* Description */}
          {product.description && (
            <View className="mt-8 pt-6 border-t border-gray-100">
              <Text className="text-gray-900 font-bold mb-3 uppercase tracking-widest text-xs">Product Details</Text>
              <Text className="text-gray-600 leading-relaxed text-base">{product.description}</Text>
            </View>
          )}

          {/* Type-specific attributes (e.g. Electronics Details) */}
          {product.attributes && product.attributes.length > 0 && (
            <ProductAttributes
              attributes={product.attributes}
              sectionTitle={`${product.merchant.industry?.charAt(0).toUpperCase()}${product.merchant.industry?.slice(1) ?? ''} Details`}
            />
          )}

          {/* Variants */}
          {product.variants.length > 0 && (
            <VariantSelector
              variants={product.variants}
              selectedId={selectedVariantId}
              onSelect={setSelectedVariantId}
              trackInventory={product.track_inventory ?? true}
            />
          )}

          {/* Quantity selector */}
          <View className="mt-10 pt-6 border-t border-gray-100">
            <Text className="font-bold text-gray-900 uppercase tracking-widest text-xs mb-4">Select Quantity</Text>
            <View className="flex-row items-center gap-4">
              <TouchableOpacity
                onPress={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-12 h-12 rounded-2xl bg-gray-100 items-center justify-center shadow-sm"
              >
                <Text className="text-xl font-bold text-gray-700">−</Text>
              </TouchableOpacity>
              <View className="px-6 py-2 bg-white rounded-2xl border border-gray-100 min-w-[60px] items-center justify-center">
                <Text className="text-xl font-bold text-gray-900">{quantity}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setQuantity(q => Math.min(product.track_inventory ? (selectedVariant?.stock_quantity ?? product.stock_quantity) : 9999, q + 1))}
                className="w-12 h-12 rounded-2xl bg-gray-100 items-center justify-center shadow-sm"
              >
                <Text className="text-xl font-bold text-gray-700">+</Text>
              </TouchableOpacity>
              <Text className="text-gray-400 text-sm ml-2">
                {product.track_inventory 
                  ? `${selectedVariant?.stock_quantity ?? product.stock_quantity} left` 
                  : 'Unlimited'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Add to Cart */}
      <View className="absolute bottom-0 left-0 right-0 bg-white/95 border-t border-gray-100 px-6 pt-4 pb-10 shadow-lg">
        <Button onPress={handleAddToCart} size="lg">
          Add to Cart — {formatCurrency(finalPrice * quantity)}
        </Button>
      </View>
    </View>
  )
}
