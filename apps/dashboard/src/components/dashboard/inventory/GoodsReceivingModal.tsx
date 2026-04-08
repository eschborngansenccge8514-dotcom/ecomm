'use client'

import { useState, useTransition } from 'react'
import {
  X,
  AlertCircle,
  Truck as TruckIcon
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
      variantName: i.product_variants?.name ?? null,
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
      .filter((i: any) => i.receiving > 0)
      .map((i: any) => ({ po_item_id: i.po_item_id, quantity: i.receiving }))

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
      <DialogContent className="!w-[min(560px,calc(100vw-2rem))] !max-w-none rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-5 bg-slate-900 text-white flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-slate-800 rounded-2xl">
               <TruckIcon size={32} className="text-blue-400" />
             </div>
             <div>
               <DialogTitle className="text-2xl font-black">Receive Goods</DialogTitle>
               <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">PO: {po.po_number} / {po.supplier?.name}</p>
             </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-slate-400 hover:text-white hover:bg-slate-800">
            <X size={24} />
          </Button>
        </DialogHeader>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          <div className="bg-blue-50/80 p-5 rounded-2xl flex items-center gap-4 text-blue-900 border border-blue-100 shadow-sm">
            <AlertCircle size={24} className="text-blue-500 shrink-0" />
            <p className="text-sm font-bold uppercase tracking-tight">Inventory levels will increment automatically for items with received quantities.</p>
          </div>

          <div className="rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex px-4 py-3 bg-gray-50 border-b border-gray-100 gap-3">
              <span className="flex-1 text-xs font-black text-gray-400 uppercase tracking-widest">Product</span>
              <span className="w-12 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Ord</span>
              <span className="w-12 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Rcvd</span>
              <span className="w-20 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Now</span>
            </div>
            {items.map((item: any, i: number) => (
              <div key={item.po_item_id} className="flex px-4 py-3 items-center border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors gap-3">
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-gray-900 text-sm truncate block">{item.name}</span>
                  {item.variantName && (
                    <span className="text-[10px] text-gray-400 font-medium">{item.variantName}</span>
                  )}
                </div>
                <span className="w-12 text-center text-gray-500 font-bold text-sm shrink-0">{item.ordered}</span>
                <span className="w-12 text-center font-black text-blue-600 text-sm shrink-0">{item.already_received}</span>
                <Input
                  type="number"
                  value={item.receiving}
                  onChange={e => handleUpdateQty(i, e.target.value)}
                  className="w-20 text-right font-black text-sm rounded-xl border-gray-200 h-9 shadow-sm bg-white shrink-0"
                />
              </div>
            ))}
          </div>

          <div className="space-y-3 pt-4 border-t border-gray-100">
            <Label className="text-xs uppercase font-black text-gray-400 tracking-[0.2em] pl-1">Notes / Reason</Label>
            <Input 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              placeholder="e.g. Batch #123, partial delivery" 
              className="rounded-2xl border-gray-200 h-14 bg-gray-50/50 text-base font-bold px-6 shadow-inner"
            />
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between gap-4">
           <Button variant="ghost" onClick={onClose} className="rounded-xl px-8 h-14 font-black text-gray-400 hover:text-gray-900 text-base">
            Cancel
           </Button>
           <Button onClick={handleReceive} disabled={isPending} className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-12 h-14 text-lg font-black shadow-xl shadow-blue-200 transition-all active:scale-95">
             {isPending ? 'Processing...' : 'Confirm Receipt'}
           </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
