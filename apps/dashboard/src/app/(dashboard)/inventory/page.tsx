import { getMerchant } from '@/lib/utils.server'
import { getInventoryDashboard } from '@/lib/inventory-actions'
import { InventoryPageClient } from '@/components/dashboard/inventory/InventoryPageClient'

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { supabase, merchant } = await getMerchant()
  const params = await searchParams
  const tab = params.tab ?? 'products'

  const [{ data: products }, { data: categories }, inventoryData] = await Promise.all([
    supabase
      .from('products')
      .select(`
        id, name, sku, status, price, stock_quantity,
        images, category_id, is_featured, created_at,
        compare_at_price, low_stock_alert,
        track_inventory, barcode, cost_price, description, weight_grams,
        category:categories(name),
        variants:product_variants(id, name, price_modifier, stock_quantity)
      `)
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('categories')
      .select('*, product_count:products(count)')
      .eq('merchant_id', merchant.id)
      .order('sort_order', { ascending: true }),
    getInventoryDashboard(),
  ])

  return (
    <InventoryPageClient
      products={products ?? []}
      categories={categories ?? []}
      merchantId={merchant.id}
      storeType={merchant.store_type as any}
      inventoryData={inventoryData}
    />
  )
}
