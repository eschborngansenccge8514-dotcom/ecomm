'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function requestWithdrawal(formData: FormData) {
  const supabase =  await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const amount = Number(formData.get('amount'))
  if (!amount || amount <= 0) throw new Error('Invalid amount')

  // Get merchant
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, bank_name, bank_account_number, bank_account_name')
    .eq('owner_id', user.id)
    .single()

  if (!merchant) throw new Error('Merchant not found')

  // Create withdrawal request
  const { error } = await supabase
    .from('withdrawal_requests')
    .insert({
      merchant_id: merchant.id,
      amount: amount,
      bank_name: merchant.bank_name,
      bank_account_number: merchant.bank_account_number,
      bank_account_name: merchant.bank_account_name,
      status: 'pending'
    })

  if (error) {
    if (error.message.includes('Insufficient balance')) {
        throw new Error('Insufficient balance in wallet')
    }
    throw error
  }

  revalidatePath('/wallet')
  return { success: true }
}
