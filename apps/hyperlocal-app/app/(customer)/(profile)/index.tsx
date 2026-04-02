import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '@/stores/authStore'

// ─── Menu item ─────────────────────────────────────────────────────────────────
function MenuItem({
  icon,
  label,
  sublabel,
  onPress,
  danger = false,
  badge,
}: {
  icon:      keyof typeof Ionicons.glyphMap
  label:     string
  sublabel?: string
  onPress:   () => void
  danger?:   boolean
  badge?:    string
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row items-center gap-3 py-3.5 px-4"
    >
      <View
        className={`w-10 h-10 rounded-xl items-center justify-center
          ${danger ? 'bg-red-50' : 'bg-gray-100'}`}
      >
        <Ionicons name={icon} size={20} color={danger ? '#ef4444' : '#374151'} />
      </View>
      <View className="flex-1">
        <Text
          className={`font-semibold text-sm ${danger ? 'text-red-500' : 'text-gray-900'}`}
        >
          {label}
        </Text>
        {sublabel && (
          <Text className="text-gray-400 text-xs mt-0.5">{sublabel}</Text>
        )}
      </View>
      {badge && (
        <View className="bg-primary-500 rounded-full px-2 py-0.5 mr-1">
          <Text className="text-white text-[10px] font-bold">{badge}</Text>
        </View>
      )}
      {!danger && (
        <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
      )}
    </TouchableOpacity>
  )
}

function MenuGroup({ children }: { children: React.ReactNode }) {
  return (
    <View
      className="bg-white rounded-2xl overflow-hidden mb-3"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
    >
      {children}
    </View>
  )
}

function Separator() {
  return <View className="h-px bg-gray-50 mx-4" />
}

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const { profile, signOut } = useAuthStore()

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: signOut,
      },
    ])
  }

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View className="bg-white px-5 pt-4 pb-5 mb-3">
          <Text className="text-2xl font-bold text-gray-900 mb-4">Profile</Text>

          {/* Avatar + name card */}
          <View className="flex-row items-center gap-4">
            <View style={{ position: 'relative' }}>
              <Image
                source={
                  profile?.avatar_url
                    ? { uri: profile.avatar_url }
                    : require('../../../assets/placeholder-logo.png')
                }
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  borderWidth: 3,
                  borderColor: '#dbeafe',
                }}
                contentFit="cover"
              />
              <TouchableOpacity
                onPress={() => router.push('/(customer)/(profile)/edit')}
                className="absolute bottom-0 right-0 bg-primary-500 w-6 h-6 rounded-full items-center justify-center"
                style={{ borderWidth: 2, borderColor: '#fff' }}
              >
                <Ionicons name="pencil" size={10} color="#fff" />
              </TouchableOpacity>
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-gray-900">
                {profile?.full_name ?? 'Your Name'}
              </Text>
              <Text className="text-gray-400 text-sm" numberOfLines={1}>
                {profile?.phone ?? 'Add phone number'}
              </Text>
              <View className="flex-row items-center gap-1 mt-1">
                <View className="w-2 h-2 rounded-full bg-green-500" />
                <Text className="text-green-600 text-xs font-medium">Active account</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(customer)/(profile)/edit')}
              className="bg-primary-50 rounded-xl px-3 py-2"
            >
              <Text className="text-primary-600 text-sm font-semibold">Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Account group */}
        <View className="px-4">
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
            Account
          </Text>
          <MenuGroup>
            <MenuItem
              icon="person-outline"
              label="Edit Profile"
              sublabel="Name, phone, avatar"
              onPress={() => router.push('/(customer)/(profile)/edit')}
            />
            <Separator />
            <MenuItem
              icon="location-outline"
              label="Saved Addresses"
              sublabel="Manage delivery addresses"
              onPress={() => router.push('/(customer)/(profile)/addresses')}
            />
            <Separator />
            <MenuItem
              icon="notifications-outline"
              label="Notifications"
              sublabel="Push, email preferences"
              onPress={() => {}}
            />
          </MenuGroup>

          {/* Orders group */}
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1 mt-2">
            Shopping
          </Text>
          <MenuGroup>
            <MenuItem
              icon="receipt-outline"
              label="Order History"
              sublabel="View all past orders"
              onPress={() => router.push('/(customer)/(orders)')}
            />
            <Separator />
            <MenuItem
              icon="star-outline"
              label="My Reviews"
              sublabel="Reviews you've written"
              onPress={() => {}}
            />
            <Separator />
            <MenuItem
              icon="pricetag-outline"
              label="Promo Codes"
              sublabel="Enter or view your codes"
              onPress={() => {}}
            />
          </MenuGroup>

          {/* Support group */}
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1 mt-2">
            Support
          </Text>
          <MenuGroup>
            <MenuItem
              icon="help-circle-outline"
              label="Help Center"
              onPress={() => {}}
            />
            <Separator />
            <MenuItem
              icon="chatbubble-outline"
              label="Contact Us"
              onPress={() => {}}
            />
            <Separator />
            <MenuItem
              icon="shield-outline"
              label="Privacy Policy"
              onPress={() => {}}
            />
            <Separator />
            <MenuItem
              icon="document-text-outline"
              label="Terms of Service"
              onPress={() => {}}
            />
          </MenuGroup>

          {/* Sign out */}
          <MenuGroup>
            <MenuItem
              icon="log-out-outline"
              label="Sign Out"
              danger
              onPress={handleSignOut}
            />
          </MenuGroup>

          {/* App version */}
          <Text className="text-center text-gray-300 text-xs mt-2">
            Hyperlocal v1.0.0
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}
