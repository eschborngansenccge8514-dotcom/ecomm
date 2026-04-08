import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ImageBackground } from 'react-native'
import { router } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuthStore } from '@/stores/authStore'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import Toast from 'react-native-toast-message'
import { BlurView } from 'expo-blur'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'

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
      await signUpWithEmail(data.email, data.password, data.fullName, 'customer')
      Toast.show({ type: 'success', text1: 'Success!', text2: 'Check your email to confirm your account.' })
      router.push('/(auth)/login')
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Registration failed', text2: err.message })
    }
  }

  return (
    <ImageBackground 
      source={{ uri: 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2000' }}
      className="flex-1"
    >
      <KeyboardAvoidingView 
        className="flex-1" 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          className="flex-1" 
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInUp.delay(200).duration(800)}>
            <TouchableOpacity onPress={() => router.back()} className="mb-6 w-10 h-10 rounded-full bg-white/20 items-center justify-center border border-white/30">
              <Ionicons name="arrow-back" size={20} color="white" />
            </TouchableOpacity>
          </Animated.View>

          <BlurView intensity={60} tint="light" className="rounded-[40px] overflow-hidden border border-white/40 shadow-2xl p-8 mb-12">
            <Animated.View entering={FadeInDown.delay(300).duration(800)}>
              <Text className="text-4xl font-bold text-gray-900 mb-2 font-heading tracking-tight">Join Us</Text>
              <Text className="text-gray-600 mb-8 text-lg font-medium leading-tight">Create your account to start shopping local</Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(400).duration(800)}>
              <Controller control={control} name="fullName"
                render={({ field: { onChange, value } }) => (
                  <Input label="Full Name" placeholder="Ahmad bin Ali" value={value} onChangeText={onChange} error={errors.fullName?.message} />
                )}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(500).duration(800)}>
              <Controller control={control} name="email"
                render={({ field: { onChange, value } }) => (
                  <Input label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" value={value} onChangeText={onChange} error={errors.email?.message} />
                )}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(600).duration(800)}>
              <Controller control={control} name="password"
                render={({ field: { onChange, value } }) => (
                  <Input label="Password" placeholder="Min 8 characters" secureTextEntry value={value} onChangeText={onChange} error={errors.password?.message} />
                )}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(700).duration(800)}>
              <Controller control={control} name="confirmPassword"
                render={({ field: { onChange, value } }) => (
                  <Input label="Confirm Password" placeholder="Repeat password" secureTextEntry value={value} onChangeText={onChange} error={errors.confirmPassword?.message} />
                )}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(800).duration(800)}>
              <Button onPress={handleSubmit(onSubmit)} loading={isLoading} className="mt-4">
                Create Account
              </Button>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(900).duration(800)} className="flex-row justify-center mt-8">
              <Text className="text-gray-600 font-medium">Already have an account? </Text><TouchableOpacity onPress={() => router.push('/(auth)/login')}><Text className="text-primary-600 font-bold">Sign In</Text></TouchableOpacity>
            </Animated.View>
          </BlurView>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  )
}
