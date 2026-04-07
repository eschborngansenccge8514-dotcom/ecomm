'use client'

import React from 'react'
import { 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  DollarSign 
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Props {
  data: {
    total_skus: number
    in_stock_count: number
    low_stock_count: number
    out_of_stock_count: number
    total_stock_value: number
  }
}

export function InventoryStatsHeader({ data }: Props) {
  const stats = [
    { 
      label: 'Total SKUs', 
      value: data.total_skus, 
      icon: Package, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50' 
    },
    { 
      label: 'In Stock', 
      value: data.in_stock_count, 
      icon: TrendingUp, 
      color: 'text-green-600', 
      bg: 'bg-green-50' 
    },
    { 
      label: 'Low Stock', 
      value: data.low_stock_count, 
      icon: AlertTriangle, 
      color: 'text-yellow-600', 
      bg: 'bg-yellow-50' 
    },
    { 
      label: 'Out of Stock', 
      value: data.out_of_stock_count, 
      icon: TrendingDown, 
      color: 'text-red-600', 
      bg: 'bg-red-50' 
    },
  ]

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
      
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-blue-500/10">
        <div className="flex items-center gap-3 text-white">
          <div className="p-2 bg-white/20 rounded-lg">
            <DollarSign size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest leading-none">Total Inventory Value</p>
            <p className="text-xl font-black mt-1">RM {data.total_stock_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-full border border-white/10 text-[10px] font-bold text-white uppercase tracking-wider">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Real-time Stock Tracking
        </div>
      </div>
    </div>
  )
}
