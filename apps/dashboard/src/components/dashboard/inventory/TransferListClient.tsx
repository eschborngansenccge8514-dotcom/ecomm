'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { 
  ArrowUpRight, 
  Plus, 
  Search, 
  Clock, 
  ChevronRight,
  TrendingUp,
  MapPin,
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
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  in_transit: 'bg-blue-100 text-blue-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700'
}

export function TransferListClient({ transfers }: { transfers: any[] }) {
  const [query, setQuery] = useState('')

  const filtered = transfers.filter(t => 
    t.transfer_number.toLowerCase().includes(query.toLowerCase()) || 
    t.from?.name.toLowerCase().includes(query.toLowerCase()) ||
    t.to?.name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Transfers</h1>
          <p className="text-gray-500">Move products between outlets or inventory locations.</p>
        </div>
        <Link 
          href="/inventory/transfers/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={18} />
          New Transfer
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input 
            placeholder="Search by Transfer# or Location..." 
            className="pl-10 rounded-xl bg-white border-gray-100 focus:border-blue-500 shadow-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transfer Number</TableHead>
              <TableHead>Source (From)</TableHead>
              <TableHead>Destination (To)</TableHead>
              <TableHead>Date Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length > 0 ? filtered.map((t) => (
              <Link key={t.id} href={`/inventory/transfers/${t.id}`} className="contents group">
                <TableRow className="cursor-pointer group-hover:bg-gray-50 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-2 font-black text-gray-900 uppercase italic tracking-tighter">
                      <ArrowUpRight size={14} className="text-blue-500" />
                      {t.transfer_number}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-gray-700 font-bold">
                       <MapPin size={14} className="text-gray-400" />
                       {t.from?.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-gray-700 font-bold">
                       <MapPin size={14} className="text-gray-400" />
                       {t.to?.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                      <Clock size={12} className="text-gray-400" />
                      <span>{new Date(t.created_at).toLocaleDateString()}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn(
                      "rounded-lg px-2 py-0.5 text-[10px] uppercase font-bold border-none shadow-sm",
                      STATUS_COLORS[t.status] || 'bg-gray-100'
                    )}>
                      {t.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="rounded-full text-gray-400 group-hover:text-blue-600 transition-colors">
                      <ChevronRight size={18} />
                    </Button>
                  </TableCell>
                </TableRow>
              </Link>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Package size={32} className="text-gray-100" />
                    <p>No transfers found.</p>
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
