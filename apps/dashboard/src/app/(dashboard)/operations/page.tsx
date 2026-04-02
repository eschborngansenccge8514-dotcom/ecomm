import { getMerchant } from '@/lib/utils.server'
import { OperationsClient }  from '../../../components/dashboard/OperationsClient'
import { subDays, format }     from 'date-fns'

function toDate(s: string | undefined, fallback: Date) {
  if (!s) return fallback
  const d = new Date(s); return isNaN(d.getTime()) ? fallback : d
}

export default async function OperationsPage({
  searchParams,
}: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { from, to } = await searchParams
  const { supabase, merchant } = await getMerchant()
  const endDate   = toDate(to,   new Date())
  const startDate = toDate(from, subDays(endDate, 29))
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

  const [
    { data: stockLevels },
    { data: fulfillmentStats },
    { data: fulfillmentQueue },
    { data: deliveryStats },
    { data: paymentStats },
  ] = await Promise.all([
    supabase.rpc('get_stock_levels', {
      p_merchant_id: merchant.id, p_start: fmt(startDate), p_end: fmt(endDate),
    }),
    supabase.rpc('get_fulfillment_stats', {
      p_merchant_id: merchant.id, p_start: fmt(startDate), p_end: fmt(endDate),
    }),
    supabase.rpc('get_fulfillment_queue', {
      p_merchant_id: merchant.id,
    }),
    supabase.rpc('get_delivery_performance', {
      p_merchant_id: merchant.id, p_start: fmt(startDate), p_end: fmt(endDate),
    }),
    supabase.rpc('get_payment_stats', {
      p_merchant_id: merchant.id, p_start: fmt(startDate), p_end: fmt(endDate),
    }),
  ])

  return (
    <OperationsClient
      merchantId={merchant.id}
      dateRange={{ from: fmt(startDate), to: fmt(endDate) }}
      stockLevels={(stockLevels       as any[]) ?? []}
      fulfillmentStats={(fulfillmentStats?.[0] as any)  ?? {}}
      fulfillmentQueue={(fulfillmentQueue   as any[])  ?? []}
      deliveryStats={(deliveryStats       as any[])  ?? []}
      paymentStats={(paymentStats         as any[])  ?? []}
    />
  )
}
