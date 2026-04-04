'use client'

import React from 'react'
import { 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertCircle, 
  Ban, 
  FileText, 
  Layers 
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type EinvoiceStatus = 'validated' | 'pending' | 'invalid' | 'rejected' | 'failed' | 'cancelled' | 'draft' | 'consolidated' | 'submitted'

interface StatusBadgeProps {
  status: EinvoiceStatus | string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedStatus = status?.toLowerCase() as EinvoiceStatus

  const getStatusConfig = (s: EinvoiceStatus) => {
    switch (s) {
      case 'validated':
      case 'valid' as any:
        return {
          label: 'Validated',
          icon: CheckCircle2,
          colors: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
        }
      case 'pending':
      case 'submitted':
        return {
          label: 'Pending LHDN',
          icon: Clock,
          colors: 'bg-amber-100 text-amber-700 ring-amber-200',
        }
      case 'invalid':
      case 'rejected':
      case 'failed':
        return {
          label: s.charAt(0).toUpperCase() + s.slice(1),
          icon: XCircle,
          colors: 'bg-rose-100 text-rose-700 ring-rose-200',
        }
      case 'cancelled':
        return {
          label: 'Cancelled',
          icon: Ban,
          colors: 'bg-slate-100 text-slate-600 ring-slate-200',
        }
      case 'draft':
        return {
          label: 'Draft',
          icon: FileText,
          colors: 'bg-gray-100 text-gray-600 ring-gray-200',
        }
      case 'consolidated':
        return {
          label: 'Consolidated',
          icon: Layers,
          colors: 'bg-indigo-100 text-indigo-700 ring-indigo-200',
        }
      default:
        return {
          label: status || 'Unknown',
          icon: AlertCircle,
          colors: 'bg-gray-100 text-gray-600 ring-gray-200',
        }
    }
  }

  const { label, icon: Icon, colors } = getStatusConfig(normalizedStatus)

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ring-1 ring-inset shadow-sm transition-all hover:shadow-md",
      colors,
      className
    )}>
      <Icon size={14} className="shrink-0" />
      {label}
    </span>
  )
}
