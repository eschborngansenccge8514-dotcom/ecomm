import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import Toast from 'react-native-toast-message'

const schema = z.object({
  fullName:        z.string().min(2, 'Name must be at least 2 characters'),
  email:           z.string().email('Invalid email address'),
  password:        z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type FormData = z.infer<typeof schema>

export default function RegisterScreen() {
  const { signUpWithEmail, isLoading } = useAuthStore()
  const [role, setRole] = useState<'customer' | 'merchant'>('customer')

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const onSubmit = async (data: FormData) => {
    try {
      await signUpWithEmail(data.email, data.password, data.fullName, role)
      Toast.show({ type: 'success', text1: 'Check your email to confirm your account.' })
      router.push('/(auth)/login')
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Registration failed', text2: err.message })
    }
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView className="flex-1 px-6 pt-16" showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} className="mb-8 p-2 -ml-2">
          <Text className="text-primary-600 text-base font-semibold">← Back</Text>
        </TouchableOpacity>

        <Text className="text-3xl font-bold text-gray-900 mb-2">Create account</Text>
        <Text className="text-gray-500 mb-8 text-base">Join as a customer or merchant</Text>

        <View className="flex-row mb-10 gap-3">
          {(['customer', 'merchant'] as const).map(r => (
            <TouchableOpacity
              key={r}
              onPress={() => setRole(r)}
              className={`flex-1 py-4 rounded-2xl border-2 items-center justify-center
                ${role === r ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white'}`}
            >
              <Text className={`font-bold capitalize text-base
                ${role === r ? 'text-primary-700' : 'text-gray-500'}`}>
                {r === 'merchant' ? '🏠 Merchant' : '🛍️ Customer'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Controller control={control} name="fullName"
          render={({ field: { onChange, value } }) => (
            <Input label="Full Name" placeholder="Ahmad bin Ali" value={value} onChangeText={onChange} error={errors.fullName?.message} />
          )}
        />
        <Controller control={control} name="email"
          render={({ field: { onChange, value } }) => (
            <Input label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" value={value} onChangeText={onChange} error={errors.email?.message} />
          )}
        />
        <Controller control={control} name="password"
          render={({ field: { onChange, value } }) => (
            <Input label="Password" placeholder="Min 8 characters" secureTextEntry value={value} onChangeText={onChange} error={errors.password?.message} />
          )}
        />
        <Controller control={control} name="confirmPassword"
          render={({ field: { onChange, value } }) => (
            <Input label="Confirm Password" placeholder="Repeat password" secureTextEntry value={value} onChangeText={onChange} error={errors.confirmPassword?.message} />
          )}
        />

        <Button onPress={handleSubmit(onSubmit)} loading={isLoading} className="mt-6 mb-12">
          Create Account
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
