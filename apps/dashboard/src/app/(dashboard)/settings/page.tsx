import { getAuthContext } from '@/lib/utils.server'
import { redirect }     from 'next/navigation'

import { SettingsClient } from '@/components/dashboard/SettingsClient'

export default async function SettingsPage() {
  const { supabase, user, merchant, isAdmin } = await getAuthContext()

  // Use a virtual merchant for admins if they don't have one
  const effectiveMerchant = merchant || {
    id: 'admin',
    store_name: 'Platform Admin',
    status: 'active',
    logo_url: null
  }

  const [
    { data: lalamoveConfig }, 
    { data: easyparcelConfig }, 
    { data: razorpayConfig }, 
    { data: billplzConfig },
    { data: einvoiceConfig },
    { data: operatingHours },
    { data: announcements }
  ] = await Promise.all([
    supabase.from('merchant_lalamove_config').select('*').eq('merchant_id', effectiveMerchant.id).maybeSingle(),
    supabase.from('merchant_easyparcel_config').select('*').eq('merchant_id', effectiveMerchant.id).maybeSingle(),
    supabase.from('merchant_razorpay_config').select('*').eq('merchant_id', effectiveMerchant.id).maybeSingle(),
    supabase.from('merchant_billplz_config').select('*').eq('merchant_id', effectiveMerchant.id).maybeSingle(),
    supabase.from('merchant_einvoice_config').select('*').eq('merchant_id', effectiveMerchant.id).maybeSingle(),
    supabase.from('merchant_operating_hours').select('*').eq('merchant_id', effectiveMerchant.id),
    supabase.from('store_announcements').select('*').eq('merchant_id', effectiveMerchant.id),
  ])

  return (
    <SettingsClient 
      merchant={effectiveMerchant as any} 
      lalamoveConfig={lalamoveConfig} 
      easyparcelConfig={easyparcelConfig}
      razorpayConfig={razorpayConfig}
      billplzConfig={billplzConfig}
      einvoiceConfig={einvoiceConfig}
      operatingHours={operatingHours || []}
      announcements={announcements || []}
    />
  )
}

