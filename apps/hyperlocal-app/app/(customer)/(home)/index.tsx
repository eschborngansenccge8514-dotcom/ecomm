import {
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Platform,
  StyleSheet
} from 'react-native'
import { router } from 'expo-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  FadeInDown,
  SharedValue,
} from 'react-native-reanimated'

import { merchantsService } from '@/services/merchants.service'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

// ─── Types ────────────────────────────────────────────────────────────────────
type Industry = {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const INDUSTRIES: Industry[] = [
  { label: 'All', icon: 'apps', color: '#6366f1' },
  { label: 'Food & Beverage', icon: 'restaurant', color: '#f59e0b' },
  { label: 'Grocery', icon: 'cart', color: '#10b981' },
  { label: 'Pharmacy', icon: 'medical', color: '#ef4444' },
  { label: 'Retail', icon: 'bag-handle', color: '#8b5cf6' },
  { label: 'Fashion', icon: 'shirt', color: '#ec4899' },
  { label: 'Electronics', icon: 'phone-portrait', color: '#3b82f6' },
  { label: 'Beauty', icon: 'sparkles', color: '#f43f5e' },
]

const BANNERS = [
  {
    id: '1',
    title: 'Free Delivery',
    subtitle: 'On your first 3 orders today',
    bg: ['#6366f1', '#4f46e5'],
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: '2',
    title: 'Fresh Groceries',
    subtitle: 'From local farms to your door',
    bg: ['#10b981', '#059669'],
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: '3',
    title: 'Refer & Earn',
    subtitle: 'Get RM 10 for every friend',
    bg: ['#8b5cf6', '#7c3aed'],
    image: 'https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?q=80&w=800&auto=format&fit=crop',
  },
]

// ─── Sub-components ────────────────────────────────────────────────────────────

function AnimatedHeader({ scrollY, name }: { scrollY: SharedValue<number>, name: string }) {
  const insets = useSafeAreaInsets()

  const headerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 50], [0, 1], Extrapolation.CLAMP)
    return {
      opacity,
      backgroundColor: 'rgba(255, 255, 255, 0.85)',
    }
  })

  // We layer an animated blur view over the regular content for a smooth scroll transition.
  return (
    <View style={[styles.headerContainer, { paddingTop: insets.top + 8 }]}>
      <Animated.View style={[{ position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 }, headerStyle]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={80} tint="light" style={{ position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 }} />
        ) : (
          <View style={[{ position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 }, { backgroundColor: 'white' }]} />
        )}
      </Animated.View>

      <View className="px-5 pb-3 flex-row items-center justify-between z-10">
        <View>
          <Text className="text-gray-500 font-medium text-sm font-sans mb-1">Good morning,</Text>
          <Text className="text-2xl font-bold text-gray-900 font-heading tracking-tight">
            {name} 👋
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(customer)/(profile)')}
          className="w-11 h-11 rounded-full bg-white items-center justify-center shadow-sm border border-gray-100"
          style={styles.shadowSm}
        >
          <Ionicons name="notifications-outline" size={22} color="#475569" />
          <View className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-danger rounded-full border-2 border-white" />
        </TouchableOpacity>
      </View>

      <View className="px-5 pb-4 z-10">
        <TouchableOpacity
          onPress={() => router.push('/(customer)/(home)/search')}
          activeOpacity={0.8}
          className="flex-row items-center bg-white rounded-2xl px-4 py-3.5 gap-3 border border-gray-100/60"
          style={styles.shadowSoft}
        >
          <Ionicons name="search" size={20} color="#94a3b8" />
          <Text className="text-gray-400 font-medium text-base font-sans flex-1">
            Search anything nearby...
          </Text>
          <View className="p-1.5 bg-primary-50 rounded-lg">
            <Ionicons name="options" size={18} color="#2563eb" />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function PromoBanner() {
  const [active, setActive] = useState(0)

  return (
    <View className="mt-2">
      <Animated.ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 40))
          setActive(index)
        }}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 16 }}
        snapToInterval={SCREEN_WIDTH - 24}
        decelerationRate="fast"
      >
        {BANNERS.map((banner) => (
          <TouchableOpacity
            activeOpacity={0.95}
            key={banner.id}
            style={[
              {
                width: SCREEN_WIDTH - 40,
                height: 180,
                backgroundColor: '#f1f5f9',
                borderRadius: 24,
                overflow: 'hidden',
              },
              styles.shadowHeavy
            ]}
          >
            <Image
              source={{ uri: banner.image }}
              style={{ position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 }}
              contentFit="cover"
            />
            <View className="p-5 flex-1 justify-end h-full">
              <View className="bg-white/20 self-start px-2 py-1 rounded-md mb-2">
                <Text className="text-white text-xs font-semibold uppercase tracking-wider font-sans">Special Offer</Text>
              </View>
              <Text className="text-white text-2xl font-bold font-heading mb-1 shadow-sm">{banner.title}</Text>
              <Text className="text-white/90 text-sm font-medium font-sans">{banner.subtitle}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </Animated.ScrollView>

      {/* Dots */}
      <View className="flex-row justify-center gap-2 mt-4">
        {BANNERS.map((_, i) => (
          <View
            key={i}
            style={{
              width: active === i ? 24 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: active === i ? '#2563eb' : '#cbd5e1',
            }}
          />
        ))}
      </View>
    </View>
  )
}

function IndustryFilter({
  selected,
  onSelect,
}: {
  selected: string
  onSelect: (label: string) => void
}) {
  return (
    <View className="mt-6 mb-2">
      <View className="flex-row items-center justify-between px-5 mb-4">
        <Text className="text-lg font-bold text-gray-900 font-heading">Explore Categories</Text>
        <Text className="text-primary-600 font-semibold text-sm font-sans">See All</Text>
      </View>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
      >
        {INDUSTRIES.map((ind, index) => {
          const isActive = selected === ind.label
          return (
            <Animated.View key={ind.label} entering={FadeInDown.delay(index * 50).springify()}>
              <TouchableOpacity
                onPress={() => onSelect(ind.label)}
                activeOpacity={0.7}
                style={[
                  {
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderRadius: 20,
                    backgroundColor: isActive ? ind.color : '#ffffff',
                    minWidth: 80,
                  },
                  isActive ? getShadowColorStyle(ind.color) : styles.shadowSoft
                ]}
              >
                <View style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : `${ind.color}15`,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Ionicons name={ind.icon as any} size={22} color={isActive ? '#ffffff' : ind.color} />
                </View>
                <Text
                  className="font-sans text-xs"
                  style={{
                    fontWeight: isActive ? '700' : '600',
                    color: isActive ? '#ffffff' : '#475569',
                  }}
                >
                  {ind.label}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )
        })}
      </Animated.ScrollView>
    </View>
  )
}

function StoreCardSkeleton() {
  return (
    <View className="bg-white rounded-[24px] overflow-hidden mb-5 mx-5 border border-gray-100/50" style={styles.shadowSoft}>
      <Skeleton className="w-full h-40" />
      <View className="p-5 gap-3">
        <Skeleton className="h-6 w-3/4 rounded-lg" />
        <Skeleton className="h-4 w-1/2 rounded-md" />
        <View className="flex-row gap-2 mt-2">
          <Skeleton className="h-8 w-1/3 rounded-xl" />
          <Skeleton className="h-8 w-1/4 rounded-xl" />
        </View>
      </View>
    </View>
  )
}

function StoreCard({
  merchant,
  onPress,
  index
}: {
  merchant: any
  onPress: () => void
  index: number
}) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 100).springify()}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.95}
        className="bg-white rounded-[24px] overflow-hidden mb-5 mx-5"
        style={styles.shadowGlass}
      >
        {/* Banner image with gradient overlay */}
        <View style={{ height: 180, backgroundColor: '#f1f5f9' }}>
          <Image
            source={
              merchant.banner_url
                ? { uri: merchant.banner_url }
                : require('../../../assets/placeholder-banner.png')
            }
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
          <View style={[{ position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 }, { backgroundColor: 'rgba(0,0,0,0.1)' }]} />
          <View className="absolute top-4 left-4 right-4 flex-row justify-between items-start">
            <View className="bg-white/90 backdrop-blur-md rounded-full px-3 py-1.5 flex-row items-center gap-1.5" style={styles.shadowSm}>
              <Ionicons name="flash" size={12} color="#f59e0b" />
              <Text className="text-gray-800 text-xs font-bold font-sans">
                {merchant.industry}
              </Text>
            </View>

            {!!merchant.average_rating && (
              <View className="bg-white/90 backdrop-blur-md rounded-full px-2.5 py-1.5 flex-row items-center gap-1" style={styles.shadowSm}>
                <Ionicons name="star" size={14} color="#f59e0b" />
                <Text className="text-gray-900 text-xs font-bold font-sans">
                  {Number(merchant.average_rating).toFixed(1)}
                </Text>
              </View>
            )}
          </View>

          {/* Logo overlaps the banner */}
          <View className="absolute -bottom-6 left-5">
            <View className="bg-white rounded-2xl p-1" style={styles.shadowSoft}>
              <Image
                source={
                  merchant.logo_url
                    ? { uri: merchant.logo_url }
                    : require('../../../assets/placeholder-logo.png')
                }
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                }}
                contentFit="cover"
              />
            </View>
          </View>
        </View>

        {/* Info row */}
        <View className="px-5 pb-5 pt-8">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-xl font-bold text-gray-900 font-heading tracking-tight mb-1">
                {merchant.store_name}
              </Text>

              {/* Location & Delivery info */}
              <View className="flex-row items-center gap-3">
                <View className="flex-row items-center gap-1">
                  <Ionicons name="location" size={14} color="#64748b" />
                  <Text className="text-sm font-medium text-gray-500 font-sans" numberOfLines={1}>
                    {merchant.city}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <Ionicons name="time" size={14} color="#64748b" />
                  <Text className="text-sm font-medium text-gray-500 font-sans">
                    25-35 min
                  </Text>
                </View>
              </View>
            </View>

            <View className="w-10 h-10 rounded-full bg-primary-50 items-center justify-center">
              <Ionicons name="arrow-forward" size={18} color="#2563eb" />
            </View>
          </View>

          {/* Min order strip */}
          {merchant.min_order_amount > 0 && (
            <View className="mt-4 flex-row items-center gap-2">
              <View className="px-3 py-1.5 bg-green-50 rounded-lg flex-row items-center gap-1.5">
                <Ionicons name="basket" size={14} color="#10b981" />
                <Text className="text-xs text-green-700 font-bold font-sans tracking-wide">
                  MIN RM {merchant.min_order_amount}
                </Text>
              </View>
              <View className="px-3 py-1.5 bg-gray-50 rounded-lg flex-row items-center gap-1.5">
                <Ionicons name="car" size={14} color="#64748b" />
                <Text className="text-xs text-gray-600 font-bold font-sans tracking-wide">
                  PROMO
                </Text>
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

function EmptyStores({ industry }: { industry: string }) {
  return (
    <Animated.View entering={FadeInDown.springify()} className="items-center py-20 px-8">
      <View className="w-24 h-24 bg-gray-100 rounded-full items-center justify-center mb-6">
        <Ionicons name="storefront-outline" size={48} color="#94a3b8" />
      </View>
      <Text className="text-xl font-bold text-gray-800 font-heading text-center mb-2">
        Nothing found here
      </Text>
      <Text className="text-gray-500 text-base text-center font-sans tracking-tight leading-relaxed">
        We couldn't find any {industry !== 'All' ? industry : ''} stores matching your criteria right now.
      </Text>
    </Animated.View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { profile } = useAuthStore()
  const [selectedIndustry, setSelectedIndustry] = useState('All')
  const scrollY = useSharedValue(0)

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  const {
    data: merchants = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['merchants'],
    queryFn: () => merchantsService.getAll(),
  })

  const filtered =
    selectedIndustry === 'All'
      ? merchants
      : merchants.filter((m) => m.industry === selectedIndustry)

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y
    },
  })

  return (
    <View className="flex-1 bg-[#f8fafc]">
      {/* Animated Fixed Header */}
      <AnimatedHeader scrollY={scrollY} name={firstName} />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#2563eb"
            progressViewOffset={140} // So it shows below the big header
          />
        }
        contentContainerStyle={{ paddingBottom: 100, paddingTop: 180 }}
      >
        <View>
          {/* Promo banners */}
          <PromoBanner />

          {/* Industry filter */}
          <IndustryFilter
            selected={selectedIndustry}
            onSelect={setSelectedIndustry}
          />

          {/* Section title */}
          <View className="flex-row items-center justify-between px-5 mt-4 mb-4">
            <Text className="text-xl font-bold text-gray-900 font-heading tracking-tight">
              {selectedIndustry === 'All' ? 'Popular Near You' : selectedIndustry}
            </Text>
          </View>

          {/* Store list */}
          {isLoading ? (
            <>
              <StoreCardSkeleton />
              <StoreCardSkeleton />
              <StoreCardSkeleton />
            </>
          ) : filtered.length === 0 ? (
            <EmptyStores industry={selectedIndustry} />
          ) : (
            filtered.map((merchant, index) => (
              <StoreCard
                key={merchant.id}
                merchant={merchant}
                index={index}
                onPress={() =>
                  router.push(`/(customer)/(store)/${merchant.store_slug}`)
                }
              />
            ))
          )}
        </View>
      </Animated.ScrollView>
    </View>
  )
}

const getShadowColorStyle = (color: string) => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.25,
  shadowRadius: 12,
  elevation: 4,
})

const styles = StyleSheet.create({
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  shadowGlass: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 4,
  },
  shadowSoft: {
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  shadowSm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  shadowHeavy: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 5,
  },
})
