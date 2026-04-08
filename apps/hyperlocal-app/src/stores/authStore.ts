import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'
import type { Profile, Merchant } from '@/types/app.types'
import { notificationsService } from '@/services/notifications.service'

interface AuthState {
  session:   Session | null
  user:      User    | null
  profile:   Profile | null
  merchant:  Merchant | null
  isLoading: boolean
  isInitialized: boolean
}

interface AuthActions {
  initialize:      () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, fullName: string, role: 'customer' | 'merchant') => Promise<void>
  signOut:         () => Promise<void>
  refreshProfile:  () => Promise<void>
  refreshMerchant: () => Promise<void>
  setSession:      (session: Session | null) => void
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  session:       null,
  user:          null,
  profile:       null,
  merchant:      null,
  isLoading:     false,
  isInitialized: false,

  initialize: async () => {
    try {
      // Get existing session from storage
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        set({ session, user: session.user })
        await get().refreshProfile().catch(console.error)
      }

      // Listen to auth changes globally
      supabase.auth.onAuthStateChange(async (event, session) => {
        set({ session, user: session?.user ?? null })
        if (session) {
          await get().refreshProfile().catch(console.error)
        } else {
          set({ profile: null, merchant: null })
        }
      })
    } catch (error) {
      console.error('[AuthStore] Initialization failed:', error)
    } finally {
      set({ isInitialized: true })
    }
  },

  signInWithEmail: async (email, password) => {
    set({ isLoading: true })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    set({ isLoading: false })
    if (error) throw error
  },

  signUpWithEmail: async (email, password, fullName, role) => {
    set({ isLoading: true })
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
      },
    })
    set({ isLoading: false })
    if (error) throw error
  },

  signOut: async () => {
    try {
      set({ isLoading: true })
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('[AuthStore] supabase.auth.signOut error:', error)
      }
    } catch (error) {
      console.error('[AuthStore] signOut logout error:', error)
    } finally {
      set({ session: null, user: null, profile: null, merchant: null, isLoading: false })
    }
  },

  refreshProfile: async () => {
    try {
      const user = get().user
      if (!user) return

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (error) throw error
      set({ profile })

      if (profile) {
        notificationsService.registerForPushNotificationsAsync(profile.id).catch(console.error)
      }

      // If merchant role, fetch merchant record
      if (profile?.role === 'merchant') {
        await get().refreshMerchant().catch(console.error)
      }
    } catch (error) {
      console.error('[AuthStore] refreshProfile failed:', error)
      // Note: we don't throw here to avoid breaking the calling initialization flow
    }
  },

  refreshMerchant: async () => {
    const user = get().user
    if (!user) return
    const { data: merchant } = await supabase
      .from('merchants')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle()
    set({ merchant })
  },

  setSession: (session) => set({ session, user: session?.user ?? null }),
}))
