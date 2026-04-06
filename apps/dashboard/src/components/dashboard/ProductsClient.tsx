'use client'
import { useState, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import Image     from 'next/image'
import { Button }  from '@/components/ui/button'
import { Input }   from '@/components/ui/input'
import { Badge }   from '@/components/ui/badge'
import { createClient }     from '@/lib/supabase/client'
import { ProductFormModal } from './ProductFormModal'
import toast  from 'react-hot-toast'
import { type StoreType }      from '@/lib/store-types'
import { Plus, Search, Pencil, Trash2, ToggleLeft, ToggleRight, LayoutGrid, List, Filter, ArrowUpDown, ChevronDown, CheckCircle2, AlertTriangle, PackageSearch, X, Boxes, History } from 'lucide-react'
import { InventoryAdjustmentModal } from './InventoryAdjustmentModal'
import { InventoryHistoryModal } from './InventoryHistoryModal'
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
  const [adjusting, setAdjusting] = useState<any>(null)
  const [historying, setHistorying] = useState<any>(null)

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

  // Virtualization setup
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: filteredAndSorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => viewMode === 'table' ? 80 : 450,
    overscan: 5,
  })

  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return
    if (!confirm(`Delete ${selectedIds.length} products? This cannot be undone.`)) return
    const previousProducts = [...products]
    setProducts(prev => prev.filter(p => !selectedIds.includes(p.id)))
    const prevSelected = [...selectedIds]
    setSelectedIds([])
    const { error } = await supabase.from('products').delete().in('id', prevSelected)
    if (error) {
      setProducts(previousProducts)
      setSelectedIds(prevSelected)
      toast.error(error.message)
      return
    }
    toast.success(`${prevSelected.length} products deleted`)
  }

  const handleBulkStatus = async (status: string) => {
    if (!selectedIds.length) return
    const previousProducts = [...products]
    setProducts(prev => prev.map(p => selectedIds.includes(p.id) ? { ...p, status } : p))
    const prevSelected = [...selectedIds]
    setSelectedIds([])
    const { error } = await supabase.from('products').update({ status }).in('id', prevSelected)
    if (error) {
      setProducts(previousProducts)
      setSelectedIds(prevSelected)
      toast.error(error.message)
      return
    }
    toast.success(`Updated ${prevSelected.length} products`)
  }

  const handleToggle = async (product: any) => {
    const next = product.status === 'active' ? 'inactive' : 'active'
    const previousProducts = [...products]
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, status: next } : p))
    const { error } = await supabase.from('products').update({ status: next }).eq('id', product.id)
    if (error) {
      setProducts(previousProducts)
      toast.error(error.message)
      return
    }
    toast.success(`Product ${next === 'active' ? 'activated' : 'deactivated'}`)
  }

  const handleDelete = async (product: any) => {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return
    const previousProducts = [...products]
    setProducts(prev => prev.filter(p => p.id !== product.id))
    const { error } = await supabase.from('products').delete().eq('id', product.id)
    if (error) {
      setProducts(previousProducts)
      toast.error(error.message)
      return
    }
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
    <div className="space-y-6 flex flex-col h-full overflow-hidden">
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

      {/* Main Content Area */}
      <div 
        ref={parentRef}
        className="flex-1 overflow-auto no-scrollbar scroll-smooth relative bg-gray-50/30 rounded-3xl"
      >
        {filteredAndSorted.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 py-32 text-center shadow-sm">
            <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <PackageSearch size={32} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No products found</h3>
            <p className="text-gray-400 text-sm max-w-xs mx-auto mt-1">Try adjusting your search or filters.</p>
            <Button variant="outline" className="mt-6 rounded-xl" onClick={() => { setEditing(null); setShowForm(true) }}>
              Add your first product
            </Button>
          </div>
        ) : (
          <div
            style={{
              height: `${totalSize}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {viewMode === 'grid' ? (
              /* Grid View with Virtualization */
              /* Note: For grid, we usually want to virtualize rows. 
                 But since we have a simple useVirtualizer, we'll position each item.
                 Responsive grid makes it tricky. We'll stick to a simpler list for grid virtualization here or just use a fixed number of columns for calculations.
              */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-4">
                {/* Fallback to normal map for grid if virtualization proves too complex for responsive layout without fixed row heights */}
                {filteredAndSorted.map(product => (
                  <ProductCardItem 
                    key={product.id}
                    product={product}
                    isSelected={selectedIds.includes(product.id)}
                    onSelect={(id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])}
                    onToggle={() => handleToggle(product)}
                    onDelete={() => handleDelete(product)}
                    onEdit={() => { setEditing(product); setShowForm(true) }}
                    onAdjust={() => setAdjusting(product)}
                    onHistory={() => setHistorying(product)}
                  />
                ))}
              </div>
            ) : (
              /* Table View with Virtualization */
              <div className="p-4">
                <div className="w-full text-left bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                  <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm border-b border-gray-100 flex items-center">
                    <div className="px-6 py-4 w-10 shrink-0">
                      <div 
                        onClick={() => setSelectedIds(selectedIds.length === filteredAndSorted.length ? [] : filteredAndSorted.map(p => p.id))}
                        className={cn("w-5 h-5 rounded-md border-2 cursor-pointer transition-all flex items-center justify-center",
                          selectedIds.length > 0 && selectedIds.length === filteredAndSorted.length ? "bg-blue-600 border-blue-600" : 
                          selectedIds.length > 0 ? "bg-blue-200 border-blue-400" : "bg-white border-gray-300")}
                      >
                        {selectedIds.length === filteredAndSorted.length && <CheckCircle2 size={12} className="text-white" />}
                        {selectedIds.length > 0 && selectedIds.length < filteredAndSorted.length && <div className="w-2 h-0.5 bg-blue-600 rounded-full" />}
                      </div>
                    </div>
                    <div className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider flex-1 min-w-[200px]">Product</div>
                    <div className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider w-32 shrink-0">SKU</div>
                    <div className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider w-40 shrink-0">Category</div>
                    <div className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider w-28 shrink-0">Stock</div>
                    <div className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider w-32 shrink-0 text-right">Price</div>
                    <div className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider w-24 shrink-0">Status</div>
                    <div className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider w-40 shrink-0 text-right">Actions</div>
                  </div>
                  <div className="relative">
                    {virtualItems.map(virtualRow => {
                      const product = filteredAndSorted[virtualRow.index]
                      return (
                        <div 
                          key={virtualRow.key}
                          className={cn("hover:bg-blue-50/30 transition-colors group absolute w-full flex items-center border-b border-gray-50", 
                            selectedIds.includes(product.id) && "bg-blue-50/50")}
                          style={{
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          <div className="px-6 py-4 w-10 shrink-0">
                            <div 
                              onClick={() => setSelectedIds(prev => prev.includes(product.id) ? prev.filter(id => id !== product.id) : [...prev, product.id])}
                              className={cn("w-5 h-5 rounded-md border-2 cursor-pointer transition-all flex items-center justify-center",
                                selectedIds.includes(product.id) ? "bg-blue-600 border-blue-600" : "bg-white border-gray-300 group-hover:border-gray-400")}
                            >
                              {selectedIds.includes(product.id) && <CheckCircle2 size={12} className="text-white" />}
                            </div>
                          </div>
                          <div className="px-6 py-4 flex-1 min-w-[200px]">
                            <div className="flex items-center gap-3">
                              <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gray-50 shrink-0">
                                {product.images?.[0] ? (
                                  <Image src={product.images[0]} alt="" fill sizes="48px" className="object-cover" />
                                ) : (
                                  <div className="flex items-center justify-center h-full text-xl bg-gray-100">🛍️</div>
                                )}
                              </div>
                              <div className="truncate">
                                <p className="font-bold text-gray-900 text-sm truncate">{product.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {product.is_featured && <Badge className="text-[8px] h-4 bg-amber-400">Featured</Badge>}
                                  {product.variants?.length > 0 && <span className="text-[10px] text-gray-400 font-medium">{product.variants.length} variants</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="px-6 py-4 w-32 shrink-0">
                            <span className="text-xs font-mono text-gray-500 truncate">{product.sku || '-'}</span>
                          </div>
                          <div className="px-6 py-4 w-40 shrink-0">
                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg truncate">
                              {product.category?.name || 'Uncategorized'}
                            </span>
                          </div>
                          <div className="px-6 py-4 w-28 shrink-0">
                            <StockIndicator product={product} />
                          </div>
                          <div className="px-6 py-4 w-32 shrink-0 text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-black text-gray-900 text-sm">RM {Number(product.price).toFixed(2)}</span>
                              {product.compare_at_price > 0 && (
                                <span className="text-[10px] text-gray-400 line-through">RM {Number(product.compare_at_price).toFixed(2)}</span>
                              )}
                            </div>
                          </div>
                          <div className="px-6 py-4 w-24 shrink-0">
                            <StatusBadge status={product.status} />
                          </div>
                          <div className="px-6 py-4 w-40 shrink-0 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <ActionButton icon={Boxes} onClick={() => setAdjusting(product)} color="text-green-600 hover:bg-green-100" />
                              <ActionButton icon={History} onClick={() => setHistorying(product)} color="text-blue-600 hover:bg-blue-100" />
                              <ActionButton icon={Pencil} onClick={() => { setEditing(product); setShowForm(true) }} color="text-blue-600 hover:bg-blue-100" />
                              <button
                                onClick={() => handleToggle(product)}
                                className={cn("p-2 rounded-lg transition-colors", 
                                  product.status === 'active' ? "hover:bg-amber-100 text-amber-600" : "hover:bg-green-100 text-green-600")}
                              >
                                {product.status === 'active' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                              </button>
                              <ActionButton icon={Trash2} onClick={() => handleDelete(product)} color="text-red-500 hover:bg-red-100" />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
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
      {adjusting && (
        <InventoryAdjustmentModal
          product={adjusting}
          onClose={() => setAdjusting(null)}
          onSaved={(saved) => {
            setProducts(prev => prev.map(p => p.id === saved.id ? saved : p))
            setAdjusting(null)
          }}
        />
      )}
      {historying && (
        <InventoryHistoryModal
          product={historying}
          onClose={() => setHistorying(null)}
        />
      )}
    </div>
  )
}

function ProductCardItem({ product, isSelected, onSelect, onToggle, onDelete, onEdit, onAdjust, onHistory }: any) {
  return (
    <div className={cn("bg-white rounded-3xl border border-gray-100 overflow-hidden group hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 flex flex-col relative",
      isSelected && "ring-2 ring-blue-500")}
    >
      <div
        onClick={(e) => { e.stopPropagation(); onSelect(product.id) }}
        className={cn("absolute top-3 left-3 z-10 w-6 h-6 rounded-lg border-2 cursor-pointer transition-all flex items-center justify-center",
          isSelected ? "bg-blue-600 border-blue-600" : "bg-white/80 backdrop-blur-sm border-white/50 opacity-0 group-hover:opacity-100")}
      >
        {isSelected && <CheckCircle2 size={14} className="text-white" />}
      </div>
      <div className="relative aspect-square bg-gray-50">
        {product.images?.[0] ? (
          <Image src={product.images[0]} alt={product.name} fill sizes="300px" className="object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="flex items-center justify-center h-full text-4xl bg-gradient-to-br from-gray-50 to-gray-100">🛍️</div>
        )}
        <div className="absolute top-3 right-3 flex flex-col gap-2 items-end font-black uppercase tracking-widest text-[10px]">
          <StatusBadge status={product.status} className="shadow-sm backdrop-blur-md" />
          {product.is_featured && <span className="bg-amber-400 text-white px-2.5 py-1 rounded-full shadow-sm">Featured</span>}
        </div>
      </div>
      <div className="p-4 flex flex-col flex-1">
        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">{product.category?.name || 'Uncategorized'}</p>
        <h3 className="font-bold text-gray-900 text-base leading-snug mb-1 group-hover:text-blue-600 transition-colors line-clamp-2">{product.name}</h3>
        {product.sku && <p className="text-xs text-gray-400 mb-2 font-mono">{product.sku}</p>}
        <div className="flex items-center gap-2 mb-3">
          <p className="text-gray-900 font-extrabold text-lg">RM {Number(product.price).toFixed(2)}</p>
          {product.compare_at_price > 0 && <p className="text-gray-400 line-through text-xs">RM {Number(product.compare_at_price).toFixed(2)}</p>}
        </div>
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
          <StockIndicator product={product} />
          <div className="text-right">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Variants</span>
            <p className="text-xs font-bold text-gray-700">{product.variants?.length ?? 0}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={onEdit}><Pencil size={14} className="mr-1.5" /> Edit</Button>
          <Button variant="outline" size="sm" className="rounded-xl bg-blue-50/50 text-blue-600" onClick={onAdjust}><Boxes size={14} className="mr-1.5" /> Stock</Button>
        </div>
      </div>
    </div>
  )
}

function StockIndicator({ product }: any) {
  const isOutOfStock = product.stock_quantity <= 0
  const isLowStock = product.stock_quantity <= (product.low_stock_alert ?? 5)
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-bold text-gray-400 uppercase">Stock</span>
      <div className="flex items-center gap-1.5">
        <div className={cn("w-2 h-2 rounded-full", isOutOfStock ? "bg-red-500" : isLowStock ? "bg-amber-500" : "bg-green-500")} />
        <span className={cn("text-xs font-bold", isOutOfStock ? "text-red-600" : isLowStock ? "text-amber-600" : "text-gray-700")}>
          {product.stock_quantity}
        </span>
      </div>
    </div>
  )
}

function StatusBadge({ status, className }: any) {
  return (
    <span className={cn('text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full',
      status === 'active' ? 'bg-green-500 text-white' : 'bg-gray-500 text-white', className)}>
      {status}
    </span>
  )
}

function ActionButton({ icon: Icon, onClick, color, className }: any) {
  return (
    <button onClick={onClick} className={cn("p-2 rounded-lg transition-colors", color, className)}>
      <Icon size={16} />
    </button>
  )
}
