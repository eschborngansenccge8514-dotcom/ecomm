import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { STORE_TYPES, type StoreType } from '@/lib/store-types'
import Image from 'next/image'
import { ProductGrid } from './_components/ProductGrid'

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_store_config', { p_slug: slug })
  const config   = data?.[0]

  if (!config) notFound()

  const { data: products } = await supabase
    .from('products')
    .select('*, attributes:product_custom_attributes(*)')
    .eq('merchant_id', config.merchant_id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const storeMeta = STORE_TYPES[config.store_type as StoreType]

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-12">
      {/* Header */}
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-[var(--color-primary)]/20"
          style={{ backgroundColor: 'var(--color-primary)' }}>
          {config.appearance?.logoUrl
            ? (
              <div className="relative w-full h-full rounded-2xl overflow-hidden">
                <Image src={config.appearance.logoUrl} fill className="object-cover" alt="" />
              </div>
            ) : config.store_name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-4xl font-black text-[var(--color-text)] tracking-tight">
            {config.store_name}
          </h1>
          <p className="text-lg text-[var(--color-text)]/60 font-medium">
            {config.appearance?.tagline || storeMeta.desc}
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-sm font-bold">
          <span className="text-xl">{storeMeta.icon}</span>
          {storeMeta.label}
        </div>
      </div>

      {/* Grid */}
      <ProductGrid products={products ?? []} slug={slug} storeIcon={storeMeta.icon} />
    </div>
  )
}
