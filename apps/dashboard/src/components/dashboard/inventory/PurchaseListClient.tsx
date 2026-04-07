'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileCheck,
  Search,
  ChevronRight,
  Calendar,
  Package
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function PurchaseListClient({
  initialPurchases,
  hideHeader = false
}: {
  initialPurchases: any[]
  hideHeader?: boolean
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')

  const filtered = initialPurchases.filter(p => {
    const poNumber = p.purchase_orders?.po_number ?? ''
    const supplierName = p.purchase_orders?.suppliers?.name ?? ''
    const notes = p.notes ?? ''
    return (
      poNumber.toLowerCase().includes(query.toLowerCase()) ||
      supplierName.toLowerCase().includes(query.toLowerCase()) ||
      notes.toLowerCase().includes(query.toLowerCase())
    )
  })

  return (
    <div className="space-y-4 p-6">
      {!hideHeader && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Goods Receipts</h1>
          <p className="text-gray-500">History of received inventory from purchase orders.</p>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search by PO#, Supplier or Notes..."
          className="pl-10 rounded-xl bg-white border-gray-100 focus:border-blue-500 shadow-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <Card className="rounded-[24px] overflow-hidden border-gray-100 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-gray-50">
              <TableHead className="pl-6 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Receipt ID</TableHead>
              <TableHead className="font-bold text-gray-400 uppercase text-[10px] tracking-widest">Related PO</TableHead>
              <TableHead className="font-bold text-gray-400 uppercase text-[10px] tracking-widest">Supplier</TableHead>
              <TableHead className="font-bold text-gray-400 uppercase text-[10px] tracking-widest">Date</TableHead>
              <TableHead className="font-bold text-gray-400 uppercase text-[10px] tracking-widest">SKUs</TableHead>
              <TableHead className="font-bold text-gray-400 uppercase text-[10px] tracking-widest">Notes</TableHead>
              <TableHead className="text-right pr-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length > 0 ? filtered.map((p) => {
              const itemCount = p.goods_receipt_items?.length ?? 0
              const totalQty = p.goods_receipt_items?.reduce((s: number, i: any) => s + i.quantity_received, 0) ?? 0
              return (
                <TableRow
                  key={p.id}
                  className="cursor-pointer hover:bg-gray-50 group border-gray-50"
                  onClick={() => router.push(`/inventory/receipts/${p.id}`)}
                >
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-2 font-bold text-gray-900">
                      <FileCheck size={14} className="text-green-500 flex-shrink-0" />
                      {p.id.slice(0, 8).toUpperCase()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-bold text-blue-600 text-sm">
                      {p.purchase_orders?.po_number ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium text-gray-700">
                    {p.purchase_orders?.suppliers?.name ?? '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                      <Calendar size={11} className="text-gray-300" />
                      {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    {itemCount > 0 ? (
                      <span className="text-xs font-bold text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg">
                        {totalQty} unit{totalQty !== 1 ? 's' : ''} · {itemCount} SKU{itemCount !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-gray-400 italic max-w-[160px] truncate">
                    {p.notes ?? 'No notes'}
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <ChevronRight size={16} className="ml-auto text-gray-300 group-hover:text-blue-600 transition-colors" />
                  </TableCell>
                </TableRow>
              )
            }) : (
              <TableRow>
                <TableCell colSpan={7} className="h-48 text-center text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Package size={32} className="text-gray-100" />
                    <p>No goods receipts found.</p>
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
