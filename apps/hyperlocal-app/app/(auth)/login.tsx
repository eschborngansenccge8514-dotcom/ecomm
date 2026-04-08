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
  email:    z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type FormData = z.infer<typeof schema>

export default function LoginScreen() {
  const { signInWithEmail, isLoading } = useAuthStore()

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data: FormData) => {
    try {
      await signInWithEmail(data.email, data.password)
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Login failed', text2: err.message })
    }
  }

  return (
    <ImageBackground 
      source={{ uri: 'https://images.unsplash.com/photo-1557683311-eac922347aa1?q=80&w=2000' }}
      className="flex-1"
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} 
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInUp.delay(200).duration(800)}>
            <TouchableOpacity onPress={() => router.back()} className="mb-6 w-10 h-10 rounded-full bg-white/20 items-center justify-center border border-white/30">
              <Ionicons name="arrow-back" size={20} color="white" />
            </TouchableOpacity>
          </Animated.View>

          <BlurView intensity={70} tint="light" className="rounded-[40px] overflow-hidden border border-white/40 shadow-2xl p-8">
            <Animated.View entering={FadeInDown.delay(300).duration(800)}>
              <Text className="text-4xl font-bold text-gray-900 mb-2 font-heading tracking-tight">Welcome</Text>
              <Text className="text-gray-600 mb-10 text-lg font-medium leading-tight">Sign in to continue your journey</Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(400).duration(800)}>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Email"
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={value}
                    onChangeText={onChange}
                    error={errors.email?.message}
                  />
                )}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(500).duration(800)}>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Password"
                    placeholder="••••••••"
                    secureTextEntry
                    value={value}
                    onChangeText={onChange}
                    error={errors.password?.message}
                  />
                )}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(600).duration(800)}>
              <TouchableOpacity 
                onPress={() => router.push('/(auth)/forgot-password')} 
                className="mb-8 self-end"
              >
                <Text className="text-primary-600 font-bold">Forgot password?</Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(700).duration(800)}>
              <Button onPress={handleSubmit(onSubmit)} loading={isLoading}>
                Sign In
              </Button>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(800).duration(800)} className="flex-row justify-center mt-10">
              <Text className="text-gray-600 font-medium">Don't have an account? </Text><TouchableOpacity onPress={() => router.push('/(auth)/register')}><Text className="text-primary-600 font-bold">Sign up</Text></TouchableOpacity>
            </Animated.View>
          </BlurView>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  )
}
