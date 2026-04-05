import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { STORE_TYPES, type StoreType } from '@/lib/store-types'
import Image from 'next/image'

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {(products ?? []).map(p => (
          <div key={p.id} className="bg-white border border-gray-100 rounded-[var(--radius-card)] overflow-hidden shadow-sm hover:shadow-xl transition-all group">
            {/* Image */}
            <div className="aspect-square bg-gray-50 relative overflow-hidden">
               {p.images?.[0] ? (
                  <Image src={p.images[0]} alt={p.name} fill className="object-cover group-hover:scale-105 transition-transform" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">
                    {storeMeta.icon}
                  </div>
                )}
            </div>
            
            <div className="p-4 space-y-2">
              <h3 className="font-bold text-lg text-[var(--color-text)] leading-tight">{p.name}</h3>
              <p className="text-sm text-[var(--color-text)]/50 line-clamp-2">{p.description}</p>
              
              {/* Custom fields */}
              {(p.attributes ?? []).length > 0 && (
                <div className="flex flex-wrap gap-2 py-2">
                  {p.attributes.map((attr: any) => (
                    <span key={attr.key} className="text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                      {attr.key.replace(/_/g, ' ')}: {attr.value}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-xl font-black text-[var(--color-primary)]">
                  RM {Number(p.price).toFixed(2)}
                </span>
                <button className="px-4 py-2 bg-[var(--color-primary)] text-white text-xs font-bold rounded-lg shadow-lg shadow-[var(--color-primary)]/25">
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
