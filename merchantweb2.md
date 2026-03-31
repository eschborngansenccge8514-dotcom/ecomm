<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Continue building the merchant dashboard, so many features are still missing.

Here are all the missing features — 15 files covering Products, Categories, Customers, Analytics, Delivery booking, real-time order alerts with sound, and CSV exports.[^1][^2]

***

## New Dependencies

```bash
cd dashboard
npm install recharts date-fns lucide-react
npm install @radix-ui/react-dialog @radix-ui/react-select
# shadcn components not yet added:
npx shadcn@latest add dialog select textarea switch tabs progress
```


***

## File 1 — `src/lib/utils.server.ts`

Shared server utilities used across all server components:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'

export async function getMerchant() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: merchant } = await supabase
    .from('merchants').select('*').eq('user_id', user.id).single()
  if (!merchant) redirect('/login')
  return { supabase, user, merchant }
}

export function formatCurrency(amount: number): string {
  return `RM ${Number(amount).toFixed(2)}`
}
```


***

## File 2 — `src/components/dashboard/NewOrderListener.tsx`

Real-time new order bell + sound alert, mounted once in the layout.[^2]

```typescript
'use client'
import { useEffect, useRef, useCallback } from 'react'
import { useRouter }    from 'next/navigation'
import toast            from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { ShoppingBag }  from 'lucide-react'

