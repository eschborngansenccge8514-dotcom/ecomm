import { View, Text } from 'react-native'
import '../global.css'
import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClientProvider } from '@tanstack/react-query'
import Toast from 'react-native-toast-message'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/stores/authStore'
import { notificationsService } from '@/services/notifications.service'

import { useFonts } from 'expo-font'
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit'

export default function RootLayout() {
  const initialize = useAuthStore(s => s.initialize)
  const isInitialized = useAuthStore(s => s.isInitialized)

  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  })

  useEffect(() => {
    initialize()
  }, [])

  useEffect(() => {
    if (isInitialized) {
      const cleanup = notificationsService.listen()
      return cleanup
    }
  }, [isInitialized])

  console.log('[RootLayout] isInitialized:', isInitialized, 'fontsLoaded:', fontsLoaded)
  
  if (!isInitialized || !fontsLoaded) {
    console.log('[RootLayout] Waiting for initialization or fonts...')
    return null
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(customer)" />
            <Stack.Screen name="(merchant)" />
            <Stack.Screen name="(admin)" />
          </Stack>
          <StatusBar style="auto" />
          <Toast />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
