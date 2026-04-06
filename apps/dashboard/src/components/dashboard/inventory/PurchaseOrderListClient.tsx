'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  ChevronRight, 
  Download, 
  Calendar, 
  ShoppingCart,
  Clock,
  CheckCircle2,
  AlertCircle
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
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  partially_received: 'bg-yellow-100 text-yellow-700',
  received: 'bg-green-100 text-green-700',
  closed: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-red-100 text-red-700'
}

export function PurchaseOrderListClient({ initialOrders }: { initialOrders: any[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')

  const filtered = initialOrders.filter(o => {
    const matchesQuery = o.po_number.toLowerCase().includes(query.toLowerCase()) || 
                       o.suppliers?.name.toLowerCase().includes(query.toLowerCase())
    const matchesFilter = filter === 'all' || o.status === filter
    return matchesQuery && matchesFilter
  })

  return (
    <div className="p-6 space-y-6">
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

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input 
            placeholder="Search by PO# or Supplier..." 
            className="pl-10 rounded-xl bg-white border-gray-100 focus:border-blue-500 shadow-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          {['all', 'draft', 'sent', 'received'].map((f) => (
            <Button 
              key={f}
              variant={filter === f ? 'default' : 'ghost'}
              onClick={() => setFilter(f)}
              size="sm"
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-wider",
                filter === f ? "bg-slate-900 text-white" : "text-gray-500 hover:bg-gray-100"
              )}
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Order Date</TableHead>
              <TableHead>Total (RM)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length > 0 ? filtered.map((po) => (
              <TableRow 
                key={po.id} 
                className="cursor-pointer hover:bg-gray-50 group"
                onClick={() => router.push(`/inventory/purchase-orders/${po.id}`)}
              >
                <TableCell>
                  <div className="flex items-center gap-2 font-bold text-gray-900">
                    <FileText size={14} className="text-gray-400" />
                    {po.po_number}
                  </div>
                </TableCell>
                <TableCell className="font-medium text-gray-700">{po.suppliers?.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Clock size={12} className="text-gray-400" />
                    <span>{new Date(po.order_date).toLocaleDateString()}</span>
                  </div>
                </TableCell>
                <TableCell className="font-bold text-gray-900">
                  {po.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn(
                    "rounded-lg px-2 py-0.5 text-[10px] uppercase font-bold border-none",
                    STATUS_COLORS[po.status] || 'bg-gray-100'
                  )}>
                    {po.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                     <Button variant="ghost" size="icon" className="rounded-full text-gray-400 group-hover:text-blue-600">
                      <ChevronRight size={18} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center text-gray-400">
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
