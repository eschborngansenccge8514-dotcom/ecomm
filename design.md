<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# The customer screens are empty. Start with bottom navigation bar and home screen.

Here is every file you need to copy in, in exact order. Each file is complete — no placeholders, no `// TODO`.

***

## File 1 — Custom Tab Bar Component

Create `src/components/ui/TabBar.tsx`:

```typescript
import { View, Text, TouchableOpacity, Platform } from 'react-native'
import { useLinkBuilder, useTheme } from '@react-navigation/native'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated'
import { useCartStore } from '@/stores/cartStore'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Map each route name to its icons
const TAB_ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap; label: string }> = {
  '(home)':    { active: 'home',           inactive: 'home-outline',           label: 'Home'    },
  '(cart)':    { active: 'bag',            inactive: 'bag-outline',             label: 'Cart'    },
  '(orders)':  { active: 'receipt',        inactive: 'receipt-outline',         label: 'Orders'  },
  '(profile)': { active: 'person-circle',  inactive: 'person-circle-outline',   label: 'Profile' },
}

function TabItem({
  route,
  isFocused,
  onPress,
  onLongPress,
}: {
  route: any
  isFocused: boolean
  onPress: () => void
  onLongPress: () => void
}) {
  const icons = TAB_ICONS[route.name]
  const cartCount = useCartStore(s => s.getItemCount())
  const isCart = route.name === '(cart)'

  const scale = useSharedValue(1)

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const dotOpacity = useAnimatedStyle(() => ({
    opacity: withSpring(isFocused ? 1 : 0),
    transform: [
      {
        scaleX: withSpring(isFocused ? 1 : 0, { damping: 14, stiffness: 180 }),
      },
    ],
  }))

  if (!icons) return null

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      onPress={() => {
        scale.value = withSpring(0.85, {}, () => {
          scale.value = withSpring(1)
        })
        onPress()
      }}
      onLongPress={onLongPress}
      style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}
      activeOpacity={0.8}
    >
      <Animated.View style={[animStyle, { alignItems: 'center' }]}>
        {/* Icon container */}
        <View style={{ position: 'relative' }}>
          <Ionicons
            name={isFocused ? icons.active : icons.inactive}
            size={24}
            color={isFocused ? '#2563eb' : '#9ca3af'}
          />
          {/* Cart badge */}
          {isCart && cartCount > 0 && (
            <View
              style={{
                position: 'absolute',
                top: -5,
                right: -8,
                backgroundColor: '#ef4444',
                borderRadius: 10,
                minWidth: 18,
                height: 18,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 3,
                borderWidth: 1.5,
                borderColor: '#fff',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                {cartCount > 99 ? '99+' : cartCount}
              </Text>
            </View>
          )}
        </View>

        {/* Label */}
        <Text
          style={{
            fontSize: 11,
            marginTop: 3,
            fontWeight: isFocused ? '600' : '400',
            color: isFocused ? '#2563eb' : '#9ca3af',
          }}
        >
          {icons.label}
        </Text>

        {/* Active dot indicator */}
        <Animated.View
          style={[
            dotOpacity,
            {
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: '#2563eb',
              marginTop: 3,
            },
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
  )
}

export function TabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets()
  const { buildHref } = useLinkBuilder()

  // Filter out hidden routes (those with href: null)
  const visibleRoutes = state.routes.filter(
    (route: any) => descriptors[route.key].options.href !== null
  )

  const Container = Platform.OS === 'ios' ? BlurView : View

  const containerProps =
    Platform.OS === 'ios'
      ? { intensity: 80, tint: 'systemChromeMaterial' as const }
      : {}

  return (
    <Container
      {...containerProps}
      style={{
        flexDirection: 'row',
        borderTopWidth: 0.5,
        borderTopColor: '#e5e7eb',
        backgroundColor: Platform.OS === 'android' ? '#ffffff' : undefined,
        paddingBottom: insets.bottom,
      }}
    >
      {visibleRoutes.map((route: any) => {
        const isFocused = state.index === state.routes.indexOf(route)

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          })
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params)
          }
        }

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key })
        }

        return (
          <TabItem
            key={route.key}
            route={route}
            isFocused={isFocused}
            onPress={onPress}
            onLongPress={onLongPress}
          />
        )
      })}
    </Container>
  )
}
```


***

## File 2 — Customer Layout with the Custom Tab Bar

Replace `app/(customer)/_layout.tsx` completely:

```typescript
import { Redirect } from 'expo-router'
import { Tabs } from 'expo-router'
import { useAuthStore } from '@/stores/authStore'
import { TabBar } from '@/components/ui/TabBar'

export default function CustomerLayout() {
  const { session, profile } = useAuthStore()

  if (!session)                     return <Redirect href="/(auth)/welcome" />
  if (profile?.role === 'merchant') return <Redirect href="/(merchant)/dashboard" />

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="(home)"    />
      <Tabs.Screen name="(cart)"    />
      <Tabs.Screen name="(orders)"  />
      <Tabs.Screen name="(profile)" />

      {/* Hidden from tab bar */}
      <Tabs.Screen name="(store)"   options={{ href: null }} />
    </Tabs>
  )
}
```


***

## File 3 — Home Stack Layout

Create `app/(customer)/(home)/_layout.tsx`:

```typescript
import { Stack } from 'expo-router'

export default function HomeStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index"  />
      <Stack.Screen name="search" options={{ animation: 'fade' }} />
    </Stack>
  )
}
```


***

## File 4 — The Full Home Screen

Replace `app/(customer)/(home)/index.tsx` completely:

```typescript
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Dimensions,
  ImageBackground,
  Platform,
} from 'react-native'
import { router } from 'expo-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { merchantsService } from '@/services/merchants.service'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

// ─── Types ────────────────────────────────────────────────────────────────────
type Industry = {
  label: string
  emoji: string
  color: string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const INDUSTRIES: Industry[] = [
  { label: 'All',          emoji: '🏪', color: '#2563eb' },
  { label: 'Food & Beverage', emoji: '🍜', color: '#ea580c' },
  { label: 'Grocery',      emoji: '🥦', color: '#16a34a' },
  { label: 'Pharmacy',     emoji: '💊', color: '#dc2626' },
  { label: 'Retail',       emoji: '👜', color: '#7c3aed' },
  { label: 'Fashion',      emoji: '👗', color: '#db2777' },
  { label: 'Electronics',  emoji: '📱', color: '#0284c7' },
  { label: 'Beauty',       emoji: '💄', color: '#e11d48' },
]

const BANNERS = [
  {
    id: '1',
    title: 'Free Delivery\nThis Weekend',
    subtitle: 'On all orders above RM 30',
    bg: '#1e3a8a',
    accent: '#3b82f6',
  },
  {
    id: '2',
    title: 'New Stores\nJust Joined',
    subtitle: 'Discover what\'s new near you',
    bg: '#14532d',
    accent: '#22c55e',
  },
  {
    id: '3',
    title: 'Refer & Earn\nRM 10 Credit',
    subtitle: 'Invite friends to Hyperlocal',
    bg: '#4c1d95',
    accent: '#a855f7',
  },
]

// ─── Sub-components ────────────────────────────────────────────────────────────

function Header({ name }: { name: string }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={{ paddingTop: insets.top + 8 }} className="px-5 pb-4 bg-white">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-gray-500 text-sm">Good day,</Text>
          <Text className="text-2xl font-bold text-gray-900">
            {name} 👋
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(customer)/(profile)')}
          className="w-10 h-10 rounded-full bg-primary-50 items-center justify-center"
        >
          <Ionicons name="notifications-outline" size={20} color="#2563eb" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

function SearchBar() {
  return (
    <TouchableOpacity
      onPress={() => router.push('/(customer)/(home)/search')}
      activeOpacity={0.8}
      className="mx-5 mt-3 mb-1 flex-row items-center bg-gray-100 rounded-2xl px-4 py-3.5 gap-3"
    >
      <Ionicons name="search-outline" size={18} color="#9ca3af" />
      <Text className="text-gray-400 text-sm flex-1">
        Search stores, products...
      </Text>
      <View className="bg-primary-500 rounded-lg px-2 py-1">
        <Text className="text-white text-xs font-semibold">Search</Text>
      </View>
    </TouchableOpacity>
  )
}

function PromoBanner() {
  const [active, setActive] = useState(0)

  return (
    <View className="mt-4">
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 40))
          setActive(index)
        }}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
        snapToInterval={SCREEN_WIDTH - 28}
        decelerationRate="fast"
      >
        {BANNERS.map((banner) => (
          <View
            key={banner.id}
            style={{
              width: SCREEN_WIDTH - 48,
              height: 130,
              borderRadius: 20,
              backgroundColor: banner.bg,
              padding: 20,
              overflow: 'hidden',
              justifyContent: 'flex-end',
            }}
          >
            {/* Decorative circle */}
            <View
              style={{
                position: 'absolute',
                top: -30,
                right: -30,
                width: 130,
                height: 130,
                borderRadius: 65,
                backgroundColor: banner.accent,
                opacity: 0.25,
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: 20,
                right: 20,
                width: 70,
                height: 70,
                borderRadius: 35,
                backgroundColor: banner.accent,
                opacity: 0.15,
              }}
            />
            <Text className="text-white/70 text-xs mb-1">{banner.subtitle}</Text>
            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '800', lineHeight: 24 }}>
              {banner.title}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Dots */}
      <View className="flex-row justify-center gap-1.5 mt-3">
        {BANNERS.map((_, i) => (
          <View
            key={i}
            style={{
              width: active === i ? 20 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: active === i ? '#2563eb' : '#d1d5db',
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
    <View className="mt-5">
      <View className="flex-row items-center justify-between px-5 mb-3">
        <Text className="text-base font-bold text-gray-900">Categories</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
      >
        {INDUSTRIES.map((ind) => {
          const isActive = selected === ind.label
          return (
            <TouchableOpacity
              key={ind.label}
              onPress={() => onSelect(ind.label)}
              activeOpacity={0.75}
              style={{
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 16,
                backgroundColor: isActive ? ind.color : '#f3f4f6',
                borderWidth: isActive ? 0 : 1,
                borderColor: '#e5e7eb',
                minWidth: 70,
              }}
            >
              <Text style={{ fontSize: 22 }}>{ind.emoji}</Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: isActive ? '700' : '500',
                  color: isActive ? '#ffffff' : '#6b7280',
                }}
              >
                {ind.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
}

function StoreCardSkeleton() {
  return (
    <View className="bg-white rounded-2xl overflow-hidden mb-4 mx-5">
      <Skeleton className="w-full h-36" />
      <View className="p-4 gap-2">
        <Skeleton className="h-5 w-3/4 rounded-lg" />
        <Skeleton className="h-4 w-1/2 rounded-lg" />
        <Skeleton className="h-4 w-1/3 rounded-lg" />
      </View>
    </View>
  )
}

function StoreCard({
  merchant,
  onPress,
}: {
  merchant: any
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      className="bg-white rounded-2xl overflow-hidden mb-4 mx-5"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 3,
      }}
    >
      {/* Banner image */}
      <View style={{ height: 120, backgroundColor: '#e5e7eb' }}>
        <Image
          source={
            merchant.banner_url
              ? { uri: merchant.banner_url }
              : require('../../../../assets/placeholder-banner.png')
          }
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
        />
        {/* Industry chip */}
        <View
          className="absolute top-3 left-3 bg-black/40 rounded-full px-2.5 py-1"
        >
          <Text className="text-white text-xs font-semibold">
            {merchant.industry}
          </Text>
        </View>
      </View>

      {/* Info row */}
      <View className="px-4 py-3 flex-row items-center gap-3">
        {/* Logo */}
        <Image
          source={
            merchant.logo_url
              ? { uri: merchant.logo_url }
              : require('../../../../assets/placeholder-logo.png')
          }
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: '#f3f4f6',
          }}
          contentFit="cover"
        />

        {/* Details */}
        <View className="flex-1">
          <Text
            className="text-base font-bold text-gray-900"
            numberOfLines={1}
          >
            {merchant.store_name}
          </Text>

          {/* Rating & reviews */}
          <View className="flex-row items-center gap-1 mt-0.5">
            {merchant.average_rating ? (
              <>
                <Ionicons name="star" size={12} color="#f59e0b" />
                <Text className="text-xs font-semibold text-gray-700">
                  {Number(merchant.average_rating).toFixed(1)}
                </Text>
                <Text className="text-xs text-gray-400">
                  ({merchant.review_count ?? 0} reviews)
                </Text>
              </>
            ) : (
              <Text className="text-xs text-gray-400 italic">New store</Text>
            )}
          </View>

          {/* Location */}
          <View className="flex-row items-center gap-1 mt-0.5">
            <Ionicons name="location-outline" size={11} color="#9ca3af" />
            <Text className="text-xs text-gray-400" numberOfLines={1}>
              {merchant.city}, {merchant.state}
            </Text>
          </View>
        </View>

        {/* Arrow */}
        <View className="w-8 h-8 rounded-full bg-gray-50 items-center justify-center">
          <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
        </View>
      </View>

      {/* Min order strip (if applicable) */}
      {merchant.min_order_amount > 0 && (
        <View className="mx-4 mb-3 px-3 py-1.5 bg-primary-50 rounded-xl flex-row items-center gap-1">
          <Ionicons name="bag-outline" size={12} color="#2563eb" />
          <Text className="text-xs text-primary-700 font-medium">
            Min. order {formatCurrency(merchant.min_order_amount)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

function EmptyStores({ industry }: { industry: string }) {
  return (
    <View className="items-center py-16 px-8">
      <Text className="text-5xl mb-4">🏪</Text>
      <Text className="text-lg font-bold text-gray-700 text-center">
        No stores yet
        {industry !== 'All' ? ` in ${industry}` : ''}
      </Text>
      <Text className="text-gray-400 text-sm text-center mt-2">
        We're growing fast. Check back soon or explore other categories.
      </Text>
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { profile } = useAuthStore()
  const [selectedIndustry, setSelectedIndustry] = useState('All')

  const firstName = profile?.full_name?.split(' ')[^0] ?? 'there'

  const {
    data: merchants = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['merchants'],
    queryFn:  () => merchantsService.getAll(),
  })

  const filtered =
    selectedIndustry === 'All'
      ? merchants
      : merchants.filter((m) => m.industry === selectedIndustry)

  return (
    <View className="flex-1 bg-gray-50">
      {/* Fixed header above scroll */}
      <View className="bg-white">
        <Header name={firstName} />
        <SearchBar />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#2563eb"
          />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Promo banners */}
        <PromoBanner />

        {/* Industry filter */}
        <IndustryFilter
          selected={selectedIndustry}
          onSelect={setSelectedIndustry}
        />

        {/* Section title */}
        <View className="flex-row items-center justify-between px-5 mt-6 mb-3">
          <Text className="text-base font-bold text-gray-900">
            {selectedIndustry === 'All' ? 'All Stores' : selectedIndustry}
          </Text>
          <Text className="text-sm text-gray-400">
            {isLoading ? '...' : `${filtered.length} stores`}
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
          filtered.map((merchant) => (
            <StoreCard
              key={merchant.id}
              merchant={merchant}
              onPress={() =>
                router.push(`/(customer)/(store)/${merchant.store_slug}`)
              }
            />
          ))
        )}
      </ScrollView>
    </View>
  )
}
```


