'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { 
  Package, 
  Truck, 
  Plus, 
  Search, 
  MoreVertical, 
  Mail, 
  Phone, 
  Edit2, 
  Trash2,
  Calendar
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

export function SupplierListClient({ 
  suppliers, 
  hideHeader = false 
}: { 
  suppliers: any[], 
  hideHeader?: boolean 
}) {
  const [query, setQuery] = useState('')

  const filtered = suppliers.filter(s => 
    s.name.toLowerCase().includes(query.toLowerCase()) || 
    s.code.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className={cn("space-y-6", !hideHeader && "p-6")}>
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
            <p className="text-gray-500">Manage your product vendors and procurement contacts.</p>
          </div>
          <Link 
            href="/inventory/suppliers/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={18} />
            Add Supplier
          </Link>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input 
            placeholder="Search by name or code..." 
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
              <TableHead>Supplier Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Contact Info</TableHead>
              <TableHead>Lead Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length > 0 ? filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-bold text-gray-900">{s.name}</TableCell>
                <TableCell>
                  <code className="px-1.5 py-0.5 rounded-lg bg-gray-50 text-xs font-bold text-gray-500 border border-gray-100">
                    {s.code}
                  </code>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {s.email && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Mail size={12} className="text-gray-400" />
                        <span>{s.email}</span>
                      </div>
                    )}
                    {s.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Phone size={12} className="text-gray-400" />
                        <span>{s.phone}</span>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-xs text-gray-700">
                    <Calendar size={14} className="text-gray-400" />
                    <span>Avg. {s.lead_time_days} days</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={s.is_active ? 'default' : 'secondary'} className={cn(
                    "rounded-lg px-2 py-0.5 text-[10px] uppercase font-bold",
                    s.is_active ? "bg-green-50 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-600"
                  )}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/inventory/suppliers/${s.id}`}>
                      <Button variant="outline" size="sm" className="rounded-xl px-3 hover:bg-blue-50 hover:text-blue-600 border-gray-100 transition-all">
                        <Edit2 size={14} className="mr-1.5" />
                        Edit
                      </Button>
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Truck size={32} className="text-gray-100" />
                    <p>No suppliers found.</p>
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
