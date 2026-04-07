import { View, Text, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'

export default function PlaceholderScreen() {
  return (
    <View className="flex-1 items-center justify-center p-8 bg-white">
      <Text className="text-4xl mb-4">🚧</Text>
      <Text className="text-2xl font-bold text-gray-900 text-center">Under Construction</Text>
      <Text className="text-gray-500 text-center mt-2 mb-8">This screen is coming soon in Phase 5.</Text>
      <TouchableOpacity 
        onPress={() => router.back()} 
        className="px-8 py-3 bg-primary-600 rounded-2xl shadow-md border-b-4 border-primary-700 active:border-b-0 active:mt-1"
      >
        <Text className="text-white font-bold text-base">Go Back</Text>
      </TouchableOpacity>
    </View>
  )
}
