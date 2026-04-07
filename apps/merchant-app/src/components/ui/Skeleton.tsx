import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { 
  useSharedValue, 
  withRepeat, 
  withSequence, 
  withTiming, 
  useAnimatedStyle,
  Easing
} from 'react-native-reanimated'
import { cn } from '@/lib/utils'

export function Skeleton({ className, style }: { className?: string; style?: any }) {
  const opacity = useSharedValue(0.4)

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1, // infinite
      false
    )
  }, [])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  return (
    <View style={[styles.container, style]} className={cn('rounded-2xl', className)}>
      <Animated.View style={[styles.shimmer, animatedStyle]} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc', // very light base
    overflow: 'hidden',
    position: 'relative',
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#e2e8f0', // soft slate
  }
})
