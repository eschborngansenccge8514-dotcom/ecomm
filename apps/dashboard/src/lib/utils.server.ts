import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'

export async function getMerchant() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: merchant } = await supabase
    .from('merchants').select('*').eq('owner_id', user.id).single()
  if (!merchant) redirect('/login')
  return { supabase, user, merchant }
}

export function formatCurrency(amount: number): string {
  return `RM ${Number(amount).toFixed(2)}`
}
