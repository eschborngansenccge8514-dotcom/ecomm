import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { redirect }     from 'next/navigation'

export async function getAuthContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: merchant }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('merchants').select('*').eq('owner_id', user.id).single(),
  ])

  const isAdmin = profile?.role === 'admin'

  // If not admin and no merchant, redirect to application/login
  if (!merchant && !isAdmin) {
    if (profile?.role === 'merchant') {
      redirect('/apply')
    }
    redirect('/login')
  }

  return { supabase, user, profile, merchant, isAdmin }
}

export async function getMerchant() {
  const { supabase, user, merchant, isAdmin } = await getAuthContext()
  if (!merchant && !isAdmin) redirect('/login')
  
  const effectiveMerchant = merchant || {
    id: 'admin',
    store_name: 'Platform Admin',
    status: 'active',
    logo_url: null
  }

  return { supabase, user, merchant: effectiveMerchant as any }
}

export function formatCurrency(amount: number): string {
  return `RM ${Number(amount).toFixed(2)}`
}

/**
 * Resolves auth for API routes that must support both SSR cookie sessions
 * (dashboard) and Bearer token auth (mobile app).
 *
 * Returns null if auth fails — callers should return a 401 response.
 */
export async function resolveAuth(req: Request): Promise<{
  user: any
  merchant: any
  isAdmin: boolean
  supabase: any
} | null> {
  // 1. Try SSR session cookie
  try {
    const auth = await getAuthContext()
    return { user: auth.user, merchant: auth.merchant, isAdmin: auth.isAdmin, supabase: auth.supabase }
  } catch {
    // fall through to Bearer token
  }

  // 2. Fallback: Bearer token (mobile)
  const authHeader = req.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const client = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    )
    const { data: { user: tokenUser } } = await client.auth.getUser(token)
    if (tokenUser) {
      const [{ data: merchant }, { data: profile }] = await Promise.all([
        client.from('merchants').select('*').eq('owner_id', tokenUser.id).single(),
        client.from('profiles').select('*').eq('id', tokenUser.id).single(),
      ])
      return {
        user: tokenUser,
        merchant,
        isAdmin: profile?.role === 'admin',
        supabase: client,
      }
    }
  }

  return null
}
