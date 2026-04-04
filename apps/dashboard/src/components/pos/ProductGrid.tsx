'use client'

import { PosProduct } from '@project1/domain'
import { Plus } from 'lucide-react'

interface ProductGridProps {
  products: PosProduct[]
  onSelect: (product: PosProduct) => void
}

export function ProductGrid({ products, onSelect }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400">
        <p className="text-lg font-medium">No products found</p>
        <p className="text-sm">Try adjusting your search or category</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {products.map((product) => (
        <ProductCard 
          key={`${product.id}-${product.variantId || ''}`} 
          product={product} 
          onClick={() => onSelect(product)} 
        />
      ))}
    </div>
  )
}

function ProductCard({ product, onClick }: { product: PosProduct; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative bg-white rounded-2xl p-3 border border-slate-200 shadow-sm hover:shadow-md transition-all active:scale-95 text-left flex flex-col h-full overflow-hidden"
    >
      {/* Image or Placeholder */}
      <div className="aspect-square rounded-xl bg-slate-100 mb-3 overflow-hidden">
        {product.imageUrl ? (
          <img 
            src={product.imageUrl} 
            alt={product.name} 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
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
