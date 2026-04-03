'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'

interface Props {
  approvalId: string
  action: 'approve' | 'reject'
}

export function ApprovalButton({ approvalId, action }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleClick = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/agent/approvals/${approvalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action === 'approve' ? 'approved' : 'rejected' })
      })

      if (!res.ok) throw new Error(await res.text())

      toast.success(action === 'approve' ? 'Action approved' : 'Action rejected')
      router.refresh()
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
        ${action === 'approve'
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'bg-muted text-muted-foreground hover:bg-muted/80'}
        disabled:opacity-50`}
    >
      {loading ? 'Processing...' : action.charAt(0).toUpperCase() + action.slice(1)}
    </button>
  )
}
