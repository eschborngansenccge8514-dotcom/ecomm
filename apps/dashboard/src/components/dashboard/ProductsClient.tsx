'use client'
import { useState, useMemo } from 'react'
import Image     from 'next/image'
import { Button }  from '@/components/ui/button'
import { Input }   from '@/components/ui/input'
import { Badge }   from '@/components/ui/badge'
import { createClient }     from '@/lib/supabase/client'
import { ProductFormModal } from './ProductFormModal'
import toast  from 'react-hot-toast'
import { type StoreType }      from '@/lib/store-types'
import { Plus, Search, Pencil, Trash2, ToggleLeft, ToggleRight, LayoutGrid, List, Filter, ArrowUpDown, ChevronDown, CheckCircle2, AlertTriangle, PackageSearch, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ProductsClient({ products: initial, categories, merchantId, storeType }: {
  products: any[]; categories: any[]; merchantId: string; storeType: StoreType
}) {
  const [products, setProducts] = useState(initial)
  const [search, setSearch]     = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [catFilter, setCatFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all') // all, active, inactive, out_of_stock
  const [stockFilter, setStockFilter] = useState('all') // all, low, out
  const [sortBy, setSortBy] = useState('newest') // newest, price-asc, price-desc, stock-asc, stock-desc
  const [showForm, setShowForm]  = useState(false)
  const [editing, setEditing]    = useState<any>(null)

  const supabase = createClient()

  const filteredAndSorted = useMemo(() => {
    let result = products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          (p.sku?.toLowerCase().includes(search.toLowerCase()) ?? false)
      const matchCat    = catFilter === 'all' || p.category_id === catFilter
      const matchStatus = statusFilter === 'all' || p.status === statusFilter
      const matchStock  = stockFilter === 'all' || 
                          (stockFilter === 'low' && p.stock_quantity <= (p.low_stock_alert ?? 5) && p.stock_quantity > 0) ||
                          (stockFilter === 'out' && p.stock_quantity <= 0)
      
      return matchSearch && matchCat && matchStatus && matchStock
    })

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sortBy === 'price-asc') return Number(a.price) - Number(b.price)
      if (sortBy === 'price-desc') return Number(b.price) - Number(a.price)
      if (sortBy === 'stock-asc') return (a.stock_quantity || 0) - (b.stock_quantity || 0)
      if (sortBy === 'stock-desc') return (b.stock_quantity || 0) - (a.stock_quantity || 0)
      return 0
    })

    return result
  }, [products, search, catFilter, statusFilter, stockFilter, sortBy])

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return
    if (!confirm(`Delete ${selectedIds.length} products? This cannot be undone.`)) return
    const { error } = await supabase.from('products').delete().in('id', selectedIds)
    if (error) { toast.error(error.message); return }
    setProducts(prev => prev.filter(p => !selectedIds.includes(p.id)))
    setSelectedIds([])
    toast.success(`${selectedIds.length} products deleted`)
  }

  const handleBulkStatus = async (status: string) => {
    if (!selectedIds.length) return
    const { error } = await supabase.from('products').update({ status }).in('id', selectedIds)
    if (error) { toast.error(error.message); return }
    setProducts(prev => prev.map(p => selectedIds.includes(p.id) ? { ...p, status } : p))
    setSelectedIds([])
    toast.success(`Updated ${selectedIds.length} products`)
  }

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
    <div className="space-y-6">
      {/* Advanced Toolbar */}
      <div className="bg-white/80 backdrop-blur-md sticky top-0 z-30 py-4 border-b border-gray-100 -mx-4 px-4 sm:-mx-8 sm:px-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Products</h1>
              <Badge variant="outline" className="bg-blue-50/50 text-blue-600 border-blue-100 font-medium">
                {products.length} total
              </Badge>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex bg-gray-100 p-1 rounded-xl shrink-0">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn('p-1.5 rounded-lg transition-all', viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700')}
                >
                  <LayoutGrid size={18} />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={cn('p-1.5 rounded-lg transition-all', viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700')}
                >
                  <List size={18} />
                </button>
              </div>
              <Button onClick={() => { setEditing(null); setShowForm(true) }} className="rounded-xl shadow-sm bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none">
                <Plus size={18} className="mr-1.5" /> Add Product
              </Button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  className="pl-9 w-full sm:w-64 bg-gray-50/50 border-gray-200 focus:bg-white rounded-xl transition-all"
                  placeholder="Search name or SKU..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              {/* Category Dropdown/Filter */}
              <select
                value={catFilter}
                onChange={e => setCatFilter(e.target.value)}
                className="h-10 bg-gray-50/50 border border-gray-200 rounded-xl px-3 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shrink-0"
              >
                <option value="all">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="h-10 bg-gray-50/50 border border-gray-200 rounded-xl px-3 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shrink-0"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>

              <select
                value={stockFilter}
                onChange={e => setStockFilter(e.target.value)}
                className="h-10 bg-gray-50/50 border border-gray-200 rounded-xl px-3 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shrink-0"
              >
                <option value="all">All Stock Levels</option>
                <option value="low">Low Stock</option>
                <option value="out">Out of Stock</option>
              </select>
            </div>

            <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto no-scrollbar py-1">
              <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100 shrink-0">
                <span className="text-[11px] font-bold text-gray-400 px-2 uppercase tracking-wider">Sort By</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="bg-transparent border-none text-sm font-medium text-gray-700 focus:ring-0 cursor-pointer pr-8"
                >
                  <option value="newest">Newest First</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="stock-asc">Stock: Low to High</option>
                  <option value="stock-desc">Stock: High to Low</option>
                </select>
              </div>
            </div>
          </div>

          {/* Selection Toolbar (Floating Style) */}
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between bg-blue-600 text-white px-4 py-2.5 rounded-2xl shadow-lg animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm">
                  {selectedIds.length}
                </div>
                <span className="font-medium">items selected</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBulkStatus('active')}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle2 size={14} /> Mark Active
                </button>
                <button
                  onClick={() => handleBulkStatus('inactive')}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <X size={14} /> Mark Inactive
                </button>
                <div className="w-px h-5 bg-white/20 mx-1" />
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-400 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <Trash2 size={14} /> Delete
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="ml-2 hover:bg-white/10 p-1.5 rounded-lg transition-colors"
                >
                   <X size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      {filteredAndSorted.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 py-32 text-center shadow-sm">
          <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <PackageSearch size={32} className="text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">No products found</h3>
          <p className="text-gray-400 text-sm max-w-xs mx-auto mt-1">Try adjusting your search or filters to find what you're looking for.</p>
          <Button variant="outline" className="mt-6 rounded-xl" onClick={() => { setEditing(null); setShowForm(true) }}>
            Add your first product
          </Button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAndSorted.map(product => (
            <div key={product.id}
              className={cn("bg-white rounded-3xl border border-gray-100 overflow-hidden group hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 flex flex-col relative",
                selectedIds.includes(product.id) && "ring-2 ring-blue-500")}
            >
              {/* Checkbox Overlay */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIds(prev => prev.includes(product.id) ? prev.filter(id => id !== product.id) : [...prev, product.id])
                }}
                className={cn("absolute top-3 left-3 z-10 w-6 h-6 rounded-lg border-2 cursor-pointer transition-all flex items-center justify-center",
                  selectedIds.includes(product.id) ? "bg-blue-600 border-blue-600" : "bg-white/80 backdrop-blur-sm border-white/50 opacity-0 group-hover:opacity-100")}
              >
                {selectedIds.includes(product.id) && <CheckCircle2 size={14} className="text-white" />}
              </div>

              {/* Image */}
              <div className="relative aspect-square bg-gray-50">
                {product.images?.[0] ? (
                  <Image src={product.images[0]} alt={product.name}
                    fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw" className="object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="flex items-center justify-center h-full text-4xl bg-gradient-to-br from-gray-50 to-gray-100">🛍️</div>
                )}
                
                {/* Status badge */}
                <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
                  <span className={cn('text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-sm backdrop-blur-md',
                    product.status === 'active' ? 'bg-green-500/90 text-white' : 'bg-gray-500/90 text-white')}>
                    {product.status}
                  </span>
                  {product.is_featured && (
                    <span className="bg-amber-400 text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-sm">
                      Featured
                    </span>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="p-4 flex flex-col flex-1">
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">
                    {product.category?.name || 'Uncategorized'}
                  </p>
                  <h3 className="font-bold text-gray-900 text-base leading-snug mb-1 group-hover:text-blue-600 transition-colors">
                    {product.name}
                  </h3>
                  {product.sku && <p className="text-xs text-gray-400 mb-2 font-mono">{product.sku}</p>}
                  
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-gray-900 font-extrabold text-lg">
                      RM {Number(product.price).toFixed(2)}
                    </p>
                    {product.compare_at_price > 0 && (
                      <p className="text-gray-400 line-through text-xs">
                        RM {Number(product.compare_at_price).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Stock indicator */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Stock</span>
                    <div className="flex items-center gap-1.5">
                      <div className={cn("w-2 h-2 rounded-full", 
                        product.stock_quantity <= 0 ? "bg-red-500" : 
                        product.stock_quantity <= (product.low_stock_alert ?? 5) ? "bg-amber-500" : "bg-green-500")} />
                      <span className={cn("text-xs font-bold", 
                        product.stock_quantity <= 0 ? "text-red-600" : 
                        product.stock_quantity <= (product.low_stock_alert ?? 5) ? "text-amber-600" : "text-gray-700")}>
                        {product.stock_quantity}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Variants</span>
                    <p className="text-xs font-bold text-gray-700">{product.variants?.length ?? 0}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 mt-auto">
                  <Button variant="outline" size="sm" className="rounded-xl border-gray-200" onClick={() => { setEditing(product); setShowForm(true) }}>
                    <Pencil size={14} className="mr-1.5" /> Edit
                  </Button>
                  <Button 
                    variant={product.status === 'active' ? 'ghost' : 'outline'} 
                    size="sm" 
                    className={cn("rounded-xl transition-all", 
                      product.status === 'active' ? "text-gray-500 hover:text-amber-600 hover:bg-amber-50" : "text-green-600 border-green-100 bg-green-50 hover:bg-green-100")}
                    onClick={() => handleToggle(product)}
                  >
                    {product.status === 'active' ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 w-10">
                    <div 
                      onClick={() => setSelectedIds(selectedIds.length === filteredAndSorted.length ? [] : filteredAndSorted.map(p => p.id))}
                      className={cn("w-5 h-5 rounded-md border-2 cursor-pointer transition-all flex items-center justify-center",
                        selectedIds.length > 0 && selectedIds.length === filteredAndSorted.length ? "bg-blue-600 border-blue-600" : 
                        selectedIds.length > 0 ? "bg-blue-200 border-blue-400" : "bg-white border-gray-300")}
                    >
                      {selectedIds.length === filteredAndSorted.length && <CheckCircle2 size={12} className="text-white" />}
                      {selectedIds.length > 0 && selectedIds.length < filteredAndSorted.length && <div className="w-2 h-0.5 bg-blue-600 rounded-full" />}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">SKU</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider text-right">Price</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredAndSorted.map(product => (
                  <tr key={product.id} className={cn("hover:bg-blue-50/30 transition-colors group", selectedIds.includes(product.id) && "bg-blue-50/50")}>
                    <td className="px-6 py-4">
                      <div 
                        onClick={() => setSelectedIds(prev => prev.includes(product.id) ? prev.filter(id => id !== product.id) : [...prev, product.id])}
                        className={cn("w-5 h-5 rounded-md border-2 cursor-pointer transition-all flex items-center justify-center",
                          selectedIds.includes(product.id) ? "bg-blue-600 border-blue-600" : "bg-white border-gray-300 group-hover:border-gray-400")}
                      >
                        {selectedIds.includes(product.id) && <CheckCircle2 size={12} className="text-white" />}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gray-50 shrink-0">
                          {product.images?.[0] ? (
                            <Image src={product.images[0]} alt="" fill sizes="48px" className="object-cover" />
                          ) : (
                            <div className="flex items-center justify-center h-full text-xl bg-gray-100">🛍️</div>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{product.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {product.is_featured && <Badge className="text-[8px] h-4 bg-amber-400">Featured</Badge>}
                            {product.variants?.length > 0 && <span className="text-[10px] text-gray-400 font-medium">{product.variants.length} variants</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono text-gray-500">{product.sku || '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                        {product.category?.name || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <div className={cn("w-1.5 h-1.5 rounded-full", 
                            product.stock_quantity <= 0 ? "bg-red-500" : 
                            product.stock_quantity <= (product.low_stock_alert ?? 5) ? "bg-amber-500" : "bg-green-500")} />
                          <span className={cn("text-sm font-bold", 
                            product.stock_quantity <= 0 ? "text-red-600" : 
                            product.stock_quantity <= (product.low_stock_alert ?? 5) ? "text-amber-600" : "text-gray-900")}>
                            {product.stock_quantity}
                          </span>
                        </div>
                        {product.stock_quantity <= (product.low_stock_alert ?? 5) && product.stock_quantity > 0 && (
                          <span className="text-[9px] font-black text-amber-500 uppercase tracking-tighter">Low Stock</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-black text-gray-900 text-sm">RM {Number(product.price).toFixed(2)}</span>
                        {product.compare_at_price > 0 && (
                          <span className="text-[10px] text-gray-400 line-through">RM {Number(product.compare_at_price).toFixed(2)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn('text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-sm',
                        product.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>
                        {product.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditing(product); setShowForm(true) }}
                          className="p-2 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleToggle(product)}
                          className={cn("p-2 rounded-lg transition-colors", 
                            product.status === 'active' ? "hover:bg-amber-100 text-amber-600" : "hover:bg-green-100 text-green-600")}
                        >
                          {product.status === 'active' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        </button>
                        <button
                          onClick={() => handleDelete(product)}
                          className="p-2 hover:bg-red-100 rounded-lg text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
