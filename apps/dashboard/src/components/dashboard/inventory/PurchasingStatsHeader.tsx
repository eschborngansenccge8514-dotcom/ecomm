'use client'

import React from 'react'
import { 
  ShoppingCart, 
  Package, 
  TrendingUp, 
  Truck, 
  DollarSign 
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Props {
  data: {
    total_orders: number
    active_orders: number
    total_spent: number
    total_suppliers: number
  }
}

export function PurchasingStatsHeader({ data }: Props) {
  const stats = [
    { 
      label: 'Purchase Orders', 
      value: data.total_orders, 
      icon: ShoppingCart, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50' 
    },
    { 
      label: 'Active Orders', 
      value: data.active_orders, 
      icon: TrendingUp, 
      color: 'text-orange-600', 
      bg: 'bg-orange-50' 
    },
    { 
      label: 'Goods Receipts', 
      // Using this as surrogate for "Total Received"
      value: data.total_suppliers, // Just example, we'll re-map these properly in page client
      icon: Package, 
      color: 'text-green-600', 
      bg: 'bg-green-50' 
    },
    { 
      label: 'Suppliers', 
      value: data.total_suppliers, 
      icon: Truck, 
      color: 'text-purple-600', 
      bg: 'bg-purple-50' 
    },
  ]

  // Re-map to correct values if needed
  stats[2].label = 'Suppliers'
  stats[3].label = 'Pending Intakes'
  stats[3].value = data.active_orders // Example

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="border-none shadow-sm bg-white/50 backdrop-blur-sm rounded-2xl overflow-hidden group hover:shadow-md transition-all">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-black mt-0.5 text-gray-900 group-hover:text-blue-600 transition-colors">{stat.value}</p>
                </div>
                <div className={cn('p-3 rounded-xl transition-transform group-hover:scale-110 duration-300', stat.bg)}>
                  <stat.icon size={20} className={stat.color} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between shadow-lg shadow-blue-500/10 border border-white/10">
        <div className="flex items-center gap-4 text-white">
          <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md">
            <DollarSign size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest leading-none">Total Procurement Value (Received)</p>
            <p className="text-2xl font-black mt-1.5 drop-shadow-sm">RM {data.total_spent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center gap-2.5 px-4 py-2 bg-white/10 rounded-full border border-white/5 text-[10px] font-bold text-white uppercase tracking-wider backdrop-blur-sm">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse" />
          Active Procurement Pipeline
        </div>
      </div>
    </div>
  )
}
