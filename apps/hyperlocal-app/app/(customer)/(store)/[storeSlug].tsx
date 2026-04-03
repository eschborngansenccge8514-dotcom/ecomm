import { View, Text, SectionList, TouchableOpacity, Dimensions, StyleSheet } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  createAnimatedComponent,
} from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { merchantsService } from '@/services/merchants.service'
import { productsService } from '@/services/products.service'
import { ProductCard } from '@/components/product/ProductCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/utils'
import type { ProductWithVariants } from '@/types/app.types'

const AnimatedSectionList = createAnimatedComponent(SectionList)

const { width, height } = Dimensions.get('window')
const HEADER_MIN_HEIGHT = 100
const HEADER_MAX_HEIGHT = 280

export default function StoreScreen() {
  const { storeSlug } = useLocalSearchParams<{ storeSlug: string }>()
  const insets = useSafeAreaInsets()
  const scrollY = useSharedValue(0)

  const { data: merchant, isLoading: loadingMerchant } = useQuery({
    queryKey: ['merchant', storeSlug],
    queryFn:  () => merchantsService.getBySlug(storeSlug),
    enabled:  !!storeSlug,
  })

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['products', merchant?.id],
    queryFn:  () => productsService.getByMerchant(merchant!.id),
    enabled:  !!merchant?.id,
  })

  // Group products
  const sections = products.reduce<Array<{ title: string; data: typeof products }>>((acc, product) => {
    const categoryName = (product as any).category?.name ?? 'Other'
    const existing = acc.find(s => s.title === categoryName)
    if (existing) existing.data.push(product)
    else acc.push({ title: categoryName, data: [product] })
    return acc
  }, [])

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y
    },
  })

  // Animated Hooks
  const bannerStyle = useAnimatedStyle(() => {
    const translateY = interpolate(scrollY.value, [-HEADER_MAX_HEIGHT, 0, HEADER_MAX_HEIGHT], [-HEADER_MAX_HEIGHT / 2, 0, HEADER_MAX_HEIGHT * 0.75])
    const scale = interpolate(scrollY.value, [-HEADER_MAX_HEIGHT, 0], [2, 1], Extrapolation.CLAMP)
    return {
      transform: [{ translateY }, { scale }],
    }
  })

  const headerBarStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [HEADER_MAX_HEIGHT - 120, HEADER_MAX_HEIGHT - 60], [0, 1], Extrapolation.CLAMP)
    return {
      opacity,
      backgroundColor: 'rgba(255,255,255,0.95)',
    }
  })

  if (loadingMerchant) return <Skeleton className="flex-1 rounded-none" />

  if (!merchant) return (
    <View className="flex-1 items-center justify-center p-8 bg-gray-50">
      <View className="bg-red-50 p-6 rounded-full mb-6">
        <Ionicons name="storefront-outline" size={64} color="#ef4444" />
      </View>
      <Text className="text-2xl font-heading font-bold text-gray-900 text-center mb-2">Store Not Found</Text>
      <Text className="text-gray-500 font-sans text-center mb-8">This store might be closed or doesn't exist.</Text>
      <TouchableOpacity onPress={() => router.back()} className="px-8 py-3.5 bg-gray-900 rounded-full shadow-lg">
        <Text className="text-white font-bold font-sans">Return Home</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <View className="flex-1 bg-gray-50">
      {/* Animated Fixed Navbar */}
      <Animated.View style={[styles.navbar, { paddingTop: insets.top }, headerBarStyle]}>
        <View className="h-12 flex-row items-center justify-center px-4">
          <Text className="text-lg font-bold font-heading text-gray-900" numberOfLines={1}>{merchant.store_name}</Text>
        </View>
        <View className="absolute inset-x-0 bottom-0 h-[1px] bg-gray-200/50" />
      </Animated.View>

      {/* Back Button (Fixed) */}
      <TouchableOpacity
        onPress={() => router.back()}
        className="absolute z-50 w-10 h-10 items-center justify-center rounded-full bg-white/80 overflow-hidden"
        style={{ top: insets.top + 5, left: 16 }}
      >
        <BlurView intensity={20} tint="light" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <Ionicons name="arrow-back" size={20} color="#0f172a" />
      </TouchableOpacity>

      <AnimatedSectionList
        sections={sections as any}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(item: any) => item.id}
        ListHeaderComponent={() => (
          <View className="bg-transparent pb-6">
            {/* Parallax Banner Wrapper */}
            <View style={styles.bannerContainer}>
              <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, bannerStyle]}>
                <Image
                  source={{ uri: merchant.banner_url ?? 'https://via.placeholder.com/600x400' }}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                  contentFit="cover"
                />
                <View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
              </Animated.View>
            </View>

            {/* Store Information Card overlapping the banner */}
            <View className="bg-white rounded-[32px] mx-4 pt-6 pb-8 px-6 -mt-10 border border-gray-100 shadow-sm" style={styles.shadowHeavy}>
              <View className="items-center -mt-16 mb-4">
                <View className="bg-white p-1 rounded-[22px] shadow-sm border border-gray-100">
                  <Image
                    source={{ uri: merchant.logo_url ?? 'https://via.placeholder.com/100' }}
                    style={{ width: 80, height: 80, borderRadius: 18 }}
                    contentFit="cover"
                  />
                </View>
              </View>

              <Text className="text-3xl font-bold font-heading text-gray-900 text-center tracking-tight mb-2">
                {merchant.store_name}
              </Text>
              
              <View className="flex-row items-center justify-center gap-2 mb-4">
                <View className="bg-primary-50 px-2.5 py-1 rounded-full">
                  <Text className="text-primary-700 text-xs font-bold font-sans uppercase tracking-widest">{merchant.industry}</Text>
                </View>
                 <View className="flex-row items-center gap-1">
                  <Ionicons name="star" size={14} color="#f59e0b" />
                  <Text className="text-sm font-bold font-sans text-gray-900">{merchant.average_rating?.toFixed(1) ?? 'New'}</Text>
                  <Text className="text-gray-400 text-xs font-sans">({merchant.review_count ?? 0})</Text>
                </View>
              </View>
              
              <View className="flex-row items-center justify-center gap-6 py-4 border-t border-b border-gray-100 mb-2">
                <View className="items-center">
                  <Text className="text-xs text-gray-500 font-sans mb-0.5">Delivery Range</Text>
                  <Text className="text-sm font-bold font-sans text-gray-900">Up to {merchant.delivery_radius_km ?? 0} km</Text>
                </View>
                <View className="h-6 w-[1px] bg-gray-200" />
                <View className="items-center">
                  <Text className="text-xs text-gray-500 font-sans mb-0.5">Store Location</Text>
                  <Text className="text-sm font-bold font-sans text-gray-900">
                    {merchant.city ?? 'Local Store'}
                  </Text>
                </View>
              </View>

              {merchant.description && (
                <Text className="text-gray-600 text-sm mt-4 leading-relaxed font-sans text-center">
                  {merchant.description}
                </Text>
              )}
            </View>
          </View>
        )}
        renderSectionHeader={({ section: { title } }: any) => (
          <View className="px-5 py-4 bg-gray-50/90 backdrop-blur-md mb-2">
            <Text className="text-lg font-bold font-heading text-gray-900 tracking-tight">{title}</Text>
          </View>
        )}
        renderItem={({ item, index }: any) => (
          <ProductCard
            product={item}
            index={index}
            onPress={() => router.push(`/(customer)/(store)/${storeSlug}/product/${item.id}`)}
          />
        )}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshing={loadingProducts}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  navbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
  },
  bannerContainer: {
    height: HEADER_MAX_HEIGHT,
    width: '100%',
    overflow: 'hidden',
  },
  shadowHeavy: {
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  }
})
