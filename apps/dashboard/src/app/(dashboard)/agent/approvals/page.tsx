'use client'

import { useEffect, useState } from 'react'
import { ApprovalCard } from '@/components/agent/ApprovalCard'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, ShieldAlert, Loader2 } from 'lucide-react'

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const supabase = createClient()

  async function fetchApprovals() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('agent_approvals')
      .select('*')
      .eq('merchant_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    
    if (error) console.error('Error fetching approvals:', error)
    setApprovals(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchApprovals()

    // Realtime subscription — badge + list update live
    const channel = supabase
      .channel('approvals-realtime')
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'agent_approvals'
      }, () => {
        console.log('Realtime update received for agent_approvals')
        fetchApprovals()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-slate-500 font-medium tracking-tight">Syncing with MerchantMind...</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto py-10 px-4 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-5 dark:border-slate-800">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            Security Approvals
          </h1>
          <p className="text-xs text-slate-500">Approve or reject high-risk autonomous actions.</p>
        </div>
        {approvals.length > 0 && (
          <div className="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400 px-3 py-1 rounded-full text-xs font-bold tracking-wide animate-pulse">
            {approvals.length} pending
          </div>
        )}
      </div>

      {approvals.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl dark:bg-slate-900/40 dark:border-slate-800">
          <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto shadow-sm mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">All clear!</p>
          <p className="text-xs text-slate-500 mt-1">There are no agent actions awaiting your approval.</p>
        </div>
      ) : (
        <div className="grid gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {approvals.map(a => (
            <ApprovalCard
              key={a.id}
              approval={a}
              onResolve={(id) => setApprovals(prev => prev.filter(x => x.id !== id))}
            />
          ))}
        </div>
      )}

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
          <p className="text-[11px] leading-relaxed text-blue-700/80 dark:text-blue-400/80">
            <span className="font-bold uppercase tracking-widest mr-1">Trust & Safety:</span>
            MerchantMind will never execute high-risk operations (like logistics bookings or order cancellations) without your explicit permission here.
          </p>
        </div>
      </div>
    </div>
  )
}
