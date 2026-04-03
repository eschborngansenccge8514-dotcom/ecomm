import { Tabs, Redirect, usePathname } from 'expo-router'
import { View, Text } from 'react-native'
import { useEffect, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'

function OrdersBadge({ merchantId }: { merchantId: string }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    // Initial fetch
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .eq('status', 'paid')
      .then(({ count: c }) => setCount(c ?? 0))

    // Realtime: new paid orders come in
    const channel = supabase
      .channel(`merchant-orders-badge-${merchantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `merchant_id=eq.${merchantId}` },
        () => {
          supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('merchant_id', merchantId)
            .eq('status', 'paid')
            .then(({ count: c }) => setCount(c ?? 0))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [merchantId])

  if (count === 0) return null
  return (
    <View
      style={{
        position: 'absolute', top: -4, right: -8,
        backgroundColor: '#ef4444', borderRadius: 10,
        minWidth: 18, height: 18, alignItems: 'center',
        justifyContent: 'center', paddingHorizontal: 3,
        borderWidth: 1.5, borderColor: '#fff',
      }}
    >
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
        {count > 9 ? '9+' : count}
      </Text>
    </View>
  )
}

export default function MerchantLayout() {
  const { session, profile, merchant, isInitialized } = useAuthStore()
  const pathname = usePathname()

  if (!isInitialized) return null   // wait — don't redirect while restoring session

  if (!session)                     return <Redirect href="/(auth)/welcome" />
  if (profile?.role !== 'merchant') return <Redirect href="/(customer)/(home)" />

  if (!merchant && pathname !== '/onboarding' && !pathname.includes('onboarding')) {
    return <Redirect href="/(merchant)/onboarding" />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown:          false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          borderTopColor: '#f3f4f6',
          backgroundColor: '#ffffff',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="receipt-outline" size={size} color={color} />
              {merchant?.id && <OrdersBadge merchantId={merchant.id} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="store-settings"
        options={{
          title: 'Store',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="storefront-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Hidden from tab bar */}
      <Tabs.Screen name="onboarding" options={{ href: null }} />
      <Tabs.Screen name="order"      options={{ href: null }} />
      <Tabs.Screen name="product"    options={{ href: null }} />
    </Tabs>
  )
}
