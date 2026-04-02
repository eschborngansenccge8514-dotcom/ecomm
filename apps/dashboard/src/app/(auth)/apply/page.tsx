import { createClient }  from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import { MerchantApplicationClient } from '@/components/auth/MerchantApplicationClient'

export default async function ApplyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/apply')

  // Already a merchant?
  const { data: merchant } = await supabase.from('merchants').select('id, status, onboarding_completed').eq('owner_id', user.id).single()
  if (merchant) {
    if (merchant.status === 'pending_review') redirect('/apply/pending')
    if (merchant.status === 'active' && !merchant.onboarding_completed) redirect('/onboarding')
    if (merchant.status === 'active') redirect('/')
  }

  // Already submitted application?
  const { data: existing } = await supabase.from('merchant_applications').select('id, status').eq('user_id', user.id).single()
  if (existing) {
    if (existing.status === 'pending')  redirect('/apply/pending')
    if (existing.status === 'rejected') redirect('/apply/rejected')
  }

  const { data: profile } = await supabase.from('profiles').select('full_name, phone').eq('id', user.id).single()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <MerchantApplicationClient userId={user.id} profile={profile ?? {}} />
    </div>
  )
}
