'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useCart } from './CartContext'
import { CartButton } from './CartButton'

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  images: string[] | null
  attributes: { key: string; value: string }[]
}

interface ProductDetailClientProps {
  product: Product
  slug: string
  storeIcon: string
}

export function ProductDetailClient({ product, slug, storeIcon }: ProductDetailClientProps) {
  const router = useRouter()
  const { add } = useCart()
  const [selectedImage, setSelectedImage] = useState(0)
  const [added, setAdded] = useState(false)

  function handleAddToCart() {
    add({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      image: product.images?.[0],
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  const images = product.images ?? []

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Top bar: back + cart */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm font-bold text-[var(--color-text)]/60 hover:text-[var(--color-text)] transition-colors"
        >
          <span className="text-lg">←</span>
          Back
        </button>
        <CartButton />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Images */}
        <div className="space-y-3">
          <div className="aspect-square bg-gray-50 rounded-[var(--radius-card)] overflow-hidden relative">
            {images[selectedImage] ? (
              <Image src={images[selectedImage]} alt={product.name} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-8xl opacity-20">
                {storeIcon}
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden relative border-2 transition-colors ${
                    i === selectedImage ? 'border-[var(--color-primary)]' : 'border-transparent'
                  }`}
                >
                  <Image src={src} alt="" fill className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-black text-[var(--color-text)] leading-tight">{product.name}</h1>
            <p className="text-3xl font-black text-[var(--color-primary)] mt-2">
              RM {Number(product.price).toFixed(2)}
            </p>
          </div>

          {product.description && (
            <p className="text-[var(--color-text)]/60 leading-relaxed">{product.description}</p>
          )}

          {product.attributes.length > 0 && (
            <div className="space-y-2">
              {product.attributes.map(attr => (
                <div key={attr.key} className="flex items-center gap-3 text-sm">
                  <span className="text-[10px] uppercase tracking-widest font-extrabold text-gray-400 w-24 flex-shrink-0">
                    {attr.key.replace(/_/g, ' ')}
                  </span>
                  <span className="font-semibold text-[var(--color-text)]">{attr.value}</span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleAddToCart}
            className="w-full py-4 bg-[var(--color-primary)] text-white font-black text-base rounded-xl shadow-lg shadow-[var(--color-primary)]/25 hover:opacity-90 transition-all active:scale-95"
          >
            {added ? '✓ Added!' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  )
}
