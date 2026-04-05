'use client'

import React, { useMemo } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ArrowRight,
  TrendingUp as TrendingUpIcon,
  ShoppingBag,
  ExternalLink
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Dynamic import for Recharts to avoid SSR issues
const AreaChart = dynamic(() => import('recharts').then(mod => mod.AreaChart), { ssr: false })
const Area = dynamic(() => import('recharts').then(mod => mod.Area), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false })

interface InventoryDashboardProps {
  data: {
    total_skus: number
    in_stock_count: number
    low_stock_count: number
    out_of_stock_count: number
    total_stock_value: number
    top_movers: Array<{ name: string; volume: number }>
    daily_movements: Array<{ date: string; stock_in: number; stock_out: number }>
  }
}

export function InventoryDashboardClient({ data }: InventoryDashboardProps) {
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Dashboard</h1>
          <p className="text-gray-500">Overview of your stock health and movements.</p>
        </div>
        <Link 
          href="/inventory/reorder"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Zap size={18} />
          View Reorder Suggestions
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1 text-gray-900">{stat.value}</p>
                </div>
                <div className={cn('p-3 rounded-xl', stat.bg)}>
                  <stat.icon size={24} className={stat.color} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inventory Movements Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Inventory Movements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily_movements}>
                  <defs>
                    <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                    minTickGap={30}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="stock_in" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorIn)" 
                    name="Stock In"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="stock_out" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorOut)" 
                    name="Stock Out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Total Stock Value & Quick Links */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-purple-50 rounded-2xl">
                  <DollarSign size={24} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Stock Value</p>
                  <p className="text-3xl font-extrabold text-gray-900 mt-1">
                    RM {data.total_stock_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <CardTitle className="text-sm font-bold">Top Movers</CardTitle>
              <TrendingUpIcon size={16} className="text-blue-500" />
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {data.top_movers.length > 0 ? data.top_movers.map((mover, i) => (
                  <div key={i} className="flex items-center justify-between px-6 py-3">
                    <span className="text-sm text-gray-900 font-medium truncate max-w-[150px]">{mover.name}</span>
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                      {mover.volume} sold
                    </span>
                  </div>
                )) : (
                  <div className="p-6 text-center text-gray-400 text-sm italic">No sale data for this period</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Zap(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}
