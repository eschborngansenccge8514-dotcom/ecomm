import { View, Text, TextInput, TextInputProps } from 'react-native'
import { cn } from '@/lib/utils'

interface InputProps extends TextInputProps {
  label?:     string
  error?:     string
  hint?:      string
  className?: string
}

export function Input({ label, error, hint, className, ...props }: InputProps) {
  return (
    <View className="mb-4">
      {label && <Text className="text-sm font-semibold text-gray-700 mb-1">{label}</Text>}
      <TextInput
        className={cn(
          'border rounded-xl px-4 py-3 text-gray-900 text-base bg-white',
          error ? 'border-red-400' : 'border-gray-200',
          className,
        )}
        placeholderTextColor="#9ca3af"
        {...props}
        value={props.value ?? ''}
      />
      {error && <Text className="text-red-500 text-xs mt-1">{error}</Text>}
      {hint && !error && <Text className="text-gray-400 text-xs mt-1">{hint}</Text>}
    </View>
  )
}
