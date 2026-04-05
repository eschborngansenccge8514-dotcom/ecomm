'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Plus, 
  Trash2, 
  Search, 
  Check, 
  ChevronLeft,
  MapPin,
  ArrowRight,
  Package
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
import { createTransfer } from '@/lib/transfer-actions'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'

export function TransferFormClient({ outlets }: { outlets: any[] }) {
  const router = useRouter()
  const [fromOutletId, setFromOutletId] = useState('')
  const [toOutletId, setToOutletId] = useState('')
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
      quantity: 1
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

  const handleSave = () => {
    if (!fromOutletId || !toOutletId) {
      toast.error('Please select both source and destination')
      return
    }
    if (fromOutletId === toOutletId) {
      toast.error('Source and destination cannot be the same')
      return
    }
    if (items.length === 0) {
      toast.error('Please add at least one item')
      return
    }

    startTransition(async () => {
      try {
        await createTransfer({
          fromOutletId,
          toOutletId,
          items: items.map(i => ({
            productId: i.product_id,
            variantId: i.variant_id,
            quantity: parseInt(i.quantity)
          }))
        })
        toast.success('Transfer created')
        router.push('/inventory/transfers')
        router.refresh()
      } catch (error) {
        toast.error('Failed to create transfer')
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
            <h1 className="text-2xl font-bold text-gray-900">New Stock Transfer</h1>
            <p className="text-sm text-gray-500">Move products between your stores.</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isPending} className="rounded-xl px-6">
          <Check size={18} className="mr-2" />
          {isPending ? 'Processing...' : 'Create Draft Transfer'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Route</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Source (From)</Label>
              <Select onValueChange={setFromOutletId} value={fromOutletId}>
                <SelectTrigger className="rounded-xl border-gray-100 shadow-sm">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {outlets.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-center py-2 text-gray-300">
              <ArrowRight size={24} />
            </div>
            <div className="space-y-2">
              <Label>Destination (To)</Label>
              <Select onValueChange={setToOutletId} value={toOutletId}>
                <SelectTrigger className="rounded-xl border-gray-100 shadow-sm">
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  {outlets.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Transfer Items</CardTitle>
            <div className="relative w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input 
                placeholder="Search products..." 
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
                  <TableHead>Quantity</TableHead>
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
                        value={item.quantity} 
                        onChange={e => updateItem(i, 'quantity', e.target.value)}
                        className="w-24 h-8 rounded-lg"
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500 h-8 w-8">
                        <Trash2 size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-48 text-center text-gray-400 italic text-sm">
                      No items added yet. Search and add products above.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
