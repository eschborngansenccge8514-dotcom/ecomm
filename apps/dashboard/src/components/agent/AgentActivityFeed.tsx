'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Activity, CheckCircle2, Clock, Hourglass, XCircle, AlertCircle } from 'lucide-react'

interface Action {
  id:          string
  tool_name:   string
  status:      string
  risk_level:  string
  input:       Record<string, unknown>
  executed_at: string
}

const STATUS_CONFIG: Record<string, { icon: any, color: string, bg: string, label: string }> = {
  executed: { 
    icon: CheckCircle2, 
    color: 'text-green-600 dark:text-green-400', 
    bg: 'bg-green-50 dark:bg-green-950/30',
    label: 'Executed'
  },
  pending_approval: { 
    icon: Hourglass, 
    color: 'text-amber-600 dark:text-amber-400', 
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    label: 'Awaiting Approval'
  },
  approved: { 
    icon: CheckCircle2, 
    color: 'text-blue-600 dark:text-blue-400', 
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    label: 'Approved'
  },
  rejected: { 
    icon: XCircle, 
    color: 'text-slate-500 dark:text-slate-400', 
    bg: 'bg-slate-50 dark:bg-slate-900/40',
    label: 'Rejected'
  },
  failed: { 
    icon: AlertCircle, 
    color: 'text-red-600 dark:text-red-400', 
    bg: 'bg-red-50 dark:bg-red-950/30',
    label: 'Failed'
  }
}

export function AgentActivityFeed({ limit = 10 }: { limit?: number }) {
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  async function fetchActions() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('agent_actions')
      .select('id, tool_name, status, risk_level, input, executed_at')
      .eq('merchant_id', user.id)
      .order('executed_at', { ascending: false })
      .limit(limit)
    
    setActions(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchActions()

    const channel = supabase
      .channel('agent-activity-realtime')
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'agent_actions'
      }, () => fetchActions())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [limit])

  if (loading && actions.length === 0) {
    return (
      <div className="animate-pulse space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Activity className="w-4 h-4 text-slate-400" />
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
          Recent Agent Activity
        </h3>
      </div>

      {actions.length === 0 ? (
        <div className="py-10 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
          <p className="text-xs text-slate-400">No activity yet. Strike up a conversation with MerchantMind!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {actions.map(a => {
            const config = STATUS_CONFIG[a.status] || STATUS_CONFIG.failed
            const Icon = config.icon

            return (
              <div key={a.id}
                   className="group flex items-start gap-3 p-3 rounded-2xl border border-transparent hover:border-slate-100 hover:bg-slate-50/50 transition-all dark:hover:border-slate-800 dark:hover:bg-slate-900/50">
                <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-full ${config.bg} flex items-center justify-center ${config.color}`}>
                  <Icon size={14} />
                </div>
                
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate capitalize">
                      {a.tool_name.replace(/_/g, ' ')}
                    </p>
                    <span className="shrink-0 text-[10px] font-mono text-slate-400">
                      {new Date(a.executed_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-500 truncate">
                      {config.label} • {a.risk_level} risk
                    </p>
                    {a.status === 'pending_approval' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
