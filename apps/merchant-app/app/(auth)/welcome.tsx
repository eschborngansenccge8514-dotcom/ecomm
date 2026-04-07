import { View, Text, Image } from 'react-native'
import { router } from 'expo-router'
import { Button } from '@/components/ui/Button'

export default function WelcomeScreen() {
  return (
    <View className="flex-1 bg-white items-center justify-end px-6 pb-12">
      <View className="mb-8 w-80 h-80 bg-primary-100 rounded-full items-center justify-center">
        <Text className="text-8xl">🚀</Text>
      </View>
      <Text className="text-4xl font-bold text-gray-900 text-center mb-4 leading-tight font-heading">
        Your Shop, Smartly Managed
      </Text>
      <Text className="text-gray-500 text-center mb-12 text-lg font-medium">
        Empower your business with MerchantMind AI and professional POS tools.
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
