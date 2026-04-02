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
import { type StoreType } from '@/lib/store-types'
import { ProductTypeFields } from './ProductTypeFields'

interface Variant { id?: string; name: string; price_modifier: number; stock_quantity: number }

export function ProductFormModal({ merchantId, categories, product, storeType, onClose, onSaved }: {
  merchantId: string; categories: any[]; product: any | null; storeType: StoreType
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
    track_inventory: product?.track_inventory ?? true,
    stock_quantity: product?.stock_quantity ?? 0,
  })
  const [variants, setVariants]         = useState<Variant[]>(product?.variants ?? [])
  const [images, setImages]             = useState<string[]>(product?.images ?? [])
  const [uploading, setUploading]       = useState(false)
  const [saving, setSaving]             = useState(false)
  const [customFields, setCustomFields] = useState<Record<string, string>>({})
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
        track_inventory: form.track_inventory,
        stock_quantity: form.track_inventory ? Number(form.stock_quantity) : 9999,
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

      // Upsert custom attributes
      const customAttrPayload = Object.entries(customFields)
        .filter(([_, v]) => v.trim())
        .map(([k, v]) => ({
          product_id:     savedProduct.id,
          merchant_id:    merchantId,
          key:            k,
          value:          v,
        }))
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
            <Switch checked={form.track_inventory} onCheckedChange={v => set('track_inventory', v)} />
          </div>
          {form.track_inventory && (
            <div>
              <Label>Stock Quantity</Label>
              <Input type="number" min="0" value={form.stock_quantity}
                onChange={e => set('stock_quantity', e.target.value)} />
            </div>
          )}

          {/* Type-specific custom fields */}
          <ProductTypeFields
            storeType={storeType}
            values={customFields}
            onChange={(k, v) => setCustomFields(p => ({ ...p, [k]: v }))}
          />

          {/* Variants */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Variants (e.g. sizes, flavours)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                <Plus size={14} className="mr-1" /> Add Variant
              </Button>
            </div>
            {variants?.length === 0 && (
              <p className="text-xs text-gray-400">No variants — product has a single option.</p>
            )}
            <div className="space-y-2">
              {variants?.map((v, i) => (
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
