import { View, ActivityIndicator } from 'react-native'
import { Redirect } from 'expo-router'
import { Tabs } from 'expo-router'
import { useAuthStore } from '@/stores/authStore'
import { TabBar } from '@/components/ui/TabBar'

export default function CustomerLayout() {
  const { session, profile, isInitialized } = useAuthStore()

  // Don't redirect while auth is still being restored (e.g. returning from WebView payment)
  if (!isInitialized) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

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
      <Tabs.Screen name="support"   options={{ href: null }} />
    </Tabs>
  )
}
