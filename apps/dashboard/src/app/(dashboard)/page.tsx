import { getMerchant } from '@/lib/utils.server'
import { HomeOverviewClient } from '@/components/dashboard/HomeOverviewClient'
import { subDays, format } from 'date-fns'

function toDate(s: string | undefined, fallback: Date) {
  if (!s) return fallback
  const d = new Date(s)
  return isNaN(d.getTime()) ? fallback : d
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { from, to } = await searchParams
  const { supabase, merchant } = await getMerchant()

  const endDate   = toDate(to,   new Date())
  const startDate = toDate(from, subDays(endDate, 29))

  const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

  const { data, error } = await supabase.rpc('get_dashboard_overview', {
    p_merchant_id: merchant.id,
    p_start: fmt(startDate),
    p_end: fmt(endDate)
  })

  if (error) {
    console.error('Error fetching overview:', error)
  }

  return (
    <HomeOverviewClient
      merchantId={merchant.id}
      dateRange={{ from: fmt(startDate), to: fmt(endDate) }}
      data={data || {}}
    />
  )
}
