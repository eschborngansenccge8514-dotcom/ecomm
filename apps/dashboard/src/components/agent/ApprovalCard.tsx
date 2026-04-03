'use client'

import { useState } from 'react'
import { Check, X, AlertTriangle, Clock, Terminal } from 'lucide-react'

interface Approval {
  id:          string
  title:       string
  description: string
  risk_level:  string
  tool_name:   string
  created_at:  string
}

interface Props {
  approval:  Approval
  onResolve: (id: string) => void
}

export function ApprovalCard({ approval, onResolve }: Props) {
  const [loading,      setLoading]      = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject,   setShowReject]   = useState(false)
  const [result,       setResult]       = useState<'approved' | 'rejected' | null>(null)

  async function resolve(action: 'approve' | 'reject') {
    setLoading(true)
    try {
      const res = await fetch(`/api/agent/approvals/${approval.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action,
          reject_reason: rejectReason || undefined
        })
      })
      
      if (res.ok) {
        setResult(action === 'approve' ? 'approved' : 'rejected')
        setTimeout(() => onResolve(approval.id), 1200)
      } else {
        const err = await res.json()
        alert(`Error: ${err.error || 'Failed to resolve approval'}`)
      }
    } catch (err) {
      alert(`Error: ${String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className={`border rounded-xl p-4 text-sm font-medium animate-in fade-in zoom-in duration-300
        ${result === 'approved' ? 'text-green-700 bg-green-50 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800'
                                : 'text-slate-500 bg-slate-50 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-800'}`}>
        <div className="flex items-center gap-2">
          {result === 'approved' ? <Check size={16} /> : <X size={16} />}
          {result === 'approved' ? 'Approved and executed successfully' : 'Action rejected by merchant'}
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-xl p-5 space-y-4 bg-white shadow-sm hover:shadow-md transition-shadow dark:bg-slate-900 dark:border-slate-800">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{approval.title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{approval.description}</p>
        </div>
        <div className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
          ${approval.risk_level === 'high' 
            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' 
            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
          <AlertTriangle size={12} />
          {approval.risk_level} Risk
        </div>
      </div>

      <div className="flex items-center gap-4 text-[10px] text-slate-400 font-mono">
        <div className="flex items-center gap-1">
          <Terminal size={10} />
          {approval.tool_name}
        </div>
        <div className="flex items-center gap-1">
          <Clock size={10} />
          {new Date(approval.created_at).toLocaleString('en-MY')}
        </div>
      </div>

      {showReject ? (
        <div className="space-y-3 pt-2">
          <textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Why are you rejecting this? (optional)"
            rows={2}
            className="w-full text-xs border rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-950 dark:border-slate-800
                       focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => resolve('reject')}
              disabled={loading}
              className="flex-1 text-xs py-2.5 rounded-lg border border-red-200 bg-red-50
                         text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50 font-semibold
                         dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400"
            >
              Confirm Rejection
            </button>
            <button
              onClick={() => setShowReject(false)}
              className="px-4 text-xs py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors
                         dark:border-slate-800 dark:hover:bg-slate-800"
            >
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => resolve('approve')}
            disabled={loading}
            className="flex-1 text-xs py-2.5 rounded-lg bg-blue-600 text-white
                       hover:bg-blue-700 transition-all disabled:opacity-50 font-bold shadow-sm shadow-blue-200 dark:shadow-none"
          >
            {loading ? 'Executing...' : 'Approve & Execute'}
          </button>
          <button
            onClick={() => setShowReject(true)}
            disabled={loading}
            className="flex-1 text-xs py-2.5 rounded-lg border border-slate-200 text-slate-600
                       hover:bg-slate-50 transition-colors disabled:opacity-50 font-semibold
                       dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  )
}
