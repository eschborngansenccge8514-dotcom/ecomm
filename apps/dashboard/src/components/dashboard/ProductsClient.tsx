'use client'
import { useState, useMemo } from 'react'
import Image     from 'next/image'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { Badge }  from '@/components/ui/badge'
import { createClient }   from '@/lib/supabase/client'
import { ProductFormModal } from './ProductFormModal'
import toast  from 'react-hot-toast'
import { type StoreType }      from '@/lib/store-types'
import { Plus, Search, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ProductsClient({ products: initial, categories, merchantId, storeType }: {
  products: any[]; categories: any[]; merchantId: string; storeType: StoreType
}) {
  const [products, setProducts] = useState(initial)
  const [search, setSearch]     = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [showForm, setShowForm]  = useState(false)
  const [editing, setEditing]    = useState<any>(null)

  const supabase = createClient()

  const filtered = useMemo(() =>
    products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
      const matchCat    = catFilter === 'all' || p.category_id === catFilter
      return matchSearch && matchCat
    }),
  [products, search, catFilter])

  const handleToggle = async (product: any) => {
    const next = product.status === 'active' ? 'inactive' : 'active'
    const { error } = await supabase.from('products').update({ status: next }).eq('id', product.id)
    if (error) { toast.error(error.message); return }
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, status: next } : p))
  }

  const handleDelete = async (product: any) => {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('products').delete().eq('id', product.id)
    if (error) { toast.error(error.message); return }
    setProducts(prev => prev.filter(p => p.id !== product.id))
    toast.success('Product deleted')
  }

  const handleSaved = (saved: any, isNew: boolean) => {
    setProducts(prev =>
      isNew ? [saved, ...prev] : prev.map(p => p.id === saved.id ? { ...p, ...saved } : p)
    )
    setShowForm(false)
    setEditing(null)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {/* Category tabs */}
          <button
            onClick={() => setCatFilter('all')}
            className={cn('px-3 py-1.5 rounded-xl text-sm font-medium transition-colors',
              catFilter === 'all' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50')}
          >
            All ({products.length})
          </button>
          {categories.map(c => (
            <button key={c.id}
              onClick={() => setCatFilter(c.id)}
              className={cn('px-3 py-1.5 rounded-xl text-sm font-medium transition-colors',
                catFilter === c.id ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50')}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2 shrink-0">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input className="pl-8 w-48" placeholder="Search products..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button onClick={() => { setEditing(null); setShowForm(true) }}>
            <Plus size={16} className="mr-1" /> Add Product
          </Button>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-20 text-center">
          <p className="text-gray-400 text-sm">No products found</p>
          <Button variant="outline" className="mt-3" onClick={() => { setEditing(null); setShowForm(true) }}>
            Add your first product
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(product => (
            <div key={product.id}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden group hover:shadow-md transition-shadow"
            >
              {/* Image */}
              <div className="relative aspect-square bg-gray-50">
                {product.images?.[0] ? (
                  <Image src={product.images[0]} alt={product.name}
                    fill className="object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-3xl">🛍️</div>
                )}
                {/* Hover actions */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => { setEditing(product); setShowForm(true) }}
                    className="w-9 h-9 bg-white rounded-xl flex items-center justify-center hover:bg-blue-50 transition-colors"
                  >
                    <Pencil size={15} className="text-gray-700" />
                  </button>
                  <button
                    onClick={() => handleDelete(product)}
                    className="w-9 h-9 bg-white rounded-xl flex items-center justify-center hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={15} className="text-red-500" />
                  </button>
                </div>
                {/* Status badge */}
                <div className="absolute top-2 right-2">
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                    product.status === 'active' ? 'bg-green-500 text-white' : 'bg-gray-400 text-white')}>
                    {product.status}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="font-semibold text-gray-900 text-sm truncate">{product.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-blue-600 font-bold text-sm">RM {Number(product.price).toFixed(2)}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <span>{product.variants?.length ?? 0} variants</span>
                  </div>
                </div>
                {/* Toggle */}
                <button
                  onClick={() => handleToggle(product)}
                  className={cn('mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-medium transition-colors',
                    product.status === 'active'
                      ? 'bg-green-50 text-green-700 hover:bg-red-50 hover:text-red-600'
                      : 'bg-gray-50 text-gray-500 hover:bg-green-50 hover:text-green-700')}
                >
                  {product.status === 'active'
                    ? <><ToggleRight size={14} /> Active — tap to deactivate</>
                    : <><ToggleLeft  size={14} /> Inactive — tap to activate</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <ProductFormModal
          merchantId={merchantId}
          categories={categories}
          product={editing}
          storeType={storeType}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