export function NewOrderListener({ merchantId }: { merchantId: string }) {
  const router    = useRouter()
  const audioRef  = useRef<AudioContext | null>(null)
  const isFirst   = useRef(true)   // skip initial snapshot

  const playChime = useCallback(() => {
    try {
      const ctx  = new AudioContext()
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type      = 'sine'
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3)
      gain.gain.setValueAtTime(0.4, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.6)
    } catch {}
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel  = supabase
      .channel(`new-orders-${merchantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `merchant_id=eq.${merchantId}` },
        (payload) => {
          if (isFirst.current) { isFirst.current = false; return }
          const order = payload.new as any
          playChime()
          toast.custom((t) => (
            <div
              onClick={() => { router.push(`/orders/${order.id}`); toast.dismiss(t.id) }}
              className={`flex items-center gap-3 bg-white border-2 border-blue-500 rounded-2xl shadow-lg px-4 py-3 cursor-pointer max-w-sm
                ${t.visible ? 'animate-enter' : 'animate-leave'}`}
            >
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                <ShoppingBag size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">New Order! 🎉</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  {order.order_number} · RM {Number(order.total_amount).toFixed(2)}
                </p>
              </div>
            </div>
          ), { duration: 8000, position: 'top-right' })
          router.refresh()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [merchantId, playChime, router])

  return null
}
```

Add it to `DashboardLayout` in `layout.tsx`:

```typescript
// After <Header .../> in layout.tsx:
<NewOrderListener merchantId={merchant.id} />
```


***

## File 3 — `src/app/(dashboard)/products/page.tsx`

```typescript
import { getMerchant }    from '@/lib/utils.server'
import { ProductsClient } from '@/components/dashboard/ProductsClient'

export default async function ProductsPage() {
  const { supabase, merchant } = await getMerchant()

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase
      .from('products')
      .select('*, category:categories(name), variants:product_variants(id)')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('categories')
      .select('id, name')
      .eq('merchant_id', merchant.id)
      .order('name'),
  ])

  return (
    <ProductsClient
      products={products ?? []}
      categories={categories ?? []}
      merchantId={merchant.id}
    />
  )
}
```


***

## File 4 — `src/components/dashboard/ProductsClient.tsx`

Full product list with toggle, delete, search, and per-category filter:

```typescript
'use client'
import { useState, useMemo } from 'react'
import Image     from 'next/image'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { Badge }  from '@/components/ui/badge'
import { createClient }   from '@/lib/supabase/client'
import { ProductFormModal } from './ProductFormModal'
import toast  from 'react-hot-toast'
import { Plus, Search, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ProductsClient({ products: initial, categories, merchantId }: {
  products: any[]; categories: any[]; merchantId: string
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
                {product.images?.[^0] ? (
                  <Image src={product.images[^0]} alt={product.name}
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
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
```


***

## File 5 — `src/components/dashboard/ProductFormModal.tsx`

Full product editor: image upload, price, variants, category, stock:[^1]

```typescript
'use client'
import { useState, useRef, useEffect } from 'react'
import Image   from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Label }    from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch }   from '@/components/ui/switch'
import toast        from 'react-hot-toast'
import { X, Plus, Trash2, Upload, Loader2 } from 'lucide-react'

interface Variant { id?: string; name: string; price_modifier: number; stock_quantity: number }

export function ProductFormModal({ merchantId, categories, product, onClose, onSaved }: {
  merchantId: string; categories: any[]; product: any | null
  onClose: () => void; onSaved: (saved: any, isNew: boolean) => void
}) {
  const isNew   = !product
  const supabase = createClient()

  const [form, setForm] = useState({
    name:          product?.name        ?? '',
    description:   product?.description ?? '',
    price:         product?.price       ?? '',
    category_id:   product?.category_id ?? '',
    status:        product?.status      ?? 'active',
    weight_grams:  product?.weight_grams ?? 500,
    track_stock:   product?.track_stock  ?? false,
    stock_quantity: product?.stock_quantity ?? 0,
  })
  const [variants, setVariants]         = useState<Variant[]>(product?.full_variants ?? [])
  const [images, setImages]             = useState<string[]>(product?.images ?? [])
  const [uploading, setUploading]       = useState(false)
  const [saving, setSaving]             = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  // Image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      const urls: string[] = []
      for (const file of files.slice(0, 5 - images.length)) {
        const ext  = file.name.split('.').pop()
        const path = `${merchantId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error } = await supabase.storage
          .from('product-images')
          .upload(path, file, { cacheControl: '3600', upsert: false })
        if (error) throw error
        const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path)
        urls.push(publicUrl)
      }
      setImages(prev => [...prev, ...urls])
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`)
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeImage = (idx: number) =>
    setImages(prev => prev.filter((_, i) => i !== idx))

  // Variants
  const addVariant = () =>
    setVariants(prev => [...prev, { name: '', price_modifier: 0, stock_quantity: 0 }])
  const updateVariant = (idx: number, k: keyof Variant, v: any) =>
    setVariants(prev => prev.map((vr, i) => i === idx ? { ...vr, [k]: v } : vr))
  const removeVariant = (idx: number) =>
    setVariants(prev => prev.filter((_, i) => i !== idx))

  const handleSave = async () => {
    if (!form.name.trim())  { toast.error('Product name is required'); return }
    if (!form.price)        { toast.error('Price is required'); return }

    setSaving(true)
    try {
      const payload = {
        merchant_id:    merchantId,
        name:           form.name.trim(),
        description:    form.description,
        price:          Number(form.price),
        category_id:    form.category_id || null,
        status:         form.status,
        weight_grams:   Number(form.weight_grams),
        track_stock:    form.track_stock,
        stock_quantity: Number(form.stock_quantity),
        images,
      }

      let savedProduct: any
      if (isNew) {
        const { data, error } = await supabase.from('products').insert(payload).select('*').single()
        if (error) throw error
        savedProduct = data
      } else {
        const { data, error } = await supabase.from('products').update(payload)
          .eq('id', product.id).select('*').single()
        if (error) throw error
        savedProduct = data
      }

      // Upsert variants
      if (variants.length > 0) {
        const variantPayload = variants
          .filter(v => v.name.trim())
          .map(v => ({
            product_id:     savedProduct.id,
            name:           v.name,
            price_modifier: Number(v.price_modifier),
            stock_quantity: Number(v.stock_quantity),
          }))
        if (variantPayload.length > 0) {
          // Delete old + re-insert (simplest approach)
          await supabase.from('product_variants').delete().eq('product_id', savedProduct.id)
          await supabase.from('product_variants').insert(variantPayload)
        }
      }

      toast.success(isNew ? 'Product created!' : 'Product updated!')
      onSaved({ ...savedProduct, images }, isNew)
    } catch (err: any) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">{isNew ? 'Add Product' : 'Edit Product'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

          {/* Images */}
          <div>
            <Label>Images (up to 5)</Label>
            <div className="flex gap-2 flex-wrap mt-2">
              {images.map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 group">
                  <Image src={url} alt="" fill className="object-cover" />
                  <button onClick={() => removeImage(i)}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Trash2 size={14} className="text-white" />
                  </button>
                </div>
              ))}
              {images.length < 5 && (
                <button onClick={() => fileRef.current?.click()}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  disabled={uploading}
                >
                  {uploading
                    ? <Loader2 size={18} className="animate-spin text-gray-400" />
                    : <><Upload size={16} className="text-gray-400" /><span className="text-[10px] text-gray-400 mt-1">Upload</span></>}
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleImageUpload} />
          </div>

          {/* Name + Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <Label>Product Name *</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Nasi Lemak" />
            </div>
            <div>
              <Label>Category</Label>
              <select value={form.category_id}
                onChange={e => set('category_id', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Describe your product..." rows={2} />
          </div>

          {/* Price + Weight */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Price (RM) *</Label>
              <Input type="number" min="0" step="0.01" value={form.price}
                onChange={e => set('price', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Weight (grams)</Label>
              <Input type="number" min="0" value={form.weight_grams}
                onChange={e => set('weight_grams', e.target.value)} />
            </div>
            <div>
              <Label>Status</Label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>
          </div>

          {/* Stock tracking */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
            <div>
              <p className="text-sm font-medium text-gray-800">Track inventory</p>
              <p className="text-xs text-gray-400">Auto-deduct stock when orders are placed</p>
            </div>
            <Switch checked={form.track_stock} onCheckedChange={v => set('track_stock', v)} />
          </div>
          {form.track_stock && (
            <div>
              <Label>Stock Quantity</Label>
              <Input type="number" min="0" value={form.stock_quantity}
                onChange={e => set('stock_quantity', e.target.value)} />
            </div>
          )}

          {/* Variants */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Variants (e.g. sizes, flavours)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                <Plus size={14} className="mr-1" /> Add Variant
              </Button>
            </div>
            {variants.length === 0 && (
              <p className="text-xs text-gray-400">No variants — product has a single option.</p>
            )}
            <div className="space-y-2">
              {variants.map((v, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input placeholder="Name (e.g. Large)" value={v.name}
                    onChange={e => updateVariant(i, 'name', e.target.value)} className="flex-1" />
                  <Input type="number" placeholder="+/- RM" step="0.01"
                    value={v.price_modifier}
                    onChange={e => updateVariant(i, 'price_modifier', e.target.value)}
                    className="w-24" />
                  <Input type="number" placeholder="Stock" min="0"
                    value={v.stock_quantity}
                    onChange={e => updateVariant(i, 'stock_quantity', e.target.value)}
                    className="w-20" />
                  <button onClick={() => removeVariant(i)}
                    className="text-red-400 hover:text-red-600 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? <><Loader2 size={16} className="animate-spin mr-2" />Saving...</> : (isNew ? 'Create Product' : 'Save Changes')}
          </Button>
        </div>
      </div>
    </div>
  )
}
```


***

## File 6 — `src/app/(dashboard)/analytics/page.tsx`

```typescript
import { getMerchant }  from '@/lib/utils.server'
import { subDays, startOfDay, format } from 'date-fns'
import { AnalyticsClient } from '@/components/dashboard/AnalyticsClient'

export default async function AnalyticsPage() {
  const { supabase, merchant } = await getMerchant()

  const since30 = subDays(new Date(), 30).toISOString()
  const since7  = subDays(new Date(), 7).toISOString()

  const [
    { data: orders30 },
    { data: topProducts },
    { data: dailyRevenue },
    { data: statusBreakdown },
    { data: hourlyOrders },
  ] = await Promise.all([
    // All orders last 30 days
    supabase.from('orders')
      .select('total_amount, status, created_at, delivery_type')
      .eq('merchant_id', merchant.id)
      .gte('created_at', since30)
      .not('status', 'in', '(pending,cancelled)'),

    // Top 10 products by revenue
    supabase.from('order_items')
      .select('product_name, quantity, line_total, order:orders!inner(merchant_id, created_at, status)')
      .eq('order.merchant_id', merchant.id)
      .gte('order.created_at', since30)
      .not('order.status', 'in', '(pending,cancelled)')
      .limit(200),

    // Daily revenue via RPC
    supabase.rpc('get_daily_revenue', { p_merchant_id: merchant.id, p_days: 30 }),

    // Status breakdown
    supabase.from('orders')
      .select('status')
      .eq('merchant_id', merchant.id)
      .gte('created_at', since30),

    // Hourly order distribution (last 7 days)
    supabase.from('orders')
      .select('created_at')
      .eq('merchant_id', merchant.id)
      .gte('created_at', since7)
      .not('status', 'eq', 'cancelled'),
  ])

  // Aggregate top products
  const productMap: Record<string, { name: string; revenue: number; units: number }> = {}
  ;(topProducts ?? []).forEach((item: any) => {
    if (!productMap[item.product_name]) {
      productMap[item.product_name] = { name: item.product_name, revenue: 0, units: 0 }
    }
    productMap[item.product_name].revenue += Number(item.line_total)
    productMap[item.product_name].units   += item.quantity
  })
  const topProductsArr = Object.values(productMap)
    .sort((a, b) => b.revenue - a.revenue).slice(0, 8)

  // Status breakdown
  const statusMap: Record<string, number> = {}
  ;(statusBreakdown ?? []).forEach((o: any) => {
    statusMap[o.status] = (statusMap[o.status] ?? 0) + 1
  })

  // Hourly distribution
  const hourMap: number[] = new Array(24).fill(0)
  ;(hourlyOrders ?? []).forEach((o: any) => {
    const hour = new Date(o.created_at).getHours()
    hourMap[hour]++
  })
  const hourlyData = hourMap.map((count, h) => ({
    hour: `${h.toString().padStart(2, '0')}:00`,
    orders: count,
  }))

  // Delivery type split
  const deliveryMap: Record<string, number> = {}
  ;(orders30 ?? []).forEach((o: any) => {
    const t = o.delivery_type ?? 'unknown'
    deliveryMap[t] = (deliveryMap[t] ?? 0) + 1
  })

  return (
    <AnalyticsClient
      dailyRevenue={dailyRevenue ?? []}
      topProducts={topProductsArr}
      statusBreakdown={Object.entries(statusMap).map(([k, v]) => ({ name: k, value: v }))}
      hourlyData={hourlyData}
      deliveryBreakdown={Object.entries(deliveryMap).map(([k, v]) => ({ name: k, value: v }))}
    />
  )
}
```


***

## File 7 — `src/components/dashboard/AnalyticsClient.tsx`

```typescript
'use client'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { format, parseISO } from 'date-fns'

const COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#be185d','#65a30d']

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h3 className="font-bold text-gray-900 mb-4">{title}</h3>
      {children}
    </div>
  )
}

export function AnalyticsClient({ dailyRevenue, topProducts, statusBreakdown, hourlyData, deliveryBreakdown }: {
  dailyRevenue:      { date: string; revenue: number }[]
  topProducts:       { name: string; revenue: number; units: number }[]
  statusBreakdown:   { name: string; value: number }[]
  hourlyData:        { hour: string; orders: number }[]
  deliveryBreakdown: { name: string; value: number }[]
}) {
  const revenueFormatted = dailyRevenue.map(d => ({
    date:    format(parseISO(d.date), 'd MMM'),
    revenue: Number(d.revenue),
  }))

  return (
    <div className="space-y-4">
      {/* Revenue area chart */}
      <Card title="Revenue — Last 30 Days">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={revenueFormatted}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={v => `RM${v}`} width={52} />
            <Tooltip formatter={(v: number) => [`RM ${v.toFixed(2)}`, 'Revenue']}
              contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }} />
            <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} fill="url(#grad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Top products */}
        <Card title="Top Products by Revenue (30 days)">
          <div className="space-y-2">
            {topProducts.map((p, i) => {
              const maxRevenue = topProducts[^0]?.revenue ?? 1
              const pct = (p.revenue / maxRevenue) * 100
              return (
                <div key={p.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-700 font-medium truncate max-w-[200px]">{p.name}</span>
                    <span className="text-gray-500 shrink-0 ml-2">
                      RM {p.revenue.toFixed(2)} · {p.units} units
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Order status pie */}
        <Card title="Order Status Breakdown (30 days)">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusBreakdown} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) =>
                  `${name.replace(/_/g, ' ')} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
                style={{ fontSize: 10 }}
              >
                {statusBreakdown.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [v, 'orders']}
                contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Hourly heatmap */}
        <Card title="Peak Order Hours (last 7 days)">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={hourlyData} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                interval={2} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }} />
              <Bar dataKey="orders" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Delivery type split */}
        <Card title="Delivery Method Split (30 days)">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={deliveryBreakdown} dataKey="value" nameKey="name"
                cx="50%" cy="50%" innerRadius={50} outerRadius={80}
              >
                {deliveryBreakdown.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend formatter={v => v.replace(/_/g, ' ')} wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  )
}
```


***

## File 8 — `src/app/(dashboard)/customers/page.tsx`

```typescript
import { getMerchant }    from '@/lib/utils.server'
import { CustomersTable } from '@/components/dashboard/CustomersTable'

