'use client'

import React from 'react'
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  ArrowRight,
  ShieldCheck,
  Calendar
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type ComplianceStatus = 'compliant' | 'action_required' | 'overdue'

interface ComplianceStatusBannerProps {
  status: ComplianceStatus
  details?: string
  nextDeadline?: string
  onAction?: () => void
}

export function ComplianceStatusBanner({ status, details, nextDeadline, onAction }: ComplianceStatusBannerProps) {
  const getBannerConfig = (s: ComplianceStatus) => {
    switch (s) {
      case 'compliant':
        return {
          title: 'Fully Compliant',
          icon: ShieldCheck,
          colors: 'bg-emerald-50 border-emerald-100 text-emerald-900',
          iconColors: 'bg-emerald-100 text-emerald-600',
          buttonStyles: 'bg-emerald-600 text-white hover:bg-emerald-700',
          defaultDetails: 'All invoices submitted and validated successfully.',
        }
      case 'action_required':
        return {
          title: 'Action Required',
          icon: AlertTriangle,
          colors: 'bg-amber-50 border-amber-100 text-amber-900',
          iconColors: 'bg-amber-100 text-amber-600',
          buttonStyles: 'bg-amber-600 text-white hover:bg-amber-700',
          defaultDetails: 'Some invoices failed LHDN validation. Review them to stay compliant.',
        }
      case 'overdue':
        return {
          title: 'Overdue Submissions',
          icon: AlertCircle,
          colors: 'bg-rose-50 border-rose-100 text-rose-900',
          iconColors: 'bg-rose-100 text-rose-600',
          buttonStyles: 'bg-rose-600 text-white hover:bg-rose-700',
          defaultDetails: 'You have unsubmitted invoices past their submission window. Potential penalties apply.',
        }
    }
  }

  const config = getBannerConfig(status)
  const Icon = config.icon

  return (
    <div className={cn(
      "w-full rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 transition-all duration-300 shadow-sm",
      config.colors
    )}>
      <div className={cn("p-3 rounded-xl shrink-0 transition-transform duration-500", config.iconColors)}>
        <Icon size={24} />
      </div>
      
      <div className="flex-1 space-y-1">
        <h3 className="text-base font-bold tracking-tight">{config.title}</h3>
        <p className="text-sm font-medium opacity-80 leading-relaxed">
          {details || config.defaultDetails}
        </p>
        {nextDeadline && (
           <div className="flex items-center gap-1.5 text-xs font-bold opacity-70 mt-1">
              <Calendar size={12} />
              Next Deadline: {nextDeadline}
           </div>
        )}
      </div>

      <button 
        onClick={onAction}
        className={cn(
          "px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-sm shrink-0",
          config.buttonStyles
        )}
      >
        {status === 'compliant' ? 'View History' : status === 'action_required' ? 'Review Errors' : 'Fix Now'}
        <ArrowRight size={16} />
      </button>
    </div>
  )
}
