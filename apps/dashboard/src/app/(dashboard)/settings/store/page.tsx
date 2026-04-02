import { getMerchant } from '@/lib/utils.server'
import { StoreSettingsClient } from '@/components/dashboard/StoreSettingsClient'

export default async function StoreSettingsPage() {
  const { supabase, merchant } = await getMerchant()

  const [{ data: hours }, { data: announcements }, { data: zones }] = await Promise.all([
    supabase.from('merchant_operating_hours')
      .select('*').eq('merchant_id', merchant.id).order('day_of_week'),
    supabase.from('store_announcements')
      .select('*').eq('merchant_id', merchant.id).order('sort_order'),
    supabase.from('delivery_zones')
      .select('*').eq('merchant_id', merchant.id).order('sort_order'),
  ])

  return (
    <StoreSettingsClient
      merchant={merchant}
      hours={(hours    as any[]) ?? []}
      announcements={(announcements as any[]) ?? []}
      zones={(zones    as any[]) ?? []}
    />
  )
}
