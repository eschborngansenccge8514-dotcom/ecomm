import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import * as ImagePicker from 'expo-image-picker'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { uploadService } from '@/services/upload.service'
import { useAuthStore } from '@/stores/authStore'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import Toast from 'react-native-toast-message'

const schema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  phone:     z.string().min(10, 'Enter a valid Malaysian phone number').optional().or(z.literal('')),
})

type FormData = z.infer<typeof schema>

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets()
  const { user, profile, refreshProfile } = useAuthStore()
  const [isSaving, setIsSaving]   = useState(false)
  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url ?? null)

  const { control, handleSubmit, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: profile?.full_name ?? '',
      phone:     profile?.phone ?? '',
    },
  })

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow access to photos to change your avatar.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri)
    }
  }

  const onSubmit = async (data: FormData) => {
    setIsSaving(true)
    try {
      let avatarUrl = profile?.avatar_url ?? null

      // Upload new avatar if changed
      if (avatarUri && avatarUri !== profile?.avatar_url) {
        avatarUrl = await uploadService.uploadImage(
          'avatars',
          user!.id,
          avatarUri,
          'avatar.jpg'
        )
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name:  data.full_name,
          phone:      data.phone || null,
          avatar_url: avatarUrl,
        })
        .eq('id', user!.id)

      if (error) throw error

      await refreshProfile()
      Toast.show({ type: 'success', text1: 'Profile updated!' })
      router.back()
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Update failed', text2: err.message })
    }
    setIsSaving(false)
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="bg-white px-5 pt-4 pb-3 flex-row items-center gap-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900 flex-1">Edit Profile</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar picker */}
        <View className="items-center mb-8">
          <View style={{ position: 'relative' }}>
            <Image
              source={
                avatarUri
                  ? { uri: avatarUri }
                  : require('../../../assets/placeholder-logo.png')
              }
              style={{ width: 100, height: 100, borderRadius: 50 }}
              contentFit="cover"
            />
            <TouchableOpacity
              onPress={pickAvatar}
              className="absolute bottom-0 right-0 bg-primary-500 w-9 h-9 rounded-full items-center justify-center"
              style={{ borderWidth: 3, borderColor: '#f9fafb' }}
            >
              <Ionicons name="camera" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text className="text-gray-400 text-xs mt-2">Tap to change photo</Text>
        </View>

        {/* Form */}
        <View
          className="bg-white rounded-2xl p-4"
          style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
        >
          <Controller
            control={control}
            name="full_name"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Full Name"
                placeholder="Ahmad bin Ali"
                value={value}
                onChangeText={onChange}
                error={errors.full_name?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Phone Number"
                placeholder="0123456789"
                keyboardType="phone-pad"
                value={value}
                onChangeText={onChange}
                error={errors.phone?.message}
                hint="Used for delivery notifications"
              />
            )}
          />

          {/* Email (read-only) */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-1">Email</Text>
            <View className="border border-gray-100 rounded-xl px-4 py-3 bg-gray-50 flex-row items-center gap-2">
              <Text className="text-gray-400 flex-1">{user?.email}</Text>
              <View className="bg-green-100 rounded-full px-2 py-0.5">
                <Text className="text-green-700 text-[10px] font-bold">Verified</Text>
              </View>
            </View>
            <Text className="text-gray-400 text-xs mt-1">Email cannot be changed</Text>
          </View>
        </View>

        <Button
          onPress={handleSubmit(onSubmit)}
          loading={isSaving}
          className="mt-5"
        >
          Save Changes
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
