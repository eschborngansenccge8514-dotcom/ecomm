import { getMerchant }      from '@/lib/utils.server'
import { CategoriesClient } from '@/components/dashboard/CategoriesClient'

export default async function CategoriesPage() {
  const { supabase, merchant } = await getMerchant()
  const { data: categories } = await supabase
    .from('categories')
    .select('*, product_count:products(count)')
    .eq('merchant_id', merchant.id)
    .order('sort_order', { ascending: true })

  return <CategoriesClient categories={categories ?? []} merchantId={merchant.id} />
}