export default async function CustomersPage({
  searchParams,
}: { searchParams: Promise<{ page?: string }> }) {
  const { page = '1' } = await searchParams
  const { supabase, merchant } = await getMerchant()
  const PAGE_SIZE = 25
  const offset = (Number(page) - 1) * PAGE_SIZE

  // Aggregate per-customer stats
  const { data: customers, count } = await supabase
    .from('orders')
    .select(`
      customer_id,
      delivery_address,
      total_amount,
      created_at,
      status,
      profiles:customer_id(full_name, email, phone)
    `, { count: 'exact' })
    .eq('merchant_id', merchant.id)
    .not('status', 'in', '(pending,cancelled)')
    .order('created_at', { ascending: false })

  // Aggregate by customer_id
  const customerMap: Record<string, any> = {}
  ;(customers ?? []).forEach((o: any) => {
    const id = o.customer_id
    if (!customerMap[id]) {
      customerMap[id] = {
        id,
        name:        o.profiles?.full_name ?? (o.delivery_address as any)?.name ?? 'Guest',
        email:       o.profiles?.email ?? '—',
        phone:       o.profiles?.phone ?? (o.delivery_address as any)?.phone ?? '—',
        totalSpent:  0,
        orderCount:  0,
        lastOrderAt: o.created_at,
      }
    }
    customerMap[id].totalSpent  += Number(o.total_amount)
    customerMap[id].orderCount  += 1
    if (o.created_at > customerMap[id].lastOrderAt) {
      customerMap[id].lastOrderAt = o.created_at
    }
  })

  const customerList = Object.values(customerMap)
    .sort((a: any, b: any) => b.totalSpent - a.totalSpent)
    .slice(offset, offset + PAGE_SIZE)

  return (
    <CustomersTable
      customers={customerList}
      total={Object.keys(customerMap).length}
      page={Number(page)}
      pageSize={PAGE_SIZE}
    />
  )
}
```

```typescript
// src/components/dashboard/CustomersTable.tsx
'use client'
import { useRouter }    from 'next/navigation'
import { format }       from 'date-fns'
import { Button }       from '@/components/ui/button'
import { Users }        from 'lucide-react'

