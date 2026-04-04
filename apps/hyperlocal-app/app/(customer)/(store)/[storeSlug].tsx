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
import { Linking, Alert } from 'react-native'

import { merchantsService } from '@/services/merchants.service'
import { productsService } from '@/services/products.service'
import { ProductCard } from '@/components/product/ProductCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/utils'
import { isStoreOpen, formatOperatingHour, getDayName } from '@/lib/merchant-utils'
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

  const { isOpen, nextStatusChange } = merchant ? isStoreOpen(merchant) : { isOpen: true }
  const activeAnnouncement = merchant?.announcements?.find(a => a.is_active)

  const handleProductPress = (product: any) => {
    if (!isOpen) {
      Alert.alert(
        'Store Closed',
        `This store is currently closed. It will reopen at ${nextStatusChange ?? 'its scheduled time'}. You can still browse products, but ordering is disabled.`,
        [{ text: 'OK' }]
      )
      return
    }
    router.push(`/(customer)/(store)/${storeSlug}/product/${product.id}`)
  }

  const handleCall = () => {
    if (merchant?.phone) Linking.openURL(`tel:${merchant.phone}`)
  }

  const handleEmail = () => {
    if (merchant?.email) Linking.openURL(`mailto:${merchant.email}`)
  }

  const handleGetDirections = () => {
    const address = `${merchant?.address_line1}, ${merchant?.city}, ${merchant?.state}, ${merchant?.postcode}`
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    Linking.openURL(url)
  }

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

              {/* Announcement Overlay if scroll is low */}
              {activeAnnouncement && (
                <View 
                  className="absolute bottom-12 left-4 right-4 p-3 rounded-2xl flex-row items-center gap-3"
                  style={{ backgroundColor: activeAnnouncement.bg_color + 'E6' }}
                >
                  <Ionicons name="megaphone" size={20} color={activeAnnouncement.text_color} />
                  <Text className="flex-1 font-sans font-medium text-sm" style={{ color: activeAnnouncement.text_color }}>
                    {activeAnnouncement.message}
                  </Text>
                </View>
              )}
            </View>

            {/* Store Information Card overlapping the banner */}
            <View className="bg-white rounded-[32px] mx-4 pt-6 pb-8 px-6 -mt-10 border border-gray-100 shadow-sm" style={styles.shadowHeavy}>
              <View className="items-center -mt-16 mb-4">
                <View className="bg-white p-1 rounded-[22px] shadow-sm border border-gray-100 relative">
                  <Image
                    source={{ uri: merchant.logo_url ?? 'https://via.placeholder.com/100' }}
                    style={{ width: 80, height: 80, borderRadius: 18 }}
                    contentFit="cover"
                  />
                  {/* Open/Closed Badge */}
                  <View 
                    style={{ position: 'absolute', bottom: -10, alignSelf: 'center' }}
                    className={`px-3 py-1 rounded-full border-2 border-white shadow-sm ${isOpen ? 'bg-emerald-500' : 'bg-red-500'}`}
                  >
                    <Text className="text-white text-[10px] font-bold uppercase tracking-wider">
                      {isOpen ? 'Open' : 'Closed'}
                    </Text>
                  </View>
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
              
              <View className="flex-row items-center justify-center gap-6 py-4 border-t border-b border-gray-100 mb-6">
                <View className="items-center">
                  <Text className="text-xs text-gray-500 font-sans mb-0.5">Delivery Range</Text>
                  <Text className="text-sm font-bold font-sans text-gray-900">Up to {merchant.delivery_radius_km ?? 0} km</Text>
                </View>
                {(merchant.min_order_amount ?? 0) > 0 && (
                  <>
                    <View className="h-6 w-[1px] bg-gray-200" />
                    <View className="items-center">
                      <Text className="text-xs text-gray-500 font-sans mb-0.5">Min. Order</Text>
                      <Text className="text-sm font-bold font-sans text-gray-900">
                        {formatCurrency(merchant.min_order_amount!)}
                      </Text>
                    </View>
                  </>
                )}
                <View className="h-6 w-[1px] bg-gray-200" />
                <View className="items-center">
                  <Text className="text-xs text-gray-500 font-sans mb-0.5">Store Location</Text>
                  <Text className="text-sm font-bold font-sans text-gray-900">
                    {merchant.city ?? 'Local Store'}
                  </Text>
                </View>
              </View>

              {merchant.description && (
                <Text className="text-gray-600 text-sm mb-6 leading-relaxed font-sans text-center">
                  {merchant.description}
                </Text>
              )}

              {/* Enhanced Info Section */}
              <View className="bg-gray-50 rounded-2xl p-4 gap-4">
                {/* Contact Row */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-4">
                    <Text className="text-xs text-gray-500 font-sans uppercase font-bold tracking-wider mb-1">Contact Details</Text>
                    <Text className="text-sm text-gray-900 font-sans" numberOfLines={1}>{merchant.phone || 'No phone set'}</Text>
                    <Text className="text-sm text-gray-500 font-sans" numberOfLines={1}>{merchant.email || 'No email set'}</Text>
                  </View>
                  <View className="flex-row gap-2">
                    {merchant.phone && (
                      <TouchableOpacity onPress={handleCall} className="w-10 h-10 bg-white rounded-full items-center justify-center shadow-sm border border-gray-100">
                        <Ionicons name="call" size={18} color="#2563eb" />
                      </TouchableOpacity>
                    )}
                    {merchant.email && (
                      <TouchableOpacity onPress={handleEmail} className="w-10 h-10 bg-white rounded-full items-center justify-center shadow-sm border border-gray-100">
                        <Ionicons name="mail" size={18} color="#2563eb" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Address Row */}
                <View className="border-t border-gray-100 pt-4">
                  <Text className="text-xs text-gray-500 font-sans uppercase font-bold tracking-wider mb-1">Physical Address</Text>
                  <View className="flex-row items-start justify-between">
                    <Text className="flex-1 text-sm text-gray-900 font-sans leading-5 pr-4">
                      {merchant.address_line1 ? (
                        `${merchant.address_line1}${merchant.address_line2 ? `, ${merchant.address_line2}` : ''}\n${merchant.postcode} ${merchant.city}, ${merchant.state}`
                      ) : (
                        'Address not available'
                      )}
                    </Text>
                    <TouchableOpacity onPress={handleGetDirections} className="bg-primary-600 px-4 py-2 rounded-lg">
                      <Text className="text-white text-xs font-bold">Directions</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Hours Row */}
                {merchant.operating_hours && merchant.operating_hours.length > 0 && (
                  <View className="border-t border-gray-100 pt-4">
                    <Text className="text-xs text-gray-500 font-sans uppercase font-bold tracking-wider mb-2">Operating Hours</Text>
                    {merchant.operating_hours.map((h) => (
                      <View key={h.id} className="flex-row justify-between mb-1.5">
                        <Text className={`text-xs font-sans ${h.day_of_week === new Date().getDay() ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
                          {getDayName(h.day_of_week)}
                        </Text>
                        <Text className={`text-xs font-sans ${h.day_of_week === new Date().getDay() ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
                          {formatOperatingHour(h)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
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
            onPress={() => handleProductPress(item)}
          />
        )}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshing={loadingProducts}
      />

      {/* Floating Chat Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push({
          pathname: '/(customer)/support',
          params: { 
            merchantId: merchant.owner_id, 
            storeName: merchant.store_name 
          }
        })}
        style={[styles.chatFAB, styles.shadowHeavy]}
        className="bg-primary-600 w-14 h-14 rounded-full items-center justify-center absolute bottom-10 right-6 z-50 border-4 border-white"
      >
        <Ionicons name="chatbox-ellipses" size={24} color="#fff" />
      </TouchableOpacity>
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
  },
  chatFAB: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  }
})
