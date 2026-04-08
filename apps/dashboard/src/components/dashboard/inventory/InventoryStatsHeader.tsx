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
      label: 'Products', 
      value: data.total_skus, 
      icon: Package, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50',
      description: 'Total active SKUs'
    },
    { 
      label: 'In Stock', 
      value: data.in_stock_count, 
      icon: TrendingUp, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50',
      description: 'Healthy inventory levels'
    },
    { 
      label: 'Low Stock', 
      value: data.low_stock_count, 
      icon: AlertTriangle, 
      color: 'text-amber-600', 
      bg: 'bg-amber-50',
      description: 'Require attention soon'
    },
    { 
      label: 'Out of Stock', 
      value: data.out_of_stock_count, 
      icon: TrendingDown, 
      color: 'text-rose-600', 
      bg: 'bg-rose-50',
      description: 'Missing sales opportunities'
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="border border-gray-100/50 shadow-sm bg-white/60 backdrop-blur-md rounded-[24px] overflow-hidden group hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-1 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] font-black text-gray-400 underline decoration-gray-200 decoration-2 underline-offset-4 uppercase tracking-widest">{stat.label}</p>
                  <p className="text-3xl font-black text-gray-900 group-hover:text-blue-600 transition-colors">{stat.value.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400 font-medium">{stat.description}</p>
                </div>
                <div className={cn('p-3.5 rounded-2xl transition-all group-hover:scale-110 group-hover:rotate-3 duration-500 shadow-sm', stat.bg)}>
                  <stat.icon size={22} className={stat.color} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="relative overflow-hidden bg-slate-900 rounded-[24px] p-6 shadow-2xl shadow-blue-900/20 group">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-blue-500/30 transition-colors duration-700" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-600/10 rounded-full -ml-24 -mb-24 blur-3xl" />
        
        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-500">
              <DollarSign size={24} className="text-blue-300" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-blue-300/80 uppercase tracking-widest leading-none mb-1.5">Marketplace Inventory Value</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white tracking-tight">
                  RM {data.total_stock_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-blue-300/60 font-bold uppercase tracking-wider">Total Est.</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 text-[11px] font-black text-white uppercase tracking-widest shadow-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse" />
              Live Analytics Active
            </div>
            <p className="text-[10px] text-white/40 font-medium mr-1 italic">Last updated: Just now</p>
          </div>
        </div>
      </div>
    </div>
  )
}
