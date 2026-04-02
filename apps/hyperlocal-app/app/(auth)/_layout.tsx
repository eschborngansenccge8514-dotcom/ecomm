import { Stack } from 'expo-router'
import { useAuthStore } from '@/stores/authStore'
import { Redirect } from 'expo-router'

export default function AuthLayout() {
  const session = useAuthStore(s => s.session)

  // Redirect away from auth screens if already logged in
  if (session) return <Redirect href="/" />

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
    </Stack>
  )
}
