'use client'

import React, { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Trash2,
  Search,
  Check,
  ChevronLeft,
  Package,
  Truck,
  CalendarDays,
  StickyNote,
  ShoppingCart,
  Minus,
  AlertCircle,
  Building2,
  FileText,
  XCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { searchProducts } from '@/lib/inventory-actions'
import { createPurchaseOrder, updatePurchaseOrderFull } from '@/lib/purchase-order-actions'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface LineItem {
  product_id: string
  variant_id: string | null
  name: string
  sku: string
  quantity_ordered: number
  unit_cost: number
}

function QuantityStepper({
  value,
  onChange
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-1 justify-center">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-100 flex items-center justify-center transition-colors text-gray-500"
      >
        <Minus size={12} />
      </button>
      <input
        type="number"
        value={value}
        min={1}
        onChange={e => {
          const n = parseInt(e.target.value)
          if (!isNaN(n) && n >= 1) onChange(n)
        }}
        className="w-10 h-7 text-center text-sm font-bold text-gray-900 bg-transparent border-0 focus:outline-none focus:ring-0 p-0"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-100 flex items-center justify-center transition-colors text-gray-500"
      >
        <Plus size={12} />
      </button>
    </div>
  )
}

export function PurchaseOrderFormClient({
  suppliers,
  initialData
}: {
  suppliers: any[]
  initialData?: any
}) {
  const router = useRouter()
  const [supplierId, setSupplierId] = useState<string>(initialData?.supplier_id || '')
  const [expectedDate, setExpectedDate] = useState<string>(
    initialData?.expected_date
      ? new Date(initialData.expected_date).toISOString().split('T')[0]
      : ''
  )
  const [notes, setNotes] = useState<string>(initialData?.notes || '')
  const [items, setItems] = useState<LineItem[]>(
    initialData?.purchase_order_items?.map((i: any) => ({
      product_id: i.product_id,
      variant_id: i.variant_id,
      name: i.products?.name + (i.variant_id ? ` (Variant)` : ''),
      sku: i.products?.sku || '',
      quantity_ordered: i.quantity_ordered,
      unit_cost: i.unit_cost
    })) || []
  )
  const [productSearch, setProductSearch] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchFocused, setSearchFocused] = useState(false)
  const [isPending, startTransition] = useTransition()
  const searchRef = useRef<HTMLDivElement>(null)

  const isEdit = !!initialData

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSearch = async (val: string) => {
    setProductSearch(val)
    if (val.length < 2) {
      setSearchResults([])
      return
    }
    const results = await searchProducts(val)
    setSearchResults(results)
  }

  const addItem = (product: any, variant: any = null) => {
    const existing = items.find(
      i => i.product_id === product.id && i.variant_id === (variant?.id ?? null)
    )
    if (existing) {
      toast.error('Already added')
      return
    }
    setItems(prev => [
      ...prev,
      {
        product_id: product.id,
        variant_id: variant?.id ?? null,
        name: product.name + (variant ? ` — ${variant.name}` : ''),
        sku: variant?.sku || product.sku || '',
        quantity_ordered: 1,
        unit_cost: product.costPrice || 0
      }
    ])
    setProductSearch('')
    setSearchResults([])
    setSearchFocused(false)
  }

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof LineItem, value: any) => {
    setItems(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const subtotal = items.reduce(
    (acc, item) => acc + item.quantity_ordered * item.unit_cost,
    0
  )

  const handleSave = () => {
    if (!supplierId) {
      toast.error('Please select a supplier')
      return
    }
    if (items.length === 0) {
      toast.error('Please add at least one item')
      return
    }

    startTransition(async () => {
      try {
        const payload = {
          supplier_id: supplierId,
          expected_date: expectedDate || undefined,
          notes: notes || undefined,
          items: items.map(i => ({
            product_id: i.product_id,
            variant_id: i.variant_id ?? undefined,
            quantity_ordered: i.quantity_ordered,
            unit_cost: i.unit_cost
          }))
        }

        if (isEdit) {
          await updatePurchaseOrderFull(initialData.id, payload)
          toast.success('Purchase order updated')
          router.push(`/inventory/purchase-orders/${initialData.id}`)
        } else {
          await createPurchaseOrder(payload)
          toast.success('Purchase order created')
          router.push('/inventory/purchase-orders')
        }
        router.refresh()
      } catch (error) {
        toast.error(isEdit ? 'Failed to update' : 'Failed to create')
        console.error(error)
      }
    })
  }

  const showDropdown = searchFocused && (searchResults.length > 0 || productSearch.length >= 2)

  return (
    <div className="max-w-5xl mx-auto pb-12">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white border border-gray-100 shadow-sm hover:bg-gray-50">
            <ChevronLeft size={18} className="text-gray-600" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              {isEdit ? `Edit ${initialData.po_number}` : 'New Purchase Order'}
            </h1>
            <p className="text-sm text-gray-500 mt-1 uppercase font-bold tracking-tighter">
              {isEdit ? 'Draft PO Details' : 'Draft PO Details'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-xl px-6 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 font-bold text-sm h-10 transition-all"
          >
            <Check size={16} className="mr-2" />
            {isPending
              ? isEdit ? 'Saving…' : 'Creating…'
              : isEdit ? 'Save Changes' : 'Create Draft PO'}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* ── Info Section ── */}
        <Card className="rounded-[24px] border-gray-50 shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-gray-50 bg-gray-50/30">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-gray-400">Order Information</CardTitle>
            <FileText size={16} className="text-gray-300" />
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Side: Supplier */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Supplier / Vendor</Label>
                  <Select
                    onValueChange={(val: string | null) => setSupplierId(val || '')}
                    value={supplierId}
                  >
                    <SelectTrigger className={cn(
                      "rounded-xl border-gray-100 shadow-sm h-11 font-semibold text-sm bg-white hover:bg-gray-50/50 transition-colors",
                      !supplierId && "text-gray-400"
                    )}>
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className={supplierId ? "text-blue-500" : "text-gray-400"} />
                        <SelectValue placeholder="Select supplier…" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-gray-100 shadow-xl">
                      {suppliers.map(s => (
                        <SelectItem key={s.id} value={s.id} className="font-medium rounded-lg cursor-pointer">
                          <span className="font-bold text-gray-900">{s.name}</span>
                          <span className="text-gray-400 ml-2 text-xs">{s.code}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!supplierId && (
                    <p className="text-[10px] text-amber-500 font-bold flex items-center gap-1 mt-1">
                      <AlertCircle size={10} /> Supplier is required to save
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Notes (Optional)</Label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Instructions or comments for the supplier…"
                    rows={3}
                    className="w-full p-3 rounded-xl border border-gray-100 shadow-sm text-sm text-gray-700 font-medium placeholder:text-gray-300 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:outline-none resize-none transition-all bg-white hover:bg-gray-50/50"
                  />
                </div>
              </div>

              {/* Right Side: Dates */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    Date
                  </Label>
                  <div className="flex items-center gap-3 px-4 h-11 rounded-xl border border-gray-100 shadow-sm bg-gray-50 text-gray-500 text-sm font-semibold cursor-not-allowed">
                    <CalendarDays size={16} className="text-gray-400" />
                    <span>{new Date().toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Expected Delivery</Label>
                  <div className="relative">
                    <Input
                      type="date"
                      value={expectedDate}
                      onChange={e => setExpectedDate(e.target.value)}
                      className="rounded-xl border-gray-100 shadow-sm h-11 font-semibold text-sm text-gray-700 bg-white hover:bg-gray-50/50 focus:ring-2 focus:ring-blue-400 transition-all pl-10"
                    />
                    <Truck size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Line Items Section ── */}
        <Card className="rounded-[24px] border-gray-50 shadow-sm overflow-visible">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-50 bg-gray-50/30 gap-4">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-gray-400">Order Items</CardTitle>
            
            {/* Search Bar Inline */}
            <div ref={searchRef} className="relative w-full sm:w-72 md:w-96">
              <div className={cn(
                "flex items-center gap-2 px-3 h-9 rounded-lg border bg-white transition-all shadow-sm",
                searchFocused ? "border-blue-400 ring-2 ring-blue-50 shadow-md" : "border-gray-200 hover:border-gray-300"
              )}>
                <Search size={14} className={cn(
                  "flex-shrink-0 transition-colors",
                  searchFocused ? "text-blue-500" : "text-gray-400"
                )} />
                <input
                  type="text"
                  placeholder="Search products by name or SKU…"
                  value={productSearch}
                  onFocus={() => setSearchFocused(true)}
                  onChange={e => handleSearch(e.target.value)}
                  className="flex-1 bg-transparent text-xs font-semibold text-gray-700 placeholder:text-gray-400 focus:outline-none"
                />
                {productSearch && (
                  <button
                    onClick={() => { setProductSearch(''); setSearchResults([]) }}
                    className="text-gray-400 hover:text-gray-600 font-bold transition-colors"
                  >
                    <XCircle size={14} />
                  </button>
                )}
              </div>

              {/* Dropdown */}
              {showDropdown && (
                <div className="absolute top-full right-0 mt-2 w-[calc(100vw-2rem)] sm:w-[400px] bg-white border border-gray-100 rounded-xl shadow-2xl z-50 max-h-[300px] overflow-y-auto divide-y divide-gray-50">
                  {searchResults.length === 0 && productSearch.length >= 2 ? (
                    <div className="p-4 text-center text-sm text-gray-400 font-medium">
                      No products found for "{productSearch}"
                    </div>
                  ) : (
                    searchResults.map(p => (
                      <React.Fragment key={p.id}>
                        {p.product_variants && p.product_variants.length > 0 ? (
                          p.product_variants.map((v: any) => (
                            <SearchResultRow
                              key={v.id}
                              name={p.name}
                              variant={v.name}
                              sku={v.sku || p.sku}
                              cost={p.costPrice}
                              onClick={() => addItem(p, v)}
                            />
                          ))
                        ) : (
                          <SearchResultRow
                            key={p.id}
                            name={p.name}
                            sku={p.sku}
                            cost={p.costPrice}
                            onClick={() => addItem(p)}
                          />
                        )}
                      </React.Fragment>
                    ))
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-16 h-16 rounded-3xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                  <ShoppingCart size={24} className="text-gray-300" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-600">No items added</p>
                  <p className="text-xs text-gray-400 font-medium mt-1 max-w-[200px] leading-tight">
                    Search for products in the bar above to add them to this order
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                  {/* Table Headers */}
                  <div className="grid grid-cols-[1fr_120px_140px_140px_40px] gap-4 px-6 py-3 border-b border-gray-50 bg-gray-50/50">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Product</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center">Qty</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Unit Cost</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Total</span>
                    <span></span>
                  </div>

                  {/* Items list */}
                  <div className="divide-y divide-gray-50">
                    {items.map((item, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[1fr_120px_140px_140px_40px] gap-4 items-center px-6 py-3 hover:bg-gray-50/30 transition-colors group"
                      >
                        {/* Product Info */}
                        <div className="min-w-0 pr-4">
                          <p className="font-bold text-gray-900 text-xs sm:text-sm uppercase italic tracking-tighter truncate leading-tight">
                            {item.name}
                          </p>
                          {item.sku && (
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5 truncate">
                              {item.sku}
                            </p>
                          )}
                        </div>

                        {/* Quantity */}
                        <div className="flex justify-center">
                          <QuantityStepper
                            value={item.quantity_ordered}
                            onChange={v => updateItem(i, 'quantity_ordered', v)}
                          />
                        </div>

                        {/* Unit Cost */}
                        <div className="flex justify-end">
                          <div className="relative w-28">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                              RM
                            </span>
                            <input
                              type="number"
                              value={item.unit_cost}
                              min={0}
                              step={0.01}
                              onChange={e => {
                                const v = parseFloat(e.target.value)
                                if (!isNaN(v) && v >= 0) updateItem(i, 'unit_cost', v)
                              }}
                              className="w-full h-8 text-right text-sm font-bold text-gray-900 bg-white border border-gray-200 rounded-lg pl-8 pr-3 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all hover:border-gray-300"
                            />
                          </div>
                        </div>

                        {/* Row Total */}
                        <div className="flex items-center justify-end">
                          <span className="font-bold text-gray-900 text-sm tabular-nums">
                            {(item.quantity_ordered * item.unit_cost).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </span>
                        </div>

                        {/* Delete Action */}
                        <div className="flex justify-center">
                          <button
                            onClick={() => removeItem(i)}
                            className="w-8 h-8 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Totals Footer */}
                  <div className="p-6 border-t border-gray-50 flex flex-col items-end gap-2 bg-gray-50/30">
                    <div className="flex items-center gap-24 text-sm font-medium text-gray-500">
                      <span>Total Units</span>
                      <span className="font-bold text-gray-900">{items.reduce((s, i) => s + i.quantity_ordered, 0)}</span>
                    </div>
                    <div className="flex items-center gap-24 text-sm font-medium text-gray-500">
                      <span>Subtotal</span>
                      <span className="font-bold text-gray-900">RM {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center gap-12 text-2xl mt-4 font-extrabold text-blue-600">
                      <span className="text-[10px] uppercase tracking-widest text-gray-400 font-extrabold">Grand Total</span>
                      <span>RM {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SearchResultRow({
  name,
  variant,
  sku,
  cost,
  onClick
}: {
  name: string
  variant?: string
  sku?: string
  cost?: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors group flex items-center justify-between gap-3"
    >
      <div className="min-w-0">
        <p className="text-sm font-bold text-gray-900 group-hover:text-blue-700 uppercase italic tracking-tighter truncate leading-none">
          {name}
          {variant && <span className="text-blue-500 not-italic normal-case tracking-normal font-semibold"> — {variant}</span>}
        </p>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1.5 leading-none flex items-center gap-2">
          {sku && <span>{sku}</span>}
          {sku && cost !== undefined && <span>·</span>}
          {cost !== undefined && <span className="text-gray-500">RM {cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>}
        </p>
      </div>
      <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all">
        <Plus size={14} className="text-blue-600" />
      </div>
    </button>
  )
}
