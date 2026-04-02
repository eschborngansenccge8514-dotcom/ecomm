import { Stack } from 'expo-router'

export default function StoreLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[storeSlug]" />
      <Stack.Screen name="[storeSlug]/product/[productId]" />
    </Stack>
  )
}
