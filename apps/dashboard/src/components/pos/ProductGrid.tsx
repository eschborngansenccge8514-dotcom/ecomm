'use client'
import { PosProduct } from '@project1/domain'
import { Plus } from 'lucide-react'
import Image from 'next/image'
import { useRef, useMemo, useEffect, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'

interface ProductGridProps {
  products: PosProduct[]
  onSelect: (product: PosProduct) => void
}

export function ProductGrid({ products, onSelect }: ProductGridProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(4)

  // Responsive column calculation
  useEffect(() => {
    const updateColumns = () => {
      if (!parentRef.current) return
      const width = parentRef.current.offsetWidth
      if (width < 640) setColumns(2)
      else if (width < 1024) setColumns(3)
      else if (width < 1280) setColumns(4)
      else setColumns(5)
    }

    updateColumns()
    window.addEventListener('resize', updateColumns)
    return () => window.removeEventListener('resize', updateColumns)
  }, [])

  const rows = useMemo(() => {
    const r = []
    for (let i = 0; i < products.length; i += columns) {
      r.push(products.slice(i, i + columns))
    }
    return r
  }, [products, columns])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 280, // Approximate row height
    overscan: 3,
  })

  const virtualRows = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  if (products.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
        <p className="text-lg font-medium">No products found</p>
        <p className="text-sm">Try adjusting your search or category</p>
      </div>
    )
  }

  return (
    <div 
      ref={parentRef}
      className="max-h-[800px] overflow-auto no-scrollbar scroll-smooth p-1"
    >
      <div
        style={{
          height: `${totalSize}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualRows.map((virtualRow) => (
          <div
            key={virtualRow.key}
            className="grid gap-4 absolute top-0 left-0 w-full"
            style={{
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              paddingBottom: '16px', // Gap equivalent
            }}
          >
            {rows[virtualRow.index].map((product) => (
              <ProductCard 
                key={`${product.id}-${product.variantId || ''}`} 
                product={product} 
                onClick={() => onSelect(product)} 
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function ProductCard({ product, onClick }: { product: PosProduct; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative bg-white rounded-2xl p-3 border border-slate-200 shadow-sm hover:shadow-md transition-all active:scale-95 text-left flex flex-col h-full overflow-hidden",
        product.stockQty <= 0 && "opacity-60 grayscale-[0.5]"
      )}
    >
      {/* Image or Placeholder */}
      <div className="aspect-square rounded-xl bg-slate-50 mb-3 overflow-hidden relative">
        {product.imageUrl ? (
          <Image 
            src={product.imageUrl} 
            alt={product.name} 
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold text-2xl">
            {product.name.charAt(0)}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col">
        <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 leading-tight mb-1 group-hover:text-amber-600 transition-colors">
          {product.name}
        </h3>
        <p className="text-xs text-slate-500 font-mono mb-2">{product.sku}</p>
        
        <div className="mt-auto flex items-center justify-between">
          <p className="text-sm font-bold text-slate-900">
            RM {product.unitPrice.toFixed(2)}
          </p>
          <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Plus size={16} />
          </div>
        </div>
      </div>
      
      {/* Stock indicator badge */}
      {product.stockQty < 10 && (
        <div className="absolute top-4 right-4 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
          {product.stockQty} left
        </div>
      )}
    </button>
  )
}
