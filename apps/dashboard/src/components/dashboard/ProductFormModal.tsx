'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import Image   from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Label }    from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch }   from '@/components/ui/switch'
import toast        from 'react-hot-toast'
import { X, Plus, Trash2, Upload, Loader2, GripVertical, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { type StoreType } from '@/lib/store-types'
import { ProductTypeFields } from './ProductTypeFields'
import { generateEAN13, detectBarcodeFormat } from '@/lib/barcode-utils'
import { cn } from '@/lib/utils'

interface Variant { id?: string; name: string; price_modifier: number; stock_quantity: number; sku?: string; barcode?: string }

type Tab = 'basic' | 'pricing' | 'variants' | 'details'

export function ProductFormModal({ merchantId, categories, product, storeType, onClose, onSaved }: {
  merchantId: string; categories: any[]; product: any | null; storeType: StoreType
  onClose: () => void; onSaved: (saved: any, isNew: boolean) => void
}) {
  const isNew    = !product
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<Tab>('basic')

  const [form, setForm] = useState({
    name:             product?.name             ?? '',
    description:      product?.description      ?? '',
    price:            product?.price            ?? '',
    category_id:      product?.category_id      ?? '',
    status:           product?.status           ?? 'active',
    weight_grams:     product?.weight_grams     ?? 500,
    track_inventory:  product?.track_inventory  ?? true,
    stock_quantity:   product?.stock_quantity   ?? 0,
    sku:              product?.sku              ?? '',
    barcode:          product?.barcode          ?? '',
    is_featured:      product?.is_featured      ?? false,
    compare_at_price: product?.compare_at_price ?? '',
    cost_price:       product?.cost_price       ?? '',
  })
  const [variants, setVariants]         = useState<Variant[]>(product?.variants ?? [])
  const [images, setImages]             = useState<string[]>(product?.images ?? [])
  const [uploading, setUploading]       = useState(false)
  const [saving, setSaving]             = useState(false)
  const [customFields, setCustomFields] = useState<Record<string, string>>({})
  const [dragOver, setDragOver]         = useState(false)
  const [dragIndex, setDragIndex]       = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Fetch custom attributes if editing
  useEffect(() => {
    if (product?.id) {
      supabase.from('product_custom_attributes')
        .select('key, value')
        .eq('product_id', product.id)
        .then(({ data }) => {
          if (data) {
            const fields: Record<string, string> = {}
            data.forEach(d => { fields[d.key] = d.value ?? '' })
            setCustomFields(fields)
          }
        })
    }
  }, [product?.id, supabase])

  // Cmd/Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  // Profit margin calc
  const price    = Number(form.price)    || 0
  const costPrice = Number(form.cost_price) || 0
  const margin   = price > 0 && costPrice > 0 ? ((price - costPrice) / price) * 100 : null
  const profit   = price > 0 && costPrice > 0 ? price - costPrice : null

  // Image upload
  const processFiles = useCallback(async (files: File[]) => {
    const allowed = files.filter(f => f.type.startsWith('image/')).slice(0, 5 - images.length)
    if (!allowed.length) return
    setUploading(true)
    try {
      const { uploadToR2 } = await import('@/lib/storage')
      const urls: string[] = []
      for (const file of allowed) {
        const path = `product-images/${merchantId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${file.name.split('.').pop()}`
        const publicUrl = await uploadToR2(file, path)
        urls.push(publicUrl)
      }
      setImages(prev => [...prev, ...urls])
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`)
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }, [images.length, merchantId])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(e.target.files ?? []))
  }

  const handleDropZoneDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    processFiles(Array.from(e.dataTransfer.files))
  }

  const removeImage = (idx: number) => setImages(prev => prev.filter((_, i) => i !== idx))

  // Image drag-to-reorder
  const handleImageDragStart = (e: React.DragEvent, idx: number) => {
    setDragIndex(idx)
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleImageDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDragOverIndex(idx)
  }
  const handleImageDrop = (e: React.DragEvent, toIdx: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === toIdx) { setDragIndex(null); setDragOverIndex(null); return }
    setImages(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(toIdx, 0, moved)
      return next
    })
    setDragIndex(null)
    setDragOverIndex(null)
  }

  // Variants
  const addVariant = () =>
    setVariants(prev => [...prev, { name: '', price_modifier: 0, stock_quantity: 0, sku: '', barcode: '' }])
  const updateVariant = (idx: number, k: keyof Variant, v: any) =>
    setVariants(prev => prev.map((vr, i) => i === idx ? { ...vr, [k]: v } : vr))
  const removeVariant = (idx: number) =>
    setVariants(prev => prev.filter((_, i) => i !== idx))

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Product name is required'); setActiveTab('basic'); return }
    if (!form.price)       { toast.error('Price is required'); setActiveTab('pricing'); return }

    setSaving(true)
    try {
      const validVariants = variants.filter(v => v.name.trim())
      const hasVariants = validVariants.length > 0
      const totalVariantStock = validVariants.reduce((sum, v) => sum + (Number(v.stock_quantity) || 0), 0)

      const payload = {
        merchant_id:      merchantId,
        name:             form.name.trim(),
        description:      form.description,
        price:            Number(form.price),
        category_id:      form.category_id || null,
        status:           form.status,
        weight_grams:     Number(form.weight_grams),
        track_inventory:  form.track_inventory,
        stock_quantity:   form.track_inventory ? (hasVariants ? totalVariantStock : Number(form.stock_quantity)) : 9999,
        sku:              form.sku.trim() || null,
        barcode:          form.barcode.trim() || null,
        is_featured:      form.is_featured,
        compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
        cost_price:       form.cost_price ? Number(form.cost_price) : 0,
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
      if (hasVariants) {
        const variantPayload = validVariants
          .map(v => ({
            product_id:     savedProduct.id,
            name:           v.name,
            price_modifier: Number(v.price_modifier),
            stock_quantity: Number(v.stock_quantity),
            sku:            v.sku?.trim() || null,
            barcode:        v.barcode?.trim() || null,
          }))
        if (variantPayload.length > 0) {
          await supabase.from('product_variants').delete().eq('product_id', savedProduct.id)
          await supabase.from('product_variants').insert(variantPayload)
        }
      } else {
        // All variants removed — clean up
        await supabase.from('product_variants').delete().eq('product_id', savedProduct.id)
      }

      // Upsert custom attributes
      const customAttrPayload = Object.entries(customFields)
        .filter(([_, v]) => v.trim())
        .map(([k, v]) => ({ product_id: savedProduct.id, merchant_id: merchantId, key: k, value: v }))
      if (customAttrPayload.length > 0) {
        await supabase.from('product_custom_attributes').upsert(customAttrPayload, { onConflict: 'product_id,key' })
      }

      toast.success(isNew ? 'Product created!' : 'Product updated!')
      onSaved({ ...savedProduct, images }, isNew)
    } catch (err: any) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'basic',    label: 'Basic' },
    { id: 'pricing',  label: 'Pricing & Stock' },
    { id: 'variants', label: 'Variants', badge: variants.length || undefined },
    { id: 'details',  label: 'Details' },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">{isNew ? 'Add Product' : 'Edit Product'}</h2>
            <p className="text-xs text-gray-400 mt-0.5">⌘S to save</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative px-1 py-3 text-sm font-medium mr-6 border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.label}
              {tab.badge != null && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* ── BASIC ── */}
          {activeTab === 'basic' && (
            <>
              {/* Images */}
              <div>
                <Label>Images (up to 5) — drag to reorder</Label>
                <div
                  className={cn(
                    'mt-2 rounded-xl border-2 border-dashed p-3 transition-colors',
                    dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
                  )}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDropZoneDrop}
                >
                  <div className="flex gap-2 flex-wrap">
                    {images.map((url, i) => (
                      <div
                        key={i}
                        draggable
                        onDragStart={e => handleImageDragStart(e, i)}
                        onDragOver={e => handleImageDragOver(e, i)}
                        onDrop={e => handleImageDrop(e, i)}
                        className={cn(
                          'relative w-20 h-20 rounded-xl overflow-hidden border-2 group cursor-grab transition-all',
                          dragOverIndex === i && dragIndex !== i ? 'border-blue-400 scale-105' : 'border-gray-200'
                        )}
                      >
                        <Image src={url} alt="" fill sizes="80px" className="object-cover" />
                        {i === 0 && (
                          <span className="absolute top-1 left-1 bg-blue-600 text-white text-[9px] font-bold px-1 rounded">Main</span>
                        )}
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => removeImage(i)}
                            className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                          >
                            <X size={10} className="text-white" />
                          </button>
                        </div>
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-60 transition-opacity">
                          <GripVertical size={14} className="text-white" />
                        </div>
                      </div>
                    ))}
                    {images.length < 5 && (
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
                        disabled={uploading}
                      >
                        {uploading
                          ? <Loader2 size={18} className="animate-spin text-gray-400" />
                          : <><Upload size={16} className="text-gray-400" /><span className="text-[10px] text-gray-400 mt-1">Upload</span></>}
                      </button>
                    )}
                  </div>
                  {images.length === 0 && !uploading && (
                    <p className="text-center text-xs text-gray-400 mt-2">Drop images here or click Upload</p>
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
                  <select
                    value={form.category_id}
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
                  placeholder="Describe your product..." rows={3} />
              </div>

              {/* SKU + Barcode */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>SKU</Label>
                  <Input value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="e.g. NL-001" />
                </div>
                <div>
                  <Label className="flex justify-between items-center">
                    Barcode
                    {form.barcode && (
                      <span className="text-[10px] font-normal text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                        {detectBarcodeFormat(form.barcode)}
                      </span>
                    )}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={form.barcode}
                      onChange={e => set('barcode', e.target.value)}
                      placeholder="e.g. 9556001234567"
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" size="sm" className="px-2 h-9 shrink-0"
                      onClick={() => set('barcode', generateEAN13())}>
                      Gen
                    </Button>
                  </div>
                </div>
              </div>

              {/* Featured + Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between bg-amber-50/60 border border-amber-100 rounded-xl px-3 py-2.5">
                  <span className="text-sm font-medium text-amber-900">Featured</span>
                  <Switch checked={form.is_featured} onCheckedChange={v => set('is_featured', v)} />
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
            </>
          )}

          {/* ── PRICING & STOCK ── */}
          {activeTab === 'pricing' && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Selling Price (RM) *</Label>
                  <Input type="number" min="0" step="0.01" value={form.price}
                    onChange={e => set('price', e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <Label>Cost Price (RM)</Label>
                  <Input type="number" min="0" step="0.01" value={form.cost_price}
                    onChange={e => set('cost_price', e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <Label>Compare-at Price (RM)</Label>
                  <Input type="number" min="0" step="0.01" value={form.compare_at_price}
                    onChange={e => set('compare_at_price', e.target.value)} placeholder="0.00" />
                </div>
              </div>

              {/* Margin indicator */}
              {margin !== null && (
                <div className={cn(
                  'flex items-center gap-3 rounded-xl px-4 py-3 text-sm',
                  margin >= 40 ? 'bg-green-50 text-green-800' :
                  margin >= 20 ? 'bg-amber-50 text-amber-800' :
                                 'bg-red-50 text-red-800'
                )}>
                  {margin >= 40 ? <TrendingUp size={16} /> : margin >= 20 ? <Minus size={16} /> : <TrendingDown size={16} />}
                  <span>
                    Margin: <strong>{margin.toFixed(1)}%</strong>
                    {profit !== null && <span className="ml-2 opacity-70">(RM {profit.toFixed(2)} per unit)</span>}
                  </span>
                  {margin < 20 && <span className="ml-auto text-xs font-medium">Low margin — check pricing</span>}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Weight (grams)</Label>
                  <Input type="number" min="0" value={form.weight_grams}
                    onChange={e => set('weight_grams', e.target.value)} />
                </div>
              </div>

              {/* Track inventory toggle */}
              <div className="border border-gray-100 rounded-xl divide-y divide-gray-100">
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Track inventory</p>
                    <p className="text-xs text-gray-400 mt-0.5">Count stock and auto-mark out of stock</p>
                  </div>
                  <Switch checked={form.track_inventory} onCheckedChange={v => set('track_inventory', v)} />
                </div>
                {form.track_inventory && (
                  <div className="px-4 py-3">
                    <Label>Stock Quantity</Label>
                    {variants.filter(v => v.name.trim()).length > 0 ? (
                      <div className="mt-2 p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                        <p className="text-sm font-medium text-blue-900">Stock is managed at the variant level</p>
                        <p className="text-xs text-blue-700 mt-0.5">
                          Total combined stock: <strong className="text-sm font-black mx-1">{variants.filter(v => v.name.trim()).reduce((acc, v) => acc + (Number(v.stock_quantity) || 0), 0)}</strong> units
                        </p>
                      </div>
                    ) : (
                      <Input type="number" min="0" value={form.stock_quantity}
                        onChange={e => set('stock_quantity', e.target.value)} className="mt-1 max-w-[160px]" />
                    )}
                  </div>
                )}
                {!form.track_inventory && (
                  <p className="px-4 py-3 text-xs text-gray-400">Inventory not tracked — product will always appear as available.</p>
                )}
              </div>
            </>
          )}

          {/* ── VARIANTS ── */}
          {activeTab === 'variants' && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Product Variants</p>
                  <p className="text-xs text-gray-400 mt-0.5">e.g. sizes, colours, flavours</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                  <Plus size={14} className="mr-1" /> Add Variant
                </Button>
              </div>

              {variants.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-xl">
                  <p className="text-sm text-gray-400">No variants — product has a single option.</p>
                  <button onClick={addVariant} className="text-xs text-blue-500 hover:underline mt-1">
                    Add a variant
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Header row */}
                  <div className="grid grid-cols-[1fr_72px_64px_80px_96px_28px] gap-2 px-1">
                    {['Name', '+/- RM', 'Stock', 'SKU', 'Barcode', ''].map(h => (
                      <span key={h} className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{h}</span>
                    ))}
                  </div>
                  {variants.map((v, i) => {
                    const finalVariantPrice = price + Number(v.price_modifier)
                    return (
                      <div key={i} className="grid grid-cols-[1fr_72px_64px_80px_96px_28px] gap-2 items-center">
                        <Input placeholder="e.g. Large" value={v.name}
                          onChange={e => updateVariant(i, 'name', e.target.value)} />
                        <div className="relative">
                          <Input type="number" step="0.01" value={v.price_modifier}
                            onChange={e => updateVariant(i, 'price_modifier', e.target.value)} />
                          {price > 0 && (
                            <span className="absolute -bottom-4 left-0 text-[9px] text-gray-400 whitespace-nowrap">
                              = RM {finalVariantPrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <Input type="number" min="0" placeholder="0" value={v.stock_quantity}
                          onChange={e => updateVariant(i, 'stock_quantity', e.target.value)} />
                        <Input placeholder="SKU" value={v.sku || ''}
                          onChange={e => updateVariant(i, 'sku', e.target.value)} />
                        <Input placeholder="Barcode" value={v.barcode || ''}
                          onChange={e => updateVariant(i, 'barcode', e.target.value)} />
                        <button onClick={() => removeVariant(i)}
                          className="text-red-400 hover:text-red-600 transition-colors flex items-center justify-center">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* ── DETAILS ── */}
          {activeTab === 'details' && (
            <ProductTypeFields
              storeType={storeType}
              values={customFields}
              onChange={(k, v) => setCustomFields(p => ({ ...p, [k]: v }))}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 items-center">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving
              ? <><Loader2 size={16} className="animate-spin mr-2" />Saving...</>
              : (isNew ? 'Create Product' : 'Save Changes')}
          </Button>
        </div>
      </div>
    </div>
  )
}
