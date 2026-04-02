import { getMerchant } from '@/lib/utils.server'
import { ProductsAnalyticsClient } from '@/components/dashboard/ProductsAnalyticsClient'
import { subDays, format } from 'date-fns'

function toDate(s: string | undefined, fallback: Date) {
  if (!s) return fallback
  const d = new Date(s); return isNaN(d.getTime()) ? fallback : d
}

export default async function ProductsAnalyticsPage({
  searchParams,
}: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { from, to } = await searchParams
  const { supabase, merchant } = await getMerchant()
  const endDate   = toDate(to,   new Date())
  const startDate = toDate(from, subDays(endDate, 29))
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

  const [
    { data: productSales },
    { data: variantSales },
    { data: wishlistStats },
  ] = await Promise.all([
    supabase.rpc('get_product_sales_detail', {
      p_merchant_id: merchant.id, p_start: fmt(startDate), p_end: fmt(endDate),
    }),
    supabase.rpc('get_variant_sales', {
      p_merchant_id: merchant.id, p_start: fmt(startDate), p_end: fmt(endDate),
    }),
    supabase.rpc('get_wishlist_stats', {
      p_merchant_id: merchant.id, p_start: fmt(startDate), p_end: fmt(endDate),
    }),
  ])

  return (
    <ProductsAnalyticsClient
      merchantId={merchant.id}
      dateRange={{ from: fmt(startDate), to: fmt(endDate) }}
      productSales={(productSales   as any[]) ?? []}
      variantSales={(variantSales   as any[]) ?? []}
      wishlistStats={(wishlistStats as any[]) ?? []}
    />
  )
}
