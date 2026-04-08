'use client'

import dynamic from 'next/dynamic'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { TrendingUp, PieChart as PieChartIcon, Zap } from 'lucide-react'

const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false })
const AreaChart = dynamic(() => import('recharts').then(mod => mod.AreaChart), { ssr: false })
const Area = dynamic(() => import('recharts').then(mod => mod.Area), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false })
const PieChart = dynamic(() => import('recharts').then(mod => mod.PieChart), { ssr: false })
const Pie = dynamic(() => import('recharts').then(mod => mod.Pie), { ssr: false })
const Cell = dynamic(() => import('recharts').then(mod => mod.Cell), { ssr: false })

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export function ExpenseCharts({ trends, categories }: { trends: any[], categories: any[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Spending Trend Chart */}
      <div className="lg:col-span-2 bg-white rounded-[32px] border border-gray-100 p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 tracking-tight">Spending Trends</h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Yearly Activity</p>
            </div>
          </div>
        </div>

        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trends} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                tickLine={false} 
                axisLine={false} 
                dy={10}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} 
                tickLine={false}
                axisLine={false} 
                tickFormatter={v => `RM${v}`} 
                width={60} 
              />
              <Tooltip
                contentStyle={{ 
                  borderRadius: 20, 
                  border: '1px solid #f1f5f9', 
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)',
                  fontSize: 12,
                  fontWeight: 700
                }}
                formatter={(v: any) => [`RM ${Number(v).toLocaleString()}`, 'Spent']}
              />
              <Area 
                type="monotone" 
                dataKey="amount" 
                stroke="#6366f1"
                strokeWidth={3} 
                fill="url(#expenseGradient)" 
                dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} 
                activeDot={{ r: 6, fill: '#6366f1', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <PieChartIcon size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black text-gray-900 tracking-tight">Category Mix</h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Share of Wallet</p>
          </div>
        </div>

        <div className="h-[200px] w-full flex items-center justify-center relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categories}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {categories.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: 12 }}
                formatter={(v: any) => [`RM ${Number(v).toLocaleString()}`, 'Total']}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <Zap size={20} className="text-amber-400 mb-1" />
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Mix</span>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {categories.slice(0, 4).map((cat, i) => (
            <div key={i} className="flex items-center justify-between group">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-xs font-bold text-gray-600 capitalize group-hover:text-gray-900 transition-colors">
                   {cat.name.replace(/_/g, ' ')}
                </span>
              </div>
              <span className="text-[10px] font-black text-gray-400">{Math.round(cat.percentage)}%</span>
            </div>
          ))}
          {categories.length > 4 && (
            <p className="text-[10px] text-center font-bold text-gray-300 uppercase tracking-widest pt-2">
              + {categories.length - 4} more categories
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
