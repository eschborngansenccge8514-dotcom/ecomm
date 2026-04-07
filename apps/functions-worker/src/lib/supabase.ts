import { createClient } from '@supabase/supabase-js'

export interface Bindings {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  APP_URL: string
  APP_ENCRYPTION_KEY_BASE64: string
  BILLPLZ_API_KEY: string
  BILLPLZ_COLLECTION_ID: string
  BILLPLZ_X_SIGNATURE_KEY: string
  BILLPLZ_SANDBOX: string
  LALAMOVE_API_KEY: string
  LALAMOVE_API_SECRET: string
  LALAMOVE_SANDBOX: string
  EASYPARCEL_API_KEY: string
  EASYPARCEL_AUTH_KEY: string
  TIKTOK_APP_SECRET: string
  GEOCODE_MAPS_API_KEY: string
  INTERNAL_SECRET: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  RAZORPAY_KEY_ID: string
  RAZORPAY_KEY_SECRET: string
  RAZORPAY_WEBHOOK_SECRET: string
  RESEND_API_KEY: string
  RESEND_WEBHOOK_SECRET: string
  GOOGLE_GENERATIVE_AI_API_KEY: string
  META_APP_ID: string
  META_APP_SECRET: string
  EVOLUTION_API_URL: string
  EVOLUTION_API_KEY: string
  WHATSAPP_INSTANCE_NAME: string
  R2_BUCKET: R2Bucket
}

export const getSupabaseClient = (env: Bindings) => {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
