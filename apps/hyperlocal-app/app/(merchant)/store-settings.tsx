import {
  View, Text, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import * as ImagePicker from 'expo-image-picker'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { merchantsService } from '@/services/merchants.service'
import { uploadService } from '@/services/upload.service'
import { geocodingService } from '@/services/geocoding.service'
import { useAuthStore } from '@/stores/authStore'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import Toast from 'react-native-toast-message'

const schema = z.object({
  store_name:          z.string().min(3),
  description:         z.string().optional(),
  phone:               z.string().min(10),
  email:               z.string().email().optional().or(z.literal('')),
  address_line1:       z.string().min(5),
  city:                z.string().min(2),
  state:               z.string().min(2),
  postcode:            z.string().length(5),
  min_order_amount:    z.number().min(0),
  delivery_radius_km:  z.number().min(0),
})

type FormData = z.infer<typeof schema>

export default function StoreSettingsScreen() {
  const insets = useSafeAreaInsets()
  const { merchant, refreshMerchant } = useAuthStore()
  const [isSaving, setIsSaving]       = useState(false)
  const [logoUri, setLogoUri]         = useState<string | null>(merchant?.logo_url ?? null)
  const [bannerUri, setBannerUri]     = useState<string | null>(merchant?.banner_url ?? null)
  const [newLogo, setNewLogo]         = useState<string | null>(null)
  const [newBanner, setNewBanner]     = useState<string | null>(null)

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      store_name:         merchant?.store_name       ?? '',
      description:        merchant?.description      ?? '',
      phone:              merchant?.phone            ?? '',
      email:              merchant?.email            ?? '',
      address_line1:      merchant?.address_line1    ?? '',
      city:               merchant?.city             ?? '',
      state:              merchant?.state            ?? '',
      postcode:           merchant?.postcode         ?? '',
      min_order_amount:   merchant?.min_order_amount ?? 0,
      delivery_radius_km: merchant?.delivery_radius_km ?? 10,
    },
  })

  const pickImage = async (type: 'logo' | 'banner') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'logo' ? [1, 1] : [16, 5],
      quality: 0.85,
    })
    if (!result.canceled) {
      if (type === 'logo')   { setNewLogo(result.assets[0].uri);   setLogoUri(result.assets[0].uri)   }
      if (type === 'banner') { setNewBanner(result.assets[0].uri); setBannerUri(result.assets[0].uri) }
    }
  }

  const onSubmit = async (data: FormData) => {
    if (!merchant) return
    setIsSaving(true)
    try {
      let logoUrl   = merchant.logo_url   ?? null
      let bannerUrl = merchant.banner_url ?? null

      if (newLogo) {
        logoUrl = await uploadService.uploadImage('merchant-assets', merchant.id, newLogo, 'logo.jpg')
      }
      if (newBanner) {
        bannerUrl = await uploadService.uploadImage('merchant-assets', merchant.id, newBanner, 'banner.jpg')
      }

      await merchantsService.update(merchant.id, { ...data, logo_url: logoUrl, banner_url: bannerUrl })

      // ── Geocode the store address and store lat/lng (non-blocking) ──────────
      geocodingService.geocodeMerchant(merchant.id, {
        address_line1: data.address_line1,
        city:          data.city,
        state:         data.state,
        postcode:      data.postcode,
      })
      // ────────────────────────────────────────────────────────────────────────

      await refreshMerchant()
      Toast.show({ type: 'success', text1: 'Store updated!' })
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Update failed', text2: err.message })
    }
    setIsSaving(false)
  }

  function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <View className="bg-white rounded-2xl p-4 mb-3"
        style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
        <Text className="font-bold text-gray-900 mb-3">{title}</Text>
        {children}
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ paddingTop: insets.top }}
    >
      <View className="bg-white px-5 pt-4 pb-3 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">Store Settings</Text>
        <View className={`mt-1 self-start px-2 py-0.5 rounded-full
          ${merchant?.status === 'active' ? 'bg-green-100' : 'bg-yellow-100'}`}>
          <Text className={`text-xs font-semibold capitalize
            ${merchant?.status === 'active' ? 'text-green-700' : 'text-yellow-700'}`}>
            {merchant?.status?.replace('_', ' ')}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

        {/* ── Branding ── */}
        <SectionCard title="🎨  Branding">
          {/* Banner */}
          <Text className="text-sm font-semibold text-gray-700 mb-2">Store Banner</Text>
          <TouchableOpacity onPress={() => pickImage('banner')} activeOpacity={0.8} className="mb-4 relative">
            <Image
              source={bannerUri ? { uri: bannerUri } : require('../../assets/placeholder-banner.png')}
              style={{ width: '100%', height: 110, borderRadius: 12 }}
              contentFit="cover"
            />
            <View className="absolute inset-0 rounded-xl items-center justify-center bg-black/20">
              <Ionicons name="camera" size={24} color="#fff" />
              <Text className="text-white text-xs font-semibold mt-1">Change Banner</Text>
            </View>
          </TouchableOpacity>

          {/* Logo */}
          <Text className="text-sm font-semibold text-gray-700 mb-2">Store Logo</Text>
          <View className="flex-row items-center gap-4">
            <Image
              source={logoUri ? { uri: logoUri } : require('../../assets/placeholder-logo.png')}
              style={{ width: 72, height: 72, borderRadius: 16 }}
              contentFit="cover"
            />
            <TouchableOpacity
              onPress={() => pickImage('logo')}
              className="flex-row items-center gap-2 border border-gray-200 rounded-xl px-4 py-2.5"
            >
              <Ionicons name="camera-outline" size={16} color="#374151" />
              <Text className="text-gray-700 font-semibold text-sm">Change Logo</Text>
            </TouchableOpacity>
          </View>
        </SectionCard>

        {/* ── Basic info ── */}
        <SectionCard title="🏪  Store Info">
          <Controller control={control} name="store_name"
            render={({ field: { onChange, value } }) => (
              <Input label="Store Name *" value={value} onChangeText={onChange} error={errors.store_name?.message} />
            )}
          />
          <Controller control={control} name="description"
            render={({ field: { onChange, value } }) => (
              <Input label="Description" placeholder="What does your store sell?" value={value ?? ''} onChangeText={onChange} />
            )}
          />
          <Controller control={control} name="phone"
            render={({ field: { onChange, value } }) => (
              <Input label="Business Phone *" keyboardType="phone-pad" value={value} onChangeText={onChange} error={errors.phone?.message} />
            )}
          />
          <Controller control={control} name="email"
            render={({ field: { onChange, value } }) => (
              <Input label="Business Email" keyboardType="email-address" autoCapitalize="none" value={value ?? ''} onChangeText={onChange} />
            )}
          />
        </SectionCard>

        {/* ── Address ── */}
        <SectionCard title="📍  Store Address">
          <Controller control={control} name="address_line1"
            render={({ field: { onChange, value } }) => (
              <Input label="Address *" value={value} onChangeText={onChange} error={errors.address_line1?.message} />
            )}
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Controller control={control} name="city"
                render={({ field: { onChange, value } }) => (
                  <Input label="City *" value={value} onChangeText={onChange} error={errors.city?.message} />
                )}
              />
            </View>
            <View className="flex-1">
              <Controller control={control} name="postcode"
                render={({ field: { onChange, value } }) => (
                  <Input label="Postcode *" keyboardType="numeric" maxLength={5} value={value} onChangeText={onChange} error={errors.postcode?.message} />
                )}
              />
            </View>
          </View>
          <Controller control={control} name="state"
            render={({ field: { onChange, value } }) => (
              <Input label="State *" value={value} onChangeText={onChange} error={errors.state?.message} />
            )}
          />
        </SectionCard>

        {/* ── Delivery settings ── */}
        <SectionCard title="🚚  Delivery Settings">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Controller control={control} name="min_order_amount"
                render={({ field: { onChange, value } }) => (
                  <Input label="Min. Order (RM)" keyboardType="decimal-pad"
                    value={value ? String(value) : '0'} onChangeText={onChange}
                    hint="Set 0 for no minimum" />
                )}
              />
            </View>
            <View className="flex-1">
              <Controller control={control} name="delivery_radius_km"
                render={({ field: { onChange, value } }) => (
                  <Input label="Delivery Radius (km)" keyboardType="decimal-pad"
                    value={value ? String(value) : '10'} onChangeText={onChange}
                    hint="Max distance you'll deliver" />
                )}
              />
            </View>
          </View>
        </SectionCard>

        {/* Slug (read-only) */}
        <View className="bg-white rounded-2xl p-4 mb-3"
          style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          <Text className="font-bold text-gray-900 mb-2">🔗  Store URL</Text>
          <View className="bg-gray-50 rounded-xl p-3 flex-row items-center gap-2">
            <Ionicons name="link-outline" size={16} color="#9ca3af" />
            <Text className="text-gray-600 text-sm font-mono">/stores/{merchant?.store_slug}</Text>
          </View>
          <Text className="text-gray-400 text-xs mt-1">Store URL cannot be changed after creation</Text>
        </View>

        <Button onPress={handleSubmit(onSubmit)} loading={isSaving}>
          Save Store Settings
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
