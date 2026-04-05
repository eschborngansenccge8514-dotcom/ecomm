'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Package, 
  Truck, 
  ShoppingCart, 
  AlertCircle, 
  CheckCircle2,
  ChevronRight,
  MoreVertical,
  Plus
} from 'lucide-react'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { createDraftPOFromSuggestions } from '@/lib/purchase-order-actions'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface Recommendation {
  product_id: string
  variant_id: string | null
  name: string
  current_stock: number
  avg_daily_sales: number
  days_remaining: number
  suggested_qty: number
  preferred_supplier_id: string | null
  preferred_supplier_name: string | null
  unit_cost: number
}

export function ReorderSuggestionsClient({ recommendations }: { recommendations: Recommendation[] }) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(recommendations.map(r => r.product_id + (r.variant_id ?? '')))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectRow = (checked: boolean, id: string) => {
    if (checked) {
      setSelectedIds([...selectedIds, id])
    } else {
      setSelectedIds(selectedIds.filter(i => i !== id))
    }
  }

  const handleCreatePOs = async () => {
    if (selectedIds.length === 0) return

    startTransition(async () => {
      try {
        const selectedRecs = recommendations.filter(r => 
          selectedIds.includes(r.product_id + (r.variant_id ?? ''))
        )
        
        const pos = await createDraftPOFromSuggestions(selectedRecs)
        toast.success(`Successfully created ${pos.length} draft purchase orders.`)
        router.push('/inventory/purchase-orders')
      } catch (error) {
        toast.error('Failed to create purchase orders.')
        console.error(error)
      }
    })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reorder Suggestions</h1>
          <p className="text-gray-500">Smart recommendations based on sales velocity and stock levels.</p>
        </div>
        <Button 
          onClick={handleCreatePOs} 
          disabled={selectedIds.length === 0 || isPending}
          className="rounded-xl font-semibold shadow-sm"
        >
          {isPending ? 'Processing...' : `Create Purchase Order${selectedIds.length > 1 ? 's' : ''} (${selectedIds.length})`}
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[50px]">
                <Checkbox 
                  checked={selectedIds.length === recommendations.length && recommendations.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Current Stock</TableHead>
              <TableHead>Avg Daily Sales</TableHead>
              <TableHead>Days Remaining</TableHead>
              <TableHead>Suggested Qty</TableHead>
              <TableHead>Preferred Supplier</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recommendations.length > 0 ? recommendations.map((rec) => {
              const id = rec.product_id + (rec.variant_id ?? '')
              const isSelected = selectedIds.includes(id)
              const isLowStock = rec.days_remaining < 7

              return (
                <TableRow key={id} className={cn(isSelected && 'bg-blue-50/50')}>
                  <TableCell>
                    <Checkbox 
                      checked={isSelected}
                      onCheckedChange={(checked) => handleSelectRow(checked as boolean, id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-gray-900">{rec.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-bold",
                        rec.current_stock <= 0 ? "text-red-600" : isLowStock ? "text-yellow-600" : "text-gray-900"
                      )}>
                        {rec.current_stock}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600">{rec.avg_daily_sales.toFixed(2)}</TableCell>
                  <TableCell>
                    <div className={cn(
                      "px-2 py-1 rounded-lg text-xs font-bold inline-flex",
                      rec.days_remaining <= 3 ? "bg-red-50 text-red-600" : rec.days_remaining < 7 ? "bg-yellow-50 text-yellow-600" : "bg-green-50 text-green-600"
                    )}>
                      {rec.days_remaining === 9999 ? '∞' : Math.ceil(rec.days_remaining)} days
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-gray-900">{rec.suggested_qty}</TableCell>
                  <TableCell>
                    {rec.preferred_supplier_name ? (
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <Truck size={14} className="text-gray-400" />
                        <span>{rec.preferred_supplier_name}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs italic">No supplier linked</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            }) : (
              <TableRow>
                <TableCell colSpan={7} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center gap-3 text-gray-500">
                    <CheckCircle2 size={40} className="text-green-500" />
                    <div>
                      <p className="font-semibold text-gray-900">All stocked up!</p>
                      <p className="text-sm">No products currently need reordering.</p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
