'use server'

import { getAuthContext } from '@/lib/utils.server'
import { createClient }   from '@/lib/supabase/server'

export async function createTopupSession(amount: number, gateway: 'razorpay' | 'billplz') {
  const { user } = await getAuthContext()
  if (!user) throw new Error('Unauthorized')

  const supabase = await createClient()

  const { data, error } = await supabase.functions.invoke('create-wallet-topup', {
    body: { amount, gateway }
  })

  if (error) {
    console.error('Invoke error:', error)
    throw new Error(error.message || 'Failed to initiate top-up')
  }

  return data
}
