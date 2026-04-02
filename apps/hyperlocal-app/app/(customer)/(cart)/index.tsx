import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  Animated,
} from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { useRef } from 'react'
import { Swipeable } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCartStore } from '@/stores/cartStore'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'

// ─── Swipeable delete row ──────────────────────────────────────────────────────
function RightAction(
  progress: Animated.AnimatedInterpolation<number>,
  _dragX: Animated.AnimatedInterpolation<number>,
  onDelete: () => void
) {
  const scale = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: [0.8, 1],
    extrapolate: 'clamp',
  })
  return (
    <TouchableOpacity
      onPress={onDelete}
      className="bg-red-500 justify-center items-center rounded-2xl ml-2 px-5 mb-3"
      style={{ width: 80 }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name="trash-outline" size={22} color="#fff" />
        <Text className="text-white text-xs mt-1 font-semibold">Remove</Text>
      </Animated.View>
    </TouchableOpacity>
  )
}

// ─── Single cart item row ──────────────────────────────────────────────────────
function CartItemRow({
  item,
  onRemove,
  onIncrement,
  onDecrement,
}: {
  item: any
  onRemove:    () => void
  onIncrement: () => void
  onDecrement: () => void
}) {
  const swipeRef = useRef<Swipeable>(null)

  const handleDelete = () => {
    swipeRef.current?.close()
    onRemove()
  }

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={40}
      renderRightActions={(progress, drag) => RightAction(progress, drag, handleDelete)}
    >
      <View
        className="bg-white rounded-2xl flex-row gap-3 p-3 mb-3"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 6,
          elevation: 2,
        }}
      >
        {/* Product image */}
        <Image
          source={
            item.imageUrl
              ? { uri: item.imageUrl }
              : require('../../../assets/placeholder-logo.png')
          }
          style={{ width: 76, height: 76, borderRadius: 14 }}
          contentFit="cover"
        />

        <View className="flex-1 justify-between py-0.5">
          <View>
            <Text
              className="text-gray-900 font-semibold text-sm leading-tight"
              numberOfLines={2}
            >
              {item.productName}
            </Text>
            {item.variantName && (
              <View className="bg-gray-100 self-start rounded-full px-2 py-0.5 mt-1">
                <Text className="text-gray-500 text-xs">{item.variantName}</Text>
              </View>
            )}
          </View>

          <View className="flex-row items-center justify-between mt-2">
            <Text className="text-primary-600 font-bold text-base">
              {formatCurrency(item.price)}
            </Text>

            {/* Qty stepper */}
            <View className="flex-row items-center gap-2 bg-gray-50 rounded-xl px-2 py-1">
              <TouchableOpacity
                onPress={onDecrement}
                className="w-7 h-7 rounded-lg bg-white items-center justify-center"
                style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 }}
              >
                <Ionicons
                  name={item.quantity === 1 ? 'trash-outline' : 'remove'}
                  size={14}
                  color={item.quantity === 1 ? '#ef4444' : '#374151'}
                />
              </TouchableOpacity>

              <Text className="text-gray-900 font-bold text-sm w-5 text-center">
                {item.quantity}
              </Text>

              <TouchableOpacity
                onPress={onIncrement}
                className="w-7 h-7 rounded-lg bg-primary-500 items-center justify-center"
              >
                <Ionicons name="add" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Swipeable>
  )
}

// ─── Order summary card ────────────────────────────────────────────────────────
function SummaryCard({ subtotal }: { subtotal: number }) {
  return (
    <View
      className="bg-white rounded-2xl p-4 mb-4"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
    >
      <Text className="font-bold text-gray-900 mb-3">Order Summary</Text>

      <View className="gap-2">
        <View className="flex-row justify-between">
          <Text className="text-gray-500 text-sm">Subtotal</Text>
          <Text className="text-gray-900 font-semibold text-sm">
            {formatCurrency(subtotal)}
          </Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-gray-500 text-sm">Delivery fee</Text>
          <Text className="text-gray-400 text-sm italic">Calculated at checkout</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-gray-500 text-sm">Discount</Text>
          <Text className="text-green-600 font-semibold text-sm">—</Text>
        </View>

        <View className="border-t border-gray-100 pt-2 mt-1">
          <View className="flex-row justify-between">
            <Text className="font-bold text-gray-900">Estimated Total</Text>
            <Text className="font-bold text-primary-600 text-lg">
              {formatCurrency(subtotal)}
            </Text>
          </View>
          <Text className="text-gray-400 text-xs mt-0.5">
            + delivery fee will be added at checkout
          </Text>
        </View>
      </View>
    </View>
  )
}

// ─── Empty state ───────────────────────────────────────────────────────────────
function EmptyCart() {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <View className="w-24 h-24 rounded-full bg-primary-50 items-center justify-center mb-5">
        <Ionicons name="bag-outline" size={44} color="#2563eb" />
      </View>
      <Text className="text-xl font-bold text-gray-900 text-center">
        Your cart is empty
      </Text>
      <Text className="text-gray-400 text-sm text-center mt-2 leading-relaxed">
        Browse stores near you and add something delicious or useful.
      </Text>
      <TouchableOpacity
        onPress={() => router.push('/(customer)/(home)')}
        className="mt-6 bg-primary-500 rounded-2xl px-8 py-3"
      >
        <Text className="text-white font-semibold">Browse Stores</Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function CartScreen() {
  const insets = useSafeAreaInsets()
  const {
    items,
    merchantId,
    updateQuantity,
    removeItem,
    clearCart,
    getTotal,
    getItemCount,
  } = useCartStore()

  // Get merchant name from first item (we store it in cart)
  const merchantName = items[0]?.productName ? undefined : undefined

  const handleClearCart = () => {
    Alert.alert('Clear cart?', 'Remove all items from your cart?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: clearCart,
      },
    ])
  }

  if (items.length === 0) {
    return (
      <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
        <View className="px-5 pt-4 pb-3">
          <Text className="text-2xl font-bold text-gray-900">Cart</Text>
        </View>
        <EmptyCart />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white px-5 pt-4 pb-3 flex-row items-center justify-between border-b border-gray-100">
        <View>
          <Text className="text-2xl font-bold text-gray-900">Cart</Text>
          <Text className="text-gray-400 text-sm">{getItemCount()} item{getItemCount() !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity onPress={handleClearCart} className="flex-row items-center gap-1">
          <Ionicons name="trash-outline" size={14} color="#ef4444" />
          <Text className="text-red-500 text-sm font-medium">Clear all</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => `${i.productId}-${i.variantId ?? 'none'}`}
        contentContainerStyle={{ padding: 16, paddingBottom: 200 }}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={() => <SummaryCard subtotal={getTotal()} />}
        renderItem={({ item }) => (
          <CartItemRow
            item={item}
            onRemove={() => removeItem(item.productId, item.variantId)}
            onIncrement={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
            onDecrement={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
          />
        )}
      />

      {/* Sticky checkout bar */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 pt-3"
        style={{ paddingBottom: insets.bottom + 8 }}
      >
        <View className="flex-row justify-between items-baseline mb-3">
          <Text className="text-gray-500 text-sm">Total</Text>
          <Text className="text-2xl font-bold text-gray-900">
            {formatCurrency(getTotal())}
          </Text>
        </View>
        <Button onPress={() => router.push('/(customer)/(cart)/checkout')}>
          Proceed to Checkout →
        </Button>
      </View>
    </View>
  )
}
