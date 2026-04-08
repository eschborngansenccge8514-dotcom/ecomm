import { View, Text, TextInput, TextInputProps } from 'react-native'
import { cn } from '@/lib/utils'

interface InputProps extends TextInputProps {
  label?:     string
  error?:     string
  hint?:      string
  className?: string
  containerClassName?: string
}

export function Input({ label, error, hint, className, containerClassName, ...props }: InputProps) {
  return (
    <View className={cn("mb-4", containerClassName)}>
      {label ? <Text className="text-sm font-semibold text-gray-700 mb-1 ml-1">{label}</Text> : null}
      <TextInput
        className={cn(
          'border rounded-2xl px-4 py-4 text-gray-900 text-base bg-white/80',
          error ? 'border-red-400 bg-red-50/50' : 'border-gray-200 focus:border-primary-500',
          className,
        )}
        placeholderTextColor="#94a3b8"
        {...props}
        value={props.value ?? ''}
      />
      {error ? <Text className="text-red-500 text-xs mt-1 ml-1 font-medium">{error}</Text> : null}
      {hint && !error ? <Text className="text-gray-400 text-xs mt-1 ml-1 leading-tight">{hint}</Text> : null}
    </View>
  )
}
