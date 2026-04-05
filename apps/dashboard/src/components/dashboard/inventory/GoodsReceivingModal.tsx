'use client'

import React, { useState, useTransition } from 'react'
import { 
  X, 
  Check, 
  Truck, 
  Package, 
  AlertCircle,
  Truck as TruckIcon
} from 'lucide-react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { receiveGoods } from '@/lib/purchase-order-actions'
import { toast } from 'react-hot-toast'

interface GoodsReceivingModalProps {
  po: any
  onClose: () => void
}

export function GoodsReceivingModal({ po, onClose }: GoodsReceivingModalProps) {
  const [items, setItems] = useState(
    po.purchase_order_items.map((i: any) => ({
      po_item_id: i.id,
      name: i.products?.name,
      ordered: i.quantity_ordered,
      already_received: i.quantity_received,
      receiving: i.quantity_ordered - i.quantity_received
    }))
  )
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleUpdateQty = (index: number, val: string) => {
    const newItems = [...items]
    newItems[index].receiving = parseInt(val) || 0
    setItems(newItems)
  }

  const handleReceive = () => {
    const itemsToReceive = items
      .filter(i => i.receiving > 0)
      .map(i => ({ po_item_id: i.po_item_id, quantity: i.receiving }))

    if (itemsToReceive.length === 0) {
      toast.error('No items to receive')
      return
    }

    startTransition(async () => {
      try {
        await receiveGoods(po.id, itemsToReceive, notes)
        toast.success('Goods received successfully')
        onClose()
      } catch (error) {
        toast.error('Failed to receive goods')
        console.error(error)
      }
    })
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 bg-slate-900 text-white flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-slate-800 rounded-xl">
               <TruckIcon size={24} className="text-blue-400" />
             </div>
             <div>
               <DialogTitle className="text-xl font-bold">Receive Goods</DialogTitle>
               <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">PO: {po.po_number}</p>
             </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-slate-400 hover:text-white hover:bg-slate-800">
            <X size={20} />
          </Button>
        </DialogHeader>

        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          <div className="bg-blue-50/50 p-4 rounded-2xl flex items-center gap-3 text-blue-800 border border-blue-100/50">
            <AlertCircle size={20} className="text-blue-500 shrink-0" />
            <p className="text-xs font-semibold uppercase tracking-tight italic">Inventory levels will increment automatically for items with received quantities.</p>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="border-b-gray-100">
                <TableHead>Product</TableHead>
                <TableHead className="text-center">Ordered</TableHead>
                <TableHead className="text-center">Already Recv</TableHead>
                <TableHead className="text-right w-32">Receiving Now</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any, i: number) => (
                <TableRow key={item.po_item_id} className="border-b-gray-50/50 hover:bg-gray-50/50 transition-colors">
                  <TableCell className="font-bold text-gray-900 text-sm">{item.name}</TableCell>
                  <TableCell className="text-center text-gray-500 font-medium">{item.ordered}</TableCell>
                  <TableCell className="text-center font-bold text-blue-600">{item.already_received}</TableCell>
                  <TableCell className="text-right">
                    <Input 
                      type="number" 
                      value={item.receiving} 
                      onChange={e => handleUpdateQty(i, e.target.value)}
                      className="w-24 ml-auto text-right font-black rounded-xl border-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="space-y-2 px-4 pt-4 border-t border-gray-100/50">
            <Label className="text-[10px] uppercase font-extrabold text-gray-400 tracking-widest pl-2">Notes / Reason</Label>
            <Input 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              placeholder="e.g. Batch #123, partial delivery" 
              className="rounded-2xl border-gray-100 h-12 bg-gray-50/50 text-sm font-medium"
            />
          </div>
        </div>

        <DialogFooter className="p-6 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between gap-4">
           <Button variant="ghost" onClick={onClose} className="rounded-xl px-6 font-bold text-gray-400 hover:text-gray-900">
            Cancel
           </Button>
           <Button onClick={handleReceive} disabled={isPending} className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-10 h-12 font-extrabold shadow-lg shadow-blue-200">
             {isPending ? 'Processing...' : 'Confirm Receipt'}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
