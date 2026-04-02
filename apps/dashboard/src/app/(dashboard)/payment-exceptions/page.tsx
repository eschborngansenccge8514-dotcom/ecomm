import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PaymentExceptionsClient from '@/components/dashboard/PaymentExceptionsClient'

export default async function PaymentExceptionsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!merchant) redirect('/')

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Payment Errors & Exceptions</h1>
        <p className="text-gray-500 mt-1">Monitor duplicate webhooks, stuck payments, and failed transactions.</p>
      </div>

      <PaymentExceptionsClient merchantId={merchant.id} />
    </div>
  )
}
