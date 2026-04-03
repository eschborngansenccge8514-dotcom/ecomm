import { getMerchant }    from '@/lib/utils.server'
import { ProductsClient } from '@/components/dashboard/ProductsClient'

export default async function ProductsPage() {
  const { supabase, merchant } = await getMerchant()

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase
      .from('products')
      .select('*, category:categories(name), variants:product_variants(id, name, price_modifier, stock_quantity)')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('categories')
      .select('id, name')
      .eq('merchant_id', merchant.id)
      .order('name'),
  ])

  return (
    <ProductsClient
      products={products ?? []}
      categories={categories ?? []}
      merchantId={merchant.id}
      storeType={merchant.store_type as any}
    />
  )
}
