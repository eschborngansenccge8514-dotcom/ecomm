import { View, Text, TouchableOpacity, Platform } from 'react-native'
import { useTheme } from '@react-navigation/native'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Map each route name to its icons
const TAB_ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap; label: string }> = {
  '(home)':       { active: 'home',              inactive: 'home-outline',           label: 'Home'    },
  'chat-history': { active: 'chatbubbles',        inactive: 'chatbubbles-outline',    label: 'Chats'   },
  '(orders)':     { active: 'receipt',            inactive: 'receipt-outline',        label: 'Orders'  },
  '(profile)':    { active: 'person-circle',      inactive: 'person-circle-outline',  label: 'Profile' },
}

function TabItem({
  route,
  isFocused,
  onPress,
  onLongPress,
}: {
  route: any
  isFocused: boolean
  onPress: () => void
  onLongPress: () => void
}) {
  const icons = TAB_ICONS[route.name]

  const scale = useSharedValue(1)

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const dotOpacity = useAnimatedStyle(() => ({
    opacity: withSpring(isFocused ? 1 : 0),
    transform: [
      {
        scaleX: withSpring(isFocused ? 1 : 0, { damping: 14, stiffness: 180 }),
      },
    ],
  }))

  if (!icons) return null

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      onPress={() => {
        scale.value = withSpring(0.85, {}, () => {
          scale.value = withSpring(1)
        })
        onPress()
      }}
      onLongPress={onLongPress}
      style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}
      activeOpacity={0.8}
    >
      <Animated.View style={[animStyle, { alignItems: 'center' }]}>
        {/* Icon container */}
        <View style={{ position: 'relative' }}>
          <Ionicons
            name={isFocused ? icons.active : icons.inactive}
            size={24}
            color={isFocused ? '#2563eb' : '#9ca3af'}
          />
        </View>

        {/* Label */}
        <Text
          style={{
            fontSize: 11,
            marginTop: 3,
            fontWeight: isFocused ? '600' : '400',
            color: isFocused ? '#2563eb' : '#9ca3af',
          }}
        >
          {icons.label}
        </Text>

        {/* Active dot indicator */}
        <Animated.View
          style={[
            dotOpacity,
            {
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: '#2563eb',
              marginTop: 3,
            },
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
  )
}

export function TabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets()

  // Filter out hidden routes (those with href: null)
  const visibleRoutes = state.routes.filter(
    (route: any) => descriptors[route.key].options.href !== null
  )

  const Container = Platform.OS === 'ios' ? BlurView : View

  const containerProps =
    Platform.OS === 'ios'
      ? { intensity: 100, tint: 'light' as const }
      : {}

  return (
    <Container
      {...containerProps}
      style={{
        flexDirection: 'row',
        borderTopWidth: 0.5,
        borderTopColor: '#e5e7eb',
        backgroundColor: '#ffffff',
        paddingBottom: insets.bottom,
      }}
    >
      {visibleRoutes.map((route: any) => {
        const isFocused = state.index === state.routes.indexOf(route)

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          })
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params)
          }
        }

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key })
        }

        return (
          <TabItem
            key={route.key}
            route={route}
            isFocused={isFocused}
            onPress={onPress}
            onLongPress={onLongPress}
          />
        )
      })}
    </Container>
  )
}
