'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCart } from './CartContext'

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  images: string[] | null
  attributes: { key: string; value: string }[]
}

interface ProductGridProps {
  products: Product[]
  slug: string
  storeIcon: string
}

export function ProductGrid({ products, slug, storeIcon }: ProductGridProps) {
  const { add } = useCart()

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map(p => (
        <div key={p.id} className="bg-white border border-gray-100 rounded-[var(--radius-card)] overflow-hidden shadow-sm hover:shadow-xl transition-all group">
          <Link href={`/store/${slug}/product/${p.id}`}>
            <div className="aspect-square bg-gray-50 relative overflow-hidden">
              {p.images?.[0] ? (
                <Image src={p.images[0]} alt={p.name} fill className="object-cover group-hover:scale-105 transition-transform" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">
                  {storeIcon}
                </div>
              )}
            </div>
          </Link>

          <div className="p-4 space-y-2">
            <Link href={`/store/${slug}/product/${p.id}`}>
              <h3 className="font-bold text-lg text-[var(--color-text)] leading-tight hover:text-[var(--color-primary)] transition-colors">{p.name}</h3>
            </Link>
            <p className="text-sm text-[var(--color-text)]/50 line-clamp-2">{p.description}</p>

            {p.attributes.length > 0 && (
              <div className="flex flex-wrap gap-2 py-2">
                {p.attributes.map(attr => (
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
              <button
                onClick={() => add({ id: p.id, name: p.name, price: Number(p.price), image: p.images?.[0] })}
                className="px-4 py-2 bg-[var(--color-primary)] text-white text-xs font-bold rounded-lg shadow-lg shadow-[var(--color-primary)]/25 hover:opacity-90 transition-opacity"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
