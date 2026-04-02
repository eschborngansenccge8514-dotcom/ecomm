import { View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { router } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { merchantsService } from '@/services/merchants.service'
import { useAuthStore } from '@/stores/authStore'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { generateSlug } from '@/lib/utils'
import Toast from 'react-native-toast-message'
import { useState } from 'react'

const INDUSTRIES = ['Food & Beverage','Retail','Pharmacy','Grocery','Fashion','Electronics','Beauty & Health','Services','Other']

const schema = z.object({
  store_name:   z.string().min(3, 'Store name must be at least 3 characters'),
  industry:     z.string().min(1, 'Select an industry'),
  description:  z.string().optional(),
  phone:        z.string().min(10, 'Enter a valid phone number'),
  address_line1:z.string().min(5, 'Enter your address'),
  city:         z.string().min(2),
  state:        z.string().min(2),
  postcode:     z.string().length(5, 'Malaysian postcodes are 5 digits'),
})

type FormData = z.infer<typeof schema>

export default function OnboardingScreen() {
  const { user, refreshMerchant } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndustry, setSelectedIndustry] = useState('')

  const { control, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      const slug = generateSlug(data.store_name)
      const available = await merchantsService.isSlugAvailable(slug)
      const finalSlug = available ? slug : `${slug}-${Date.now().toString().slice(-4)}`

      await merchantsService.create({
        owner_id:     user!.id,
        store_name:   data.store_name,
        store_slug:   finalSlug,
        industry:     data.industry,
        description:  data.description,
        phone:        data.phone,
        address_line1:data.address_line1,
        city:         data.city,
        state:        data.state,
        postcode:     data.postcode,
        country:      'MY',
        status:       'active',
      })

      await refreshMerchant()
      router.replace('/(merchant)/dashboard')
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed to create store', text2: err.message })
    }
    setIsLoading(false)
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView className="flex-1 px-6 pt-16" showsVerticalScrollIndicator={false}>
        <Text className="text-3xl font-bold text-gray-900 mb-2">Set up your store</Text>
        <Text className="text-gray-500 mb-10 text-base leading-relaxed">Let's get your business profile ready. You can customize your store theme and banners later.</Text>

        <Controller control={control} name="store_name"
          render={({ field: { onChange, value } }) => (
            <Input 
              label="Store Name" 
              placeholder="e.g. Kedai Ahmad" 
              value={value}
              onChangeText={(v) => { onChange(v); setValue('store_name', v) }}
              error={errors.store_name?.message} 
            />
          )}
        />

        {/* Industry grid */}
        <Text className="text-sm font-bold text-gray-700 mb-3 mt-4 uppercase tracking-widest text-xs">Primary Industry *</Text>
        <View className="flex-row flex-wrap gap-2.5 mb-8">
          {INDUSTRIES.map(ind => (
            <TouchableOpacity
              key={ind}
              onPress={() => { setSelectedIndustry(ind); setValue('industry', ind) }}
              className={`px-4 py-2.5 rounded-2xl border-2 items-center justify-center
                ${selectedIndustry === ind ? 'border-primary-500 bg-primary-50' : 'border-gray-100 bg-white'}`}
            >
              <Text className={`text-sm font-bold capitalize
                ${selectedIndustry === ind ? 'text-primary-700' : 'text-gray-500'}`}>{ind}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.industry && <Text className="text-red-500 text-xs mt-[-20px] mb-6 font-semibold">{errors.industry.message}</Text>}

        <Controller control={control} name="phone"
          render={({ field: { onChange, value } }) => (
            <Input label="Business WhatsApp/Phone" placeholder="012XXXXXXXX" keyboardType="phone-pad" value={value} onChangeText={onChange} error={errors.phone?.message} />
          )}
        />
        <Controller control={control} name="address_line1"
          render={({ field: { onChange, value } }) => (
            <Input label="Street Address" placeholder="No. 1, Jalan Example" value={value} onChangeText={onChange} error={errors.address_line1?.message} />
          )}
        />
        <View className="flex-row gap-4">
          <View className="flex-1">
            <Controller control={control} name="city"
              render={({ field: { onChange, value } }) => (
                <Input label="City" placeholder="Kuala Lumpur" value={value} onChangeText={onChange} error={errors.city?.message} />
              )}
            />
          </View>
          <View className="flex-1">
            <Controller control={control} name="postcode"
              render={({ field: { onChange, value } }) => (
                <Input label="Postcode" placeholder="50000" keyboardType="numeric" maxLength={5} value={value} onChangeText={onChange} error={errors.postcode?.message} />
              )}
            />
          </View>
        </View>
        <Controller control={control} name="state"
          render={({ field: { onChange, value } }) => (
            <Input label="State" placeholder="Selangor" value={value} onChangeText={onChange} error={errors.state?.message} />
          )}
        />

        <Button onPress={handleSubmit(onSubmit)} loading={isLoading} className="mt-8 mb-16" size="lg">
          Launch My Store 🚀
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
