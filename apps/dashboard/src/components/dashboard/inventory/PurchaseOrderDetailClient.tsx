'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { 
  FileText, 
  Send, 
  XCircle, 
  Truck, 
  Download, 
  ChevronLeft,
  Mail,
  Calendar,
  Clock,
  ExternalLink,
  ChevronRight,
  TrendingDown,
  ArrowRight,
  Zap,
  Package
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
  sendPurchaseOrder, 
  cancelPurchaseOrder 
} from '@/lib/purchase-order-actions'
import { GoodsReceivingModal } from './GoodsReceivingModal'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  partially_received: 'bg-yellow-100 text-yellow-700',
  received: 'bg-green-100 text-green-700',
  closed: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-red-100 text-red-700'
}

export function PurchaseOrderDetailClient({ po }: { po: any }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [receivingOpen, setReceivingOpen] = useState(false)

  const handleSend = () => {
    startTransition(async () => {
      try {
        await sendPurchaseOrder(po.id)
        toast.success('PO marked as sent')
        router.refresh()
      } catch (error) {
        toast.error('Failed to send PO')
      }
    })
  }

  const handleCancel = () => {
    if (!confirm('Are you sure you want to cancel this PO?')) return
    startTransition(async () => {
      try {
        await cancelPurchaseOrder(po.id)
        toast.success('PO cancelled')
        router.refresh()
      } catch (error) {
        toast.error('Failed to cancel PO')
      }
    })
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ChevronLeft size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{po.po_number}</h1>
              <Badge variant="secondary" className={cn(
                "rounded-lg px-2 py-0.5 text-[10px] uppercase font-bold border-none",
                STATUS_COLORS[po.status] || 'bg-gray-100'
              )}>
                {po.status.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-sm text-gray-500">PO order for {po.suppliers?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {po.status === 'draft' && (
            <>
              <Button variant="ghost" onClick={handleCancel} className="text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl">
                <XCircle size={18} className="mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={isPending} className="rounded-xl px-6">
                <Send size={18} className="mr-2" />
                {isPending ? 'Processing...' : 'Mark as Sent'}
              </Button>
            </>
          )}

          {(po.status === 'sent' || po.status === 'partially_received') && (
            <Button onClick={() => setReceivingOpen(true)} className="rounded-xl px-6 bg-green-600 hover:bg-green-700">
              <Truck size={18} className="mr-2" />
              Receive Goods
            </Button>
          )}

          <Button variant="outline" className="rounded-xl px-6 hover:bg-gray-50">
            <Download size={18} className="mr-2" />
            PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-gray-400">Order Items</CardTitle>
              <Package size={16} className="text-blue-500" />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Ordered</TableHead>
                    <TableHead className="text-center">Received</TableHead>
                    <TableHead className="text-right">Unit Cost (RM)</TableHead>
                    <TableHead className="text-right">Total (RM)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {po.purchase_order_items.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium text-gray-900">{item.products?.name}</TableCell>
                      <TableCell className="text-center font-bold text-gray-900">{item.quantity_ordered}</TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded-lg text-xs font-bold",
                          item.quantity_received === 0 ? "bg-gray-100 text-gray-400" :
                          item.quantity_received < item.quantity_ordered ? "bg-yellow-100 text-yellow-700" :
                          "bg-green-100 text-green-700"
                        )}>
                          {item.quantity_received}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{item.unit_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-bold text-gray-900">{item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-6 border-t border-gray-100 flex flex-col items-end gap-2">
                <div className="flex items-center gap-24 text-sm">
                   <span className="text-gray-500 font-medium">Subtotal</span>
                   <span className="font-bold text-gray-900">RM {po.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center gap-24 text-2xl mt-2 font-extrabold text-blue-600">
                   <span className="text-xs uppercase tracking-widest text-gray-400">Grand Total</span>
                   <span>RM {po.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-gray-400">Supplier</CardTitle>
              <Truck size={16} className="text-gray-300" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-bold text-gray-900 text-lg uppercase italic tracking-tighter leading-none">{po.suppliers?.name}</p>
                <p className="text-xs text-gray-400 font-bold mt-1 uppercase leading-none">{po.suppliers?.code}</p>
              </div>
              <div className="space-y-2 pt-2">
                {po.suppliers?.email && (
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Mail size={16} className="text-gray-300" />
                    <span>{po.suppliers.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm text-gray-600 border border-transparent border-t-gray-100 pt-2 mt-2">
                  <Calendar size={16} className="text-gray-300" />
                  <div>
                    <p className="text-[10px] uppercase font-extrabold text-gray-400 leading-none">Order Date</p>
                    <p className="font-semibold text-gray-700 mt-1">{new Date(po.order_date).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {po.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-gray-400">Notes</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 leading-relaxed font-medium">
                {po.notes}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {receivingOpen && (
        <GoodsReceivingModal 
          po={po} 
          onClose={() => {
            setReceivingOpen(false)
            router.refresh()
          }} 
        />
      )}
    </div>
  )
}
