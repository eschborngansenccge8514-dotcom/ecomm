'use client'

import React, { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowUpRight, 
  ChevronLeft, 
  MapPin, 
  Package, 
  Send, 
  CheckCircle2, 
  XRed,
  XCircle,
  Truck
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  shipTransfer, 
  receiveTransfer, 
  cancelTransfer 
} from '@/lib/transfer-actions'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  in_transit: 'bg-blue-100 text-blue-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700'
}

export function TransferDetailClient({ transfer }: { transfer: any }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleShip = () => {
    startTransition(async () => {
      try {
        await shipTransfer(transfer.id)
        toast.success('Transfer shipped')
        router.refresh()
      } catch (error) {
        toast.error('Failed to ship transfer')
      }
    })
  }

  const handleReceive = () => {
    startTransition(async () => {
      try {
        // For simplicity in this demo, receiving all items at once
        const items = transfer.stock_transfer_items.map((i: any) => ({
          item_id: i.id,
          quantity_received: i.quantity
        }))
        await receiveTransfer(transfer.id, items)
        toast.success('Transfer received')
        router.refresh()
      } catch (error) {
        toast.error('Failed to receive transfer')
      }
    })
  }

  const handleCancel = () => {
    if (!confirm('Are you sure you want to cancel this transfer?')) return
    startTransition(async () => {
      try {
        await cancelTransfer(transfer.id)
        toast.success('Transfer cancelled')
        router.refresh()
      } catch (error) {
        toast.error('Failed to cancel transfer')
      }
    })
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ChevronLeft size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{transfer.transfer_number}</h1>
              <Badge variant="secondary" className={cn(
                "rounded-lg px-2 py-0.5 text-[10px] uppercase font-bold border-none",
                STATUS_COLORS[transfer.status] || 'bg-gray-100'
              )}>
                {transfer.status.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-sm text-gray-500">Internal stock movement</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {transfer.status === 'draft' && (
            <>
              <Button variant="ghost" onClick={handleCancel} className="text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl">
                <XCircle size={18} className="mr-2" />
                Cancel
              </Button>
              <Button onClick={handleShip} disabled={isPending} className="rounded-xl px-6">
                <Send size={18} className="mr-2" />
                {isPending ? 'Processing...' : 'Ship Transfer'}
              </Button>
            </>
          )}

          {transfer.status === 'in_transit' && (
            <Button onClick={handleReceive} disabled={isPending} className="rounded-xl px-6 bg-green-600 hover:bg-green-700">
              <CheckCircle2 size={18} className="mr-2" />
              {isPending ? 'Processing...' : 'Mark as Received'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-gray-400">Route</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 relative">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gray-50 rounded-xl">
                <MapPin size={20} className="text-gray-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none">Source</p>
                <p className="font-bold text-gray-900 mt-1 uppercase italic tracking-tighter leading-none">{transfer.from?.name}</p>
              </div>
            </div>
            
            <div className="ml-5 border-l-2 border-dashed border-gray-100 h-8"></div>

            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-50 rounded-xl">
                <MapPin size={20} className="text-blue-500" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none">Destination</p>
                <p className="font-bold text-gray-900 mt-1 uppercase italic tracking-tighter leading-none">{transfer.to?.name}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-gray-400">Transfer Items</CardTitle>
            <Package size={16} className="text-blue-500" />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfer.stock_transfer_items.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-gray-900">{item.products?.name}</TableCell>
                    <TableCell className="text-right font-bold text-gray-900">{item.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