export function CustomersTable({ customers, total, page, pageSize }: {
  customers: any[]; total: number; page: number; pageSize: number
}) {
  const router     = useRouter()
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users size={20} className="text-gray-500" />
        <h2 className="font-bold text-gray-900">{total} unique customers</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                {['Customer', 'Contact', 'Orders', 'Total Spent', 'Last Order'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-400 px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-sm text-gray-800">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-500">
                    <p>{c.email}</p>
                    <p className="text-xs">{c.phone}</p>
                  </td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-gray-700">{c.orderCount}</td>
                  <td className="px-5 py-3.5 text-sm font-bold text-blue-600">
                    RM {c.totalSpent.toFixed(2)}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-400">
                    {format(new Date(c.lastOrderAt), 'd MMM yyyy')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between">
            <p className="text-xs text-gray-400">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1}
                onClick={() => router.push(`/customers?page=${page - 1}`)}>← Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages}
                onClick={() => router.push(`/customers?page=${page + 1}`)}>Next →</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```


***

## File 9 — `src/app/(dashboard)/delivery/page.tsx`

Book and track all deliveries from the web:[^1]

```typescript
import { getMerchant }    from '@/lib/utils.server'
import { DeliveryClient } from '@/components/dashboard/DeliveryClient'

export default async function DeliveryPage() {
  const { supabase, merchant } = await getMerchant()

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, total_amount, status, delivery_type, delivery_provider, tracking_number, tracking_url, delivery_address, created_at, delivery_fee, driver_name, driver_phone, driver_plate, lalamove_order_id, easyparcel_order_no')
    .eq('merchant_id', merchant.id)
    .in('status', ['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery'])
    .order('created_at', { ascending: false })

  return <DeliveryClient orders={orders ?? []} merchantId={merchant.id} />
}
```

```typescript
// src/components/dashboard/DeliveryClient.tsx
'use client'
import { useState }     from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button }       from '@/components/ui/button'
import { format }       from 'date-fns'
import toast            from 'react-hot-toast'
import { Truck, ExternalLink, Package, MapPin, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const PROVIDER_LABELS: Record<string, string> = {
  lalamove:  '🏍️  Lalamove',
  easyparcel: '📦  EasyParcel',
  self:       '🏃  Self Pickup',
}

export function DeliveryClient({ orders: initial, merchantId }: { orders: any[]; merchantId: string }) {
  const [orders, setOrders]   = useState(initial)
  const [booking, setBooking] = useState<string | null>(null)
  const supabase = createClient()

  const handleBookLalamove = async (order: any) => {
    if (!order.delivery_quote_id) {
      toast.error('No quote saved for this order — customer must re-checkout')
      return
    }
    setBooking(order.id)
    try {
      const { data, error } = await supabase.functions.invoke('lalamove-create-order', {
        body: {
          orderId:      order.id,
          quotationId:  order.delivery_quote_id,
          serviceType:  order.delivery_service_id,
        },
      })
      if (error || data?.error) throw new Error(error?.message ?? data?.error)
      toast.success('Lalamove booked! Driver being assigned 🏍️')
      setOrders(prev => prev.map(o => o.id === order.id
        ? { ...o, status: 'out_for_delivery', lalamove_order_id: data.lalamoveOrderId }
        : o))
    } catch (err: any) {
      toast.error(err.message)
    }
    setBooking(null)
  }

  const handleBookEasyParcel = async (order: any) => {
    setBooking(order.id)
    try {
      const { data, error } = await supabase.functions.invoke('easyparcel-create-order', {
        body: { orderId: order.id },
      })
      if (error || data?.error) throw new Error(error?.message ?? data?.error)
      toast.success(`EasyParcel booked! AWB: ${data.trackingNumber}`)
      setOrders(prev => prev.map(o => o.id === order.id
        ? { ...o, status: 'out_for_delivery', tracking_number: data.trackingNumber, tracking_url: data.trackingUrl }
        : o))
    } catch (err: any) {
      toast.error(err.message)
    }
    setBooking(null)
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 py-24 text-center">
        <Truck size={40} className="mx-auto text-gray-200 mb-4" />
        <p className="text-gray-400 text-sm">No orders pending delivery</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{orders.length} order{orders.length !== 1 ? 's' : ''} need delivery action</p>
      {orders.map(order => {
        const addr    = order.delivery_address as any
        const isBooked = !!order.lalamove_order_id || !!order.tracking_number
        const isLoading = booking === order.id

        return (
          <div key={order.id} className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              {/* Order info */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-lg">
                    {order.order_number}
                  </span>
                  <span className={cn(
                    'text-xs font-semibold px-2 py-0.5 rounded-full capitalize',
                    order.status === 'out_for_delivery' ? 'bg-sky-100 text-sky-700' : 'bg-purple-100 text-purple-700'
                  )}>
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {format(new Date(order.created_at), 'd MMM, h:mm a')} · RM {Number(order.total_amount).toFixed(2)}
                </p>

                {/* Customer address */}
                {addr && (
                  <div className="flex items-start gap-1.5 mt-2">
                    <MapPin size={13} className="text-gray-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-gray-500">
                      {addr.name} · {addr.line1}, {addr.city}, {addr.state} {addr.postcode}
                    </p>
                  </div>
                )}

                {/* Provider label */}
                <p className="text-xs font-medium text-gray-600 mt-1">
                  {PROVIDER_LABELS[order.delivery_provider] ?? order.delivery_provider ?? '—'}
                  {order.delivery_fee > 0 && ` · RM ${Number(order.delivery_fee).toFixed(2)}`}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 shrink-0">
                {/* Lalamove */}
                {order.delivery_provider === 'lalamove' && !isBooked && (
                  <Button onClick={() => handleBookLalamove(order)} disabled={isLoading}
                    className="bg-orange-500 hover:bg-orange-600 text-white">
                    {isLoading ? <Loader2 size={15} className="animate-spin mr-1" /> : '🏍️'}
                    Book Lalamove
                  </Button>
                )}

                {/* EasyParcel */}
                {order.delivery_provider === 'easyparcel' && !isBooked && (
                  <Button onClick={() => handleBookEasyParcel(order)} disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white">
                    {isLoading ? <Loader2 size={15} className="animate-spin mr-1" /> : '📦'}
                    Book Courier
                  </Button>
                )}

                {/* Driver info (Lalamove assigned) */}
                {order.driver_name && (
                  <div className="bg-green-50 rounded-xl p-2.5 text-xs">
                    <p className="font-semibold text-green-800">Driver Assigned</p>
                    <p className="text-green-700">{order.driver_name} · {order.driver_phone}</p>
                    <p className="text-green-600">{order.driver_plate}</p>
                  </div>
                )}

                {/* Tracking */}
                {order.tracking_url && (
                  <a href={order.tracking_url} target="_blank" rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 bg-blue-50 text-blue-600 text-sm font-medium rounded-xl px-4 py-2 hover:bg-blue-100 transition-colors">
                    <ExternalLink size={14} /> Track Parcel
                  </a>
                )}
                {order.tracking_number && (
                  <p className="text-xs text-gray-400 text-center">AWB: {order.tracking_number}</p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```


***

## File 10 — `src/app/(dashboard)/categories/page.tsx`

```typescript
import { getMerchant }      from '@/lib/utils.server'
import { CategoriesClient } from '@/components/dashboard/CategoriesClient'

export default async function CategoriesPage() {
  const { supabase, merchant } = await getMerchant()
  const { data: categories } = await supabase
    .from('categories')
    .select('*, product_count:products(count)')
    .eq('merchant_id', merchant.id)
    .order('sort_order', { ascending: true })

  return <CategoriesClient categories={categories ?? []} merchantId={merchant.id} />
}
```

```typescript
// src/components/dashboard/CategoriesClient.tsx
'use client'
import { useState }     from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button }       from '@/components/ui/button'
import { Input }        from '@/components/ui/input'
import toast            from 'react-hot-toast'
import { Plus, GripVertical, Pencil, Trash2, Check, X } from 'lucide-react'

export function CategoriesClient({ categories: initial, merchantId }: {
  categories: any[]; merchantId: string
}) {
  const [cats, setCats]       = useState(initial)
  const [adding, setAdding]   = useState(false)
  const [newName, setNewName] = useState('')
  const [editId, setEditId]   = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const supabase = createClient()

  const handleAdd = async () => {
    if (!newName.trim()) return
    const { data, error } = await supabase
      .from('categories')
      .insert({ name: newName.trim(), merchant_id: merchantId, sort_order: cats.length })
      .select('*, product_count:products(count)').single()
    if (error) { toast.error(error.message); return }
    setCats(prev => [...prev, data])
    setNewName('')
    setAdding(false)
    toast.success('Category added')
  }

  const handleEdit = async (id: string) => {
    if (!editName.trim()) return
    const { error } = await supabase.from('categories').update({ name: editName.trim() }).eq('id', id)
    if (error) { toast.error(error.message); return }
    setCats(prev => prev.map(c => c.id === id ? { ...c, name: editName } : c))
    setEditId(null)
    toast.success('Category updated')
  }

  const handleDelete = async (cat: any) => {
    const count = cat.product_count?.[^0]?.count ?? 0
    if (count > 0 && !confirm(`This category has ${count} products. They will become uncategorized. Continue?`)) return
    const { error } = await supabase.from('categories').delete().eq('id', cat.id)
    if (error) { toast.error(error.message); return }
    setCats(prev => prev.filter(c => c.id !== cat.id))
    toast.success('Category deleted')
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-900">Product Categories</h2>
        <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus size={14} className="mr-1" /> Add Category
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {adding && (
          <div className="flex items-center gap-2 p-4 border-b border-gray-50">
            <Input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Category name..." onKeyDown={e => { if (e.key === 'Enter') handleAdd() }} />
            <Button size="sm" onClick={handleAdd}><Check size={15} /></Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewName('') }}>
              <X size={15} />
            </Button>
          </div>
        )}

        {cats.length === 0 && !adding ? (
          <p className="text-center text-gray-400 py-12 text-sm">No categories yet</p>
        ) : (
          <ul>
            {cats.map((cat, idx) => (
              <li key={cat.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                <GripVertical size={16} className="text-gray-300 shrink-0" />
                {editId === cat.id ? (
                  <>
                    <Input autoFocus value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="flex-1 h-8"
                      onKeyDown={e => { if (e.key === 'Enter') handleEdit(cat.id) }} />
                    <button onClick={() => handleEdit(cat.id)} className="text-green-600 hover:text-green-700">
                      <Check size={16} />
                    </button>
                    <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-gray-800">{cat.name}</span>
                    <span className="text-xs text-gray-400">
                      {cat.product_count?.[^0]?.count ?? 0} products
                    </span>
                    <button onClick={() => { setEditId(cat.id); setEditName(cat.name) }}
                      className="text-gray-400 hover:text-blue-600 transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(cat)}
                      className="text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Categories appear in the customer app to filter products.
        Products without a category are shown under "All".
      </p>
    </div>
  )
}
```


***

## File 11 — Orders CSV Export

Add an export button to `OrdersTable.tsx`:

```typescript
// src/lib/export.ts
export function exportOrdersCSV(orders: any[]) {
  const rows = [
    ['Order Number', 'Date', 'Customer', 'Items', 'Subtotal', 'Delivery Fee', 'Total', 'Status', 'Payment', 'Delivery Type'],
    ...orders.map(o => {
      const addr = o.delivery_address as any
      return [
        o.order_number,
        new Date(o.created_at).toLocaleString('en-MY'),
        addr?.name ?? '—',
        (o.items ?? []).map((i: any) => `${i.product_name} x${i.quantity}`).join(' | '),
        Number(o.subtotal).toFixed(2),
        Number(o.delivery_fee).toFixed(2),
        Number(o.total_amount).toFixed(2),
        o.status,
        o.payment_method ?? '—',
        o.delivery_type ?? '—',
      ]
    }),
  ]

  const csv = rows.map(r => r.map(cell =>
    `"${String(cell).replace(/"/g, '""')}"`
  ).join(',')).join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
```

Add export button in `OrdersTable.tsx` toolbar:

```typescript
import { exportOrdersCSV } from '@/lib/export'
import { Download } from 'lucide-react'

// Inside the header div of OrdersTable:
<Button variant="outline" size="sm" onClick={() => exportOrdersCSV(orders)}>
  <Download size={14} className="mr-1" /> Export CSV
</Button>
```


***

## File 12 — Update `Sidebar.tsx` with new routes

```typescript
const NAV = [
  { href: '/',            label: 'Overview',    icon: LayoutDashboard },
  { href: '/orders',      label: 'Orders',      icon: ShoppingBag     },
  { href: '/products',    label: 'Products',    icon: Package         },
  { href: '/categories',  label: 'Categories',  icon: Tag             },  // add: import Tag
  { href: '/customers',   label: 'Customers',   icon: Users           },  // add: import Users
  { href: '/analytics',   label: 'Analytics',   icon: BarChart2       },  // add: import BarChart2
  { href: '/delivery',    label: 'Delivery',    icon: Truck           },
  { href: '/settings',    label: 'Settings',    icon: Settings        },
]
```


***

## File 13 — Supabase Storage bucket setup

Run in Supabase SQL Editor:

```sql
-- Allow merchants to upload product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "merchants upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "product images are public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

CREATE POLICY "merchants delete own product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[^1]);
```


***

## Complete Feature Map

| Page | Features |
| :-- | :-- |
| `/` Overview | Revenue, stats, pending count, recent orders, realtime bell + sound |
| `/orders` | Filter by status, pagination, status badges, **CSV export** |
| `/orders/[id]` | Full detail, accept/reject/progress actions, tracking link |
| `/products` | Grid view, toggle active, search, category filter, image hover actions |
| `/products` → modal | Image upload to Supabase Storage, variants, stock tracking, weight |
| `/categories` | Add/edit/delete inline, product count per category |
| `/customers` | Sorted by spend, order count, last order date |
| `/analytics` | Revenue area, top products bar, status pie, peak hours, delivery split |
| `/delivery` | Book Lalamove/EasyParcel per order, driver info, tracking links |
| `/settings` | Store info, address (triggers geocoding), delivery settings |
| **Realtime** | New order sound + toast notification on any page [^2] |

<span style="display:none">[^10][^11][^12][^13][^14][^15][^3][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://supabase.com/docs/guides/storage/uploads/standard-uploads

[^2]: https://react-hot-toast.com

[^3]: https://www.youtube.com/watch?v=Qhuxvk9-Zkw

[^4]: https://kodaschool.com/blog/next-js-and-supabase-how-to-store-and-serve-images

[^5]: https://supabase.com/docs/reference/javascript/storage-from-upload

[^6]: https://kirandev.com/upload-files-to-supabase-storage-nextjs

[^7]: https://refine.dev/blog/react-hot-toast/

[^8]: https://stackoverflow.com/questions/75610507/uploading-a-file-to-supabase-storage-using-nextjs-and-formidable

[^9]: https://www.geeksforgeeks.org/reactjs/how-to-create-smoking-hot-toast-notifications-in-reactjs-with-react-hot-toast-module/

[^10]: https://www.youtube.com/watch?v=87JAdYPC2n0

[^11]: https://blog.logrocket.com/react-toastify-guide/

[^12]: https://www.youtube.com/watch?v=YmI8INix-d0

[^13]: https://www.youtube.com/watch?v=-ol2fideNwU

[^14]: https://www.youtube.com/watch?v=fwbwuY7o3uk

[^15]: https://www.youtube.com/watch?v=A129o7GQduY

