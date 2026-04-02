import { Stack } from 'expo-router'

export default function CartStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="checkout"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="payment-webview"
        options={{
          animation:           'slide_from_bottom',
          gestureEnabled:      false, // Prevent accidental swipe-dismiss during payment
          presentation:        'fullScreenModal',
        }}
      />
    </Stack>
  )
}
