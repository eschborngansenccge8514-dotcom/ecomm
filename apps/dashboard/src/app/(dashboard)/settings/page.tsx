import { createClient }     from '@/lib/supabase/server'
import { redirect }         from 'next/navigation'
import { SettingsClient }   from '@/components/dashboard/SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase
    .from('merchants').select('*').eq('owner_id', user.id).single()
  if (!merchant) redirect('/login')

  const [{ data: lalamoveConfig }, { data: easyparcelConfig }, { data: razorpayConfig }, { data: billplzConfig }] = await Promise.all([
    supabase.from('merchant_lalamove_config').select('*').eq('merchant_id', merchant.id).single(),
    supabase.from('merchant_easyparcel_config').select('*').eq('merchant_id', merchant.id).single(),
    supabase.from('merchant_razorpay_config').select('*').eq('merchant_id', merchant.id).single(),
    supabase.from('merchant_billplz_config').select('*').eq('merchant_id', merchant.id).single(),
  ])

  return (
    <SettingsClient 
      merchant={merchant} 
      lalamoveConfig={lalamoveConfig} 
      easyparcelConfig={easyparcelConfig}
      razorpayConfig={razorpayConfig}
      billplzConfig={billplzConfig}
    />
  )
}

