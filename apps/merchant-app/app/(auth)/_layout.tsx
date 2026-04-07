import { Stack, router } from 'expo-router'
import { useAuthStore } from '@/stores/authStore'
import { useEffect } from 'react'

export default function AuthLayout() {
  const { session, profile } = useAuthStore()

  useEffect(() => {
    if (session && profile?.role === 'merchant') {
      router.replace('/')
    }
  }, [session, profile?.role])

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
