import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { STORE_TYPES, type StoreType } from '@/lib/store-types'
import { ProductDetailClient } from '../../_components/ProductDetailClient'

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>
}) {
  const { slug, productId } = await params
  const supabase = await createClient()

  const { data: configData } = await supabase.rpc('get_store_config', { p_slug: slug })
  const config = configData?.[0]
  if (!config) notFound()

  const { data: product } = await supabase
    .from('products')
    .select('*, attributes:product_custom_attributes(*)')
    .eq('id', productId)
    .eq('merchant_id', config.merchant_id)
    .eq('status', 'active')
    .single()

  if (!product) notFound()

  const storeMeta = STORE_TYPES[config.store_type as StoreType]

  return (
    <ProductDetailClient
      product={product}
      slug={slug}
      storeIcon={storeMeta.icon}
    />
  )
}
