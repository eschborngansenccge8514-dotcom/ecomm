import { Text, ActivityIndicator, Pressable, View } from 'react-native'
import { cn } from '@/lib/utils'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

interface ButtonProps {
  children: React.ReactNode
  onPress:  () => void
  variant?: 'primary' | 'outline' | 'ghost' | 'danger' | 'secondary'
  size?:    'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  className?: string
}

const variants = {
  primary: 'bg-primary-600 border-transparent',
  secondary: 'bg-gray-100 border-transparent',
  outline: 'border-gray-200 bg-white',
  ghost:   'bg-transparent border-transparent',
  danger:  'bg-red-500 border-transparent',
}

const textColors = {
  primary: 'text-white',
  secondary: 'text-gray-900',
  outline: 'text-gray-700',
  ghost:   'text-gray-600',
  danger:  'text-white',
}

const sizes = {
  sm: 'py-2 px-4 rounded-xl',
  md: 'py-3.5 px-6 rounded-2xl',
  lg: 'py-4 px-8 rounded-[20px]',
}

export function Button({
  children, onPress, variant = 'primary', size = 'md',
  loading = false, disabled = false, className,
}: ButtonProps) {
  const scale = useSharedValue(1)
  const opacity = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    }
  })

  // Reanimated Spring Configuration for a premium soft bounce
  const springConfig = {
    damping: 15,
    stiffness: 300,
    mass: 1,
  }

  const handlePressIn = () => {
    if (disabled || loading) return
    scale.value = withSpring(0.96, springConfig)
    opacity.value = withTiming(0.9, { duration: 100 })
  }

  const handlePressOut = () => {
    if (disabled || loading) return
    scale.value = withSpring(1, springConfig)
    opacity.value = withTiming(1, { duration: 150 })
  }

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={{
          borderWidth: 1.5,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          borderRadius: size === 'sm' ? 12 : size === 'md' ? 16 : 20,
          backgroundColor: variant === 'primary' ? '#2563eb' : variant === 'danger' ? '#ef4444' : variant === 'secondary' ? '#f1f5f9' : '#fff',
          borderColor: variant === 'outline' ? '#e2e8f0' : 'transparent',
          paddingVertical: size === 'sm' ? 8 : size === 'md' ? 14 : 16,
          paddingHorizontal: size === 'sm' ? 16 : size === 'md' ? 24 : 32,
          opacity: (disabled || loading) ? 0.6 : 1,
        }}
      >
        {loading && <ActivityIndicator size="small" color={variant === 'primary' || variant === 'danger' ? '#fff' : '#2563eb'} />}
        <Text className={cn('font-bold font-sans tracking-wide', textColors[variant], size === 'sm' ? 'text-sm' : 'text-base')}>
          {children}
        </Text>
      </Pressable>
    </Animated.View>
  )
}
