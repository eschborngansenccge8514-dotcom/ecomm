import { createClient } from '@/lib/supabase/server'
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
