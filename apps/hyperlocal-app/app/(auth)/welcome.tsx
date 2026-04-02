import { View, Text, Image } from 'react-native'
import { router } from 'expo-router'
import { Button } from '@/components/ui/Button'

export default function WelcomeScreen() {
  return (
    <View className="flex-1 bg-white items-center justify-end px-6 pb-12">
      <View className="mb-8 w-80 h-80 bg-primary-100 rounded-full items-center justify-center">
        <Text className="text-8xl">🛍️</Text>
      </View>
      <Text className="text-3xl font-bold text-gray-900 text-center mb-2">
        Shop Local, Delivered Fast
      </Text>
      <Text className="text-gray-500 text-center mb-10 text-base">
        Discover stores near you and get what you need today.
      </Text>
      <Button onPress={() => router.push('/(auth)/register')} className="w-full mb-3">
        Get Started
      </Button>
      <Button
        variant="outline"
        onPress={() => router.push('/(auth)/login')}
        className="w-full"
      >
        I already have an account
      </Button>
    </View>
  )
}
