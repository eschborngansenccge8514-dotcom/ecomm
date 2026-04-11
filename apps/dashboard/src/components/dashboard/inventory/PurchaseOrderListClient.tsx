'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FileText,
  Plus,
  Search,
  ChevronRight,
  Clock,
  ShoppingCart,
  AlertTriangle
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  partially_received: 'bg-yellow-100 text-yellow-700',
  received: 'bg-green-100 text-green-700',
  closed: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-red-100 text-red-700'
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  unpaid: 'bg-red-50 text-red-600 border-red-100',
  partially_paid: 'bg-yellow-50 text-yellow-600 border-yellow-100',
  paid: 'bg-green-50 text-green-600 border-green-100'
}

const FILTERS = ['all', 'draft', 'sent', 'partially_received', 'received', 'cancelled'] as const

function ReceivingProgress({ ordered, received }: { ordered: number; received: number }) {
  if (ordered === 0) return <span className="text-xs text-gray-300">—</span>
  const pct = Math.min(Math.round((received / ordered) * 100), 100)
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct === 100 ? "bg-green-500" : pct > 0 ? "bg-yellow-400" : "bg-gray-200"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-bold text-gray-400 w-[28px] text-right">{pct}%</span>
    </div>
  )
}

export function PurchaseOrderListClient({
  initialOrders,
  hideHeader = false
}: {
  initialOrders: any[]
  hideHeader?: boolean
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')

  const filtered = initialOrders.filter(o => {
    const matchesQuery =
      o.po_number.toLowerCase().includes(query.toLowerCase()) ||
      (() => {
        const s = Array.isArray(o.supplier) ? o.supplier[0] : o.supplier;
        return (s?.name ?? '').toLowerCase().includes(query.toLowerCase());
      })()
    const matchesFilter = filter === 'all' || o.status === filter
    return matchesQuery && matchesFilter
  })

  return (
    <div className={cn("space-y-4 p-6")}>
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
            <p className="text-gray-500">Track and manage inventory procurement from suppliers.</p>
          </div>
          <Link
            href="/inventory/purchase-orders/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={18} />
            New Purchase Order
          </Link>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by PO# or Supplier..."
            className="pl-10 rounded-xl bg-white border-gray-100 focus:border-blue-500 shadow-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'ghost'}
              onClick={() => setFilter(f)}
              size="sm"
              className={cn(
                "rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-wider",
                filter === f ? "bg-slate-900 text-white" : "text-gray-400 hover:bg-gray-100"
              )}
            >
              {f.replace('_', ' ')}
            </Button>
          ))}
        </div>
      </div>

      <Card className="rounded-[24px] overflow-hidden border-gray-100 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-gray-50">
              <TableHead className="pl-6 font-bold text-gray-400 uppercase text-[10px] tracking-widest">PO Number</TableHead>
              <TableHead className="font-bold text-gray-400 uppercase text-[10px] tracking-widest">Supplier</TableHead>
              <TableHead className="font-bold text-gray-400 uppercase text-[10px] tracking-widest">Ordered</TableHead>
              <TableHead className="font-bold text-gray-400 uppercase text-[10px] tracking-widest">Expected</TableHead>
              <TableHead className="text-right font-bold text-gray-400 uppercase text-[10px] tracking-widest">Total (RM)</TableHead>
              <TableHead className="font-bold text-gray-400 uppercase text-[10px] tracking-widest">Receiving</TableHead>
              <TableHead className="font-bold text-gray-400 uppercase text-[10px] tracking-widest">Status</TableHead>
              <TableHead className="font-bold text-gray-400 uppercase text-[10px] tracking-widest">Payment</TableHead>
              <TableHead className="text-right pr-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length > 0 ? filtered.map((po) => {
              const totalOrdered = po.purchase_order_items?.reduce((s: number, i: any) => s + i.quantity_ordered, 0) ?? 0
              const totalReceived = po.purchase_order_items?.reduce((s: number, i: any) => s + i.quantity_received, 0) ?? 0
              const isActive = ['sent', 'partially_received'].includes(po.status)
              const isOverdue = isActive && po.expected_date && new Date(po.expected_date) < new Date()
              return (
                <TableRow
                  key={po.id}
                  className={cn(
                    "cursor-pointer hover:bg-gray-50 group border-gray-50",
                    isOverdue && "bg-red-50/40 hover:bg-red-50/60"
                  )}
                  onClick={() => router.push(`/inventory/purchase-orders/${po.id}`)}
                >
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-2 font-bold text-gray-900">
                      <FileText size={14} className="text-gray-400 flex-shrink-0" />
                      {po.po_number}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-gray-700">
                    {(() => {
                      const s = po.supplier;
                      if (Array.isArray(s)) return s[0]?.name;
                      return s?.name || po.supplier_name;
                    })()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                      <Clock size={11} className="text-gray-300" />
                      {po.order_date ? new Date(po.order_date).toLocaleDateString() : '—'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {po.expected_date ? (
                      <div className={cn(
                        "flex items-center gap-1.5 text-xs font-medium",
                        isOverdue ? "text-red-600" : "text-gray-500"
                      )}>
                        {isOverdue
                          ? <AlertTriangle size={11} className="text-red-500 shrink-0" />
                          : <Clock size={11} className="text-gray-300 shrink-0" />
                        }
                        {new Date(po.expected_date).toLocaleDateString()}
                        {isOverdue && <span className="ml-1 text-[10px] font-black uppercase tracking-wider text-red-500">Overdue</span>}
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold text-gray-900">
                    {(po.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <ReceivingProgress ordered={totalOrdered} received={totalReceived} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn(
                      "rounded-lg px-2 py-0.5 text-[10px] uppercase font-bold border-none",
                      STATUS_COLORS[po.status] || 'bg-gray-100'
                    )}>
                      {po.status.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "rounded-lg px-2 py-0.5 text-[10px] uppercase font-bold",
                      PAYMENT_STATUS_COLORS[po.payment_status] || 'bg-gray-50 text-gray-400'
                    )}>
                      {(po.payment_status ?? 'unpaid').replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <ChevronRight size={16} className="ml-auto text-gray-300 group-hover:text-blue-600 transition-colors" />
                  </TableCell>
                </TableRow>
              )
            }) : (
              <TableRow>
                <TableCell colSpan={9} className="h-48 text-center text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <ShoppingCart size={32} className="text-gray-100" />
                    <p>No purchase orders found.</p>
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
