'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  ShieldAlert, 
  Check, 
  X, 
  Info, 
  Loader2, 
  ArrowRight,
  AlertTriangle,
  Mail,
  Truck,
  Package,
  CreditCard,
  History
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'

interface ApprovalCardProps {
  approval: any
  onResolve: (id: string) => void
}

export function ApprovalCard({ approval, onResolve }: ApprovalCardProps) {
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const supabase = createClient()

  async function handleAction(type: 'approve' | 'reject') {
    setLoading(true)
    setAction(type)
    
    try {
      const { data, error } = await supabase.functions.invoke('approve-and-execute', {
        body: { approval_id: approval.id, action: type }
      })

      if (error) throw error

      toast.success(type === 'approve' ? 'Action approved and executed' : 'Action rejected')
      onResolve(approval.id)
    } catch (err: any) {
      console.error('Approval error:', err)
      toast.error(err.message || 'Operation failed')
    } finally {
      setLoading(false)
      setAction(null)
    }
  }

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'high':    return <ShieldAlert className="w-4 h-4 text-red-500" />
      case 'medium':  return <AlertTriangle className="w-4 h-4 text-amber-500" />
      default:        return <Info className="w-4 h-4 text-blue-500" />
    }
  }

  const getToolIcon = (toolName: string) => {
    if (toolName.includes('mail')) return <Mail className="w-4 h-4" />
    if (toolName.includes('lalamove') || toolName.includes('easyparcel')) return <Truck className="w-4 h-4" />
    if (toolName.includes('product') || toolName.includes('inventory')) return <Package className="w-4 h-4" />
    if (toolName.includes('refund') || toolName.includes('payment')) return <CreditCard className="w-4 h-4" />
    return <History className="w-4 h-4" />
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center",
              approval.risk_level === 'high' ? "bg-red-50 text-red-600 dark:bg-red-950/30" :
              approval.risk_level === 'medium' ? "bg-amber-50 text-amber-600 dark:bg-amber-950/30" :
              "bg-blue-50 text-blue-600 dark:bg-blue-950/30"
            )}>
              {getToolIcon(approval.tool_name || '')}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                {approval.title || 'Agent Action'}
                <span className={cn(
                  "text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full font-black",
                  approval.risk_level === 'high' ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" :
                  approval.risk_level === 'medium' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" :
                  "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                )}>
                  {approval.risk_level} risk
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Requested by MerchantMind Agent</p>
            </div>
          </div>
          <div className="text-[10px] font-medium text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-lg">
            {new Date(approval.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/60">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {approval.description || 'The agent wants to perform an action that needs your review.'}
          </p>
          
          {approval.tool_input && (
            <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <ArrowRight className="w-3 h-3 text-slate-300" />
                Action Parameters
              </p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(approval.tool_input).map(([key, value]: [string, any]) => (
                  <div key={key} className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-slate-400 font-medium capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-slate-700 dark:text-slate-200 font-mono truncate">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={() => handleAction('reject')}
            disabled={loading}
            className="px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {loading && action === 'reject' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
            Reject Action
          </button>
          <button
            onClick={() => handleAction('approve')}
            disabled={loading}
            className="px-6 py-2.5 rounded-2xl text-xs font-black bg-slate-900 text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 shadow-lg shadow-slate-200 dark:shadow-none transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {loading && action === 'approve' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Approve & Execute
          </button>
        </div>
      </div>
    </div>
  )
}
