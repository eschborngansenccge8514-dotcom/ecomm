import { View, ActivityIndicator } from 'react-native'
import { Redirect } from 'expo-router'
import { useAuthStore } from '@/stores/authStore'

export default function Index() {
  const { session, profile, isInitialized } = useAuthStore()

  // Wait until auth state is fully restored before making any routing decision.
  // Without this guard, returning from a WebView briefly shows session=null,
  // which fires a redirect to /(auth)/welcome — appearing as "Login Failed".
  if (!isInitialized) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  // Not logged in → show auth screens
  if (!session) return <Redirect href="/(auth)/welcome" />

  // Logged in: route by role
  if (profile?.role === 'merchant') return <Redirect href="/(merchant)/dashboard" />
  if (profile?.role === 'admin')    return <Redirect href="/(admin)/merchants" />
  return <Redirect href="/(customer)/(home)" />
}
