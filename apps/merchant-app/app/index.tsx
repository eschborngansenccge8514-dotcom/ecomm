import { View, ActivityIndicator } from 'react-native'
import { Redirect } from 'expo-router'
import { useAuthStore } from '@/stores/authStore'

export default function Index() {
  const { session, profile, isInitialized } = useAuthStore()

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  // Not logged in → auth flow
  if (!session) return <Redirect href="/(auth)/welcome" />

  // Wait for profile if session exists
  if (session && !profile) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  // Logged in: only merchants can use this app
  if (profile?.role === 'merchant') return <Redirect href="/(tabs)/pos" />
  
  // For others, redirect to a "Not a Merchant" screen or welcome (safe if we fix AuthLayout)
  return <Redirect href="/(auth)/welcome" />
}
