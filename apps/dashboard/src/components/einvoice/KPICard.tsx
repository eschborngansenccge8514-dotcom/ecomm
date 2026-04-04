'use client'

import React from 'react'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KPICardProps {
  label: string
  value: string | number
  subtitle: string
  icon: LucideIcon
  trend?: {
    value: string
    isUp: boolean
  }
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}

export function KPICard({ label, value, subtitle, icon: Icon, trend, variant = 'default' }: KPICardProps) {
  const getVariantStyles = (v: typeof variant) => {
    switch (v) {
      case 'success': return 'bg-emerald-50 text-emerald-600 ring-emerald-100'
      case 'warning': return 'bg-amber-50 text-amber-600 ring-amber-100'
      case 'danger': return 'bg-rose-50 text-rose-600 ring-rose-100'
      case 'info': return 'bg-blue-50 text-blue-600 ring-blue-100'
      default: return 'bg-gray-50 text-gray-600 ring-gray-100'
    }
  }

  const getLabelStyles = (v: typeof variant) => {
    switch (v) {
      case 'success': return 'text-emerald-700'
      case 'warning': return 'text-amber-700'
      case 'danger': return 'text-rose-700'
      case 'info': return 'text-blue-700'
      default: return 'text-gray-700'
    }
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 group ring-1 ring-inset ring-gray-50">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-2.5 rounded-xl transition-transform group-hover:scale-110 duration-300", getVariantStyles(variant))}>
          <Icon size={20} strokeWidth={2.5} />
        </div>
        {trend && (
           <div className={cn(
             "text-xs font-bold px-2 py-1 rounded-lg",
             trend.isUp ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
           )}>
             {trend.isUp ? '+' : '-'}{trend.value}
           </div>
        )}
      </div>

      <div className="space-y-1">
        <h4 className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getLabelStyles(variant))}>
          {label}
        </h4>
        <div className="flex items-baseline gap-2">
           <span className="text-2xl font-black text-gray-900 tracking-tight">
             {value}
           </span>
        </div>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-tighter">
           {subtitle}
        </p>
      </div>
    </div>
  )
}
