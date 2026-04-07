'use client'

import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  Calendar,
  User,
  Package,
  FileText,
  CheckCircle2,
  DollarSign
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export function GoodsReceiptDetailClient({ receipt }: { receipt: any }) {
  const router = useRouter()

  const items: any[] = receipt.goods_receipt_items ?? []

  // Compute total value of this receipt using unit costs from linked PO items
  const receiptValue = items.reduce((sum, item) => {
    const unitCost = item.purchase_order_items?.unit_cost ?? 0
    return sum + unitCost * item.quantity_received
  }, 0)

  // PO fulfillment: how many units were ordered vs. now fully received
  const poTotal = receipt.purchase_orders?.total ?? 0
  const pctOfPO = poTotal > 0 ? Math.min(Math.round((receiptValue / poTotal) * 100), 100) : 0

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ChevronLeft size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Receipt {receipt.id.slice(0, 8).toUpperCase()}
              </h1>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100 text-[10px] font-extrabold uppercase tracking-widest">
                <CheckCircle2 size={10} />
                Received
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-1 uppercase font-bold tracking-tighter">
              Goods Receipt for PO {receipt.purchase_orders?.po_number}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => window.print()}
          className="rounded-xl font-bold text-xs uppercase tracking-widest border-gray-100 hover:bg-gray-50 text-gray-500"
        >
          <FileText size={14} className="mr-2" />
          Print
        </Button>
      </div>

      {/* ── Value summary strip ── */}
      {receiptValue > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
            <p className="text-[9px] font-extrabold text-blue-300 uppercase tracking-widest">Receipt Value</p>
            <p className="text-xl font-black text-blue-700 mt-2 leading-none">
              RM {receiptValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4">
            <p className="text-[9px] font-extrabold text-gray-300 uppercase tracking-widest">Items Received</p>
            <p className="text-xl font-black text-gray-900 mt-2 leading-none">{items.length} SKU{items.length !== 1 ? 's' : ''}</p>
          </div>
          <div className={cn(
            "rounded-2xl border p-4",
            pctOfPO === 100 ? "bg-green-50 border-green-100" : "bg-amber-50 border-amber-100"
          )}>
            <p className={cn(
              "text-[9px] font-extrabold uppercase tracking-widest",
              pctOfPO === 100 ? "text-green-300" : "text-amber-300"
            )}>% of PO Value</p>
            <p className={cn(
              "text-xl font-black mt-2 leading-none",
              pctOfPO === 100 ? "text-green-700" : "text-amber-700"
            )}>{pctOfPO}%</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* ── Received Items ── */}
          <Card className="rounded-[24px] border-gray-50 shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-gray-50">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-gray-400">Received Items</CardTitle>
              <Package size={16} className="text-blue-500" />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-gray-50">
                    <TableHead className="pl-6 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Product</TableHead>
                    <TableHead className="text-center font-bold text-gray-400 uppercase text-[10px] tracking-widest">Qty Received</TableHead>
                    <TableHead className="text-right font-bold text-gray-400 uppercase text-[10px] tracking-widest">Unit Cost</TableHead>
                    <TableHead className="text-right pr-6 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item: any) => {
                    const unitCost = item.purchase_order_items?.unit_cost ?? 0
                    const lineValue = unitCost * item.quantity_received
                    return (
                      <TableRow key={item.id} className="border-gray-50">
                        <TableCell className="font-medium text-gray-900 pl-6 uppercase italic tracking-tighter">
                          {item.products?.name ?? 'Unknown Product'}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="px-3 py-1 rounded-xl bg-green-50 text-green-700 border border-green-100 text-sm font-extrabold">
                            {item.quantity_received}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium text-gray-500">
                          {unitCost > 0 ? `RM ${unitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                        </TableCell>
                        <TableCell className="text-right pr-6 font-bold text-gray-900">
                          {lineValue > 0 ? `RM ${lineValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {receiptValue > 0 && (
                <div className="p-6 border-t border-gray-50 flex items-center justify-end gap-16 bg-gray-50/30">
                  <span className="text-[10px] uppercase tracking-widest font-extrabold text-gray-400">Total Receipt Value</span>
                  <span className="text-xl font-extrabold text-blue-600">
                    RM {receiptValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* ── Receipt Details ── */}
          <Card className="rounded-[24px] border-gray-50 shadow-sm">
            <CardHeader className="border-b border-gray-50">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-gray-400">Receipt Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-500">
                  <Calendar size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest leading-none mb-1">Receipt Date</p>
                  <p className="font-bold text-gray-900">{new Date(receipt.received_at).toLocaleString()}</p>
                </div>
              </div>

              <div className="flex items-start gap-4 border-t border-gray-50 pt-4">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0 text-orange-500">
                  <User size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest leading-none mb-1">Received By</p>
                  <p className="font-bold text-gray-900 uppercase italic tracking-tighter">
                    {receipt.received_by ? `User ${receipt.received_by.slice(0, 8)}` : 'AI Assistant'}
                  </p>
                </div>
              </div>

              <div
                className="flex items-start gap-4 border-t border-gray-50 pt-4 cursor-pointer group"
                onClick={() => router.push(`/inventory/purchase-orders/${receipt.po_id}`)}
              >
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0 text-green-500 group-hover:bg-green-100 transition-colors">
                  <FileText size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest leading-none mb-1">Related PO</p>
                  <p className="font-bold text-blue-600 group-hover:underline">{receipt.purchase_orders?.po_number}</p>
                  {receipt.purchase_orders?.suppliers?.name && (
                    <p className="text-xs text-gray-400 font-medium mt-0.5">{receipt.purchase_orders.suppliers.name}</p>
                  )}
                </div>
              </div>

              {poTotal > 0 && (
                <div className="border-t border-gray-50 pt-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0 text-purple-500">
                      <DollarSign size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest leading-none mb-2">PO Coverage</p>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            pctOfPO === 100 ? "bg-green-500" : "bg-blue-500"
                          )}
                          style={{ width: `${pctOfPO}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[9px] font-bold text-gray-400">This receipt</span>
                        <span className="text-[9px] font-extrabold text-gray-600">{pctOfPO}% of PO value</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {receipt.notes && (
            <Card className="rounded-[24px] border-gray-50 shadow-sm bg-gray-50/20 border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-gray-400">Notes</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 leading-relaxed font-bold italic">
                "{receipt.notes}"
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