***

## File 5 — Placeholder Images (required by imports above)

Create these two PNG files inside `assets/`. They are just solid-color fallback images. Run this in your terminal:

```bash
# Install sharp-cli to generate placeholder images
npx react-native-asset
```

Or manually create two solid-colour PNG files:

- `assets/placeholder-banner.png` — any 400×150 grey image
- `assets/placeholder-logo.png`   — any 100×100 grey image

You can download free placeholder images from [placeholder.com](https://placeholder.com) and save them with those exact filenames.

***

## File 6 — Fix the `(home)` Stack to pass correctly into tabs

Update the `app/(customer)/(home)/_layout.tsx` (if you haven't made it yet):

```typescript
import { Stack } from 'expo-router'

export default function HomeStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="search"
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack>
  )
}
```


***

## Run \& Verify

```bash
npx expo start
# Press 'w' for web, or scan QR with Expo Go
```

**What you should now see:**


| Element | Expected result |
| :-- | :-- |
| Bottom nav bar | 4 tabs: Home, Cart, Orders, Profile — iOS has blur background, Android is white |
| Active tab | Blue icon + label + small animated dot below |
| Cart badge | Red bubble appears on Cart tab when items are in cart |
| Home header | Greeting with first name + notification bell |
| Search bar | Tappable bar, navigates to search screen on press |
| Promo banners | 3 horizontally scrollable gradient cards with dot indicators |
| Category chips | Scrollable row with emoji + label, tap to filter |
| Store list | Skeletons while loading, then real data from Supabase |
| Pull to refresh | Spinner refreshes the store list |
| Empty state | Friendly message when no stores exist yet |

The tab bar uses `BlurView` on iOS for the frosted glass effect  and a plain white background on Android. The cart badge is driven directly by `cartStore` so it updates instantly when items are added.[^1][^2]
<span style="display:none">[^10][^11][^12][^13][^14][^15][^3][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://docs.expo.dev/router/advanced/custom-tabs/

[^2]: https://galaxies.dev/quickwin/expo-router-tabs-navigation

[^3]: https://www.youtube.com/watch?v=0Oprz4eNXMc

[^4]: https://docs.expo.dev/router/advanced/tabs/

[^5]: https://github.com/nativewind/nativewind/issues/682

[^6]: https://www.youtube.com/watch?v=bf_51bI6EXU

[^7]: https://www.reddit.com/r/expo/comments/12mmk0w/tabs_customization_from_expo_router/

[^8]: https://github.com/expo/router/discussions/892

[^9]: https://www.youtube.com/watch?v=K6OJP0s5VDQ

[^10]: https://www.youtube.com/watch?v=GrLCS5ww030

[^11]: https://www.youtube.com/watch?v=CN4x8srCMl0

[^12]: https://docs.expo.dev/tutorial/add-navigation/

[^13]: https://github.com/keith-kurak/expo-router-london-2024-lessons/blob/main/03-headless-tabs-and-responsiveness.md

[^14]: https://reactnavigation.org/docs/customizing-tabbar/

[^15]: https://www.youtube.com/watch?v=QqNZXdGFl44\&vl=en

