import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Button } from './Button'

interface EmptyStateProps {
  icon:        keyof typeof Ionicons.glyphMap
  title:       string
  description: string
  actionLabel?: string
  onAction?:    () => void
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center p-8 bg-gray-50">
      <View className="bg-white p-6 rounded-full mb-6">
        <Ionicons name={icon} size={64} color="#9ca3af" />
      </View>
      <Text className="text-xl font-bold text-gray-900 text-center mb-2">{title}</Text>
      <Text className="text-gray-500 text-center mb-8 leading-relaxed">{description}</Text>
      {actionLabel && onAction && (
        <Button onPress={onAction} className="w-full">
          {actionLabel}
        </Button>
      )}
    </View>
  )
}
