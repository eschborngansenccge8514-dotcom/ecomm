'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Plus, 
  Trash2, 
  Package, 
  Search, 
  Check, 
  Save, 
  ChevronLeft,
  Truck,
  DollarSign,
  ShoppingCart
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
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
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { searchProducts } from '@/lib/inventory-actions'
import { createPurchaseOrder } from '@/lib/purchase-order-actions'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'

export function PurchaseOrderFormClient({ suppliers }: { suppliers: any[] }) {
  const router = useRouter()
  const [supplierId, setSupplierId] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isPending, startTransition] = useTransition()

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
    const existing = items.find(i => i.product_id === product.id && i.variant_id === (variant?.id ?? null))
    if (existing) {
      toast.error('Item already in list')
      return
    }

    setItems([...items, {
      product_id: product.id,
      variant_id: variant?.id ?? null,
      name: product.name + (variant ? ` (${variant.name})` : ''),
      quantity_ordered: 1,
      unit_cost: product.costPrice || 0
    }])
    setProductSearch('')
    setSearchResults([])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index][field] = value
    setItems(newItems)
  }

  const subtotal = items.reduce((acc, item) => acc + (item.quantity_ordered * item.unit_cost), 0)

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
        await createPurchaseOrder({
          supplier_id: supplierId,
          items: items.map(i => ({
            product_id: i.product_id,
            variant_id: i.variant_id,
            quantity_ordered: parseInt(i.quantity_ordered),
            unit_cost: parseFloat(i.unit_cost)
          }))
        })
        toast.success('Purchase order created')
        router.push('/inventory/purchase-orders')
        router.refresh()
      } catch (error) {
        toast.error('Failed to create purchase order')
        console.error(error)
      }
    })
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ChevronLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New Purchase Order</h1>
            <p className="text-sm text-gray-500">Select a supplier and add products to restock.</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isPending} className="rounded-xl px-6">
          <Check size={18} className="mr-2" />
          {isPending ? 'Creating...' : 'Create Draft PO'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>PO Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Select onValueChange={setSupplierId} value={supplierId}>
                <SelectTrigger className="rounded-xl border-gray-100 shadow-sm">
                  <SelectValue placeholder="Select a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Order Items</CardTitle>
            <div className="relative w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input 
                placeholder="Search products to add..." 
                value={productSearch}
                onChange={e => handleSearch(e.target.value)}
                className="pl-10 rounded-xl h-9 border-gray-100 shadow-sm text-xs"
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
                  {searchResults.map(p => (
                    <React.Fragment key={p.id}>
                      {p.product_variants && p.product_variants.length > 0 ? (
                        p.product_variants.map((v: any) => (
                          <div 
                            key={v.id}
                            className="p-3 hover:bg-blue-50 cursor-pointer text-sm flex justify-between group"
                            onClick={() => addItem(p, v)}
                          >
                            <div>
                              <p className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors uppercase italic tracking-tighter">
                                {p.name} ({v.name})
                              </p>
                              <p className="text-xs text-gray-400">{v.sku || p.sku}</p>
                            </div>
                            <Plus size={14} className="text-blue-500 opacity-0 group-hover:opacity-100" />
                          </div>
                        ))
                      ) : (
                        <div 
                          className="p-3 hover:bg-blue-50 cursor-pointer text-sm flex justify-between group"
                          onClick={() => addItem(p)}
                        >
                          <div>
                            <p className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors uppercase italic tracking-tighter">
                              {p.name}
                            </p>
                            <p className="text-xs text-gray-400">{p.sku}</p>
                          </div>
                          <Plus size={14} className="text-blue-500 opacity-0 group-hover:opacity-100" />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit Cost (RM)</TableHead>
                  <TableHead>Total (RM)</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length > 0 ? items.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-gray-900">{item.name}</TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        value={item.quantity_ordered} 
                        onChange={e => updateItem(i, 'quantity_ordered', e.target.value)}
                        className="w-20 h-8 rounded-lg"
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        value={item.unit_cost} 
                        onChange={e => updateItem(i, 'unit_cost', e.target.value)}
                        className="w-24 h-8 rounded-lg"
                      />
                    </TableCell>
                    <TableCell className="font-bold text-gray-900">
                      {(item.quantity_ordered * item.unit_cost).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500 h-8 w-8">
                        <Trash2 size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center text-gray-400 italic text-sm">
                      No items added yet. Search and add products above.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="p-6 border-t border-gray-100 flex justify-end">
              <div className="text-right space-y-1">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Grand Total</p>
                <p className="text-3xl font-extrabold text-blue-600">
                  RM {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
