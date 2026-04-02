import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string
  icon:  keyof typeof Ionicons.glyphMap
  color: 'green' | 'blue' | 'orange' | 'purple'
}

const colorMap = {
  green:  { bg: 'bg-green-50', icon: '#10b981', text: 'text-green-700' },
  blue:   { bg: 'bg-blue-50',  icon: '#3b82f6', text: 'text-blue-700' },
  orange: { bg: 'bg-orange-50',icon: '#f59e0b', text: 'text-orange-700' },
  purple: { bg: 'bg-purple-50',icon: '#8b5cf6', text: 'text-purple-700' },
}

export function StatCard({ label, value, icon, color }: StatCardProps) {
  const styles = colorMap[color]

  return (
    <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      <View className={cn('w-10 h-10 rounded-xl items-center justify-center mb-3', styles.bg)}>
        <Ionicons name={icon} size={20} color={styles.icon} />
      </View>
      <Text className="text-gray-500 text-xs font-semibold mb-1 uppercase tracking-wider">{label}</Text>
      <Text className="text-gray-900 text-lg font-bold" numberOfLines={1}>{value}</Text>
    </View>
  )
}
