'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function ApprovalsBadge() {
  const [count, setCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    async function fetchCount() {
      const { count: c } = await supabase
        .from('agent_approvals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
      setCount(c ?? 0)
    }

    fetchCount()

    const channel = supabase
      .channel('approvals-badge-realtime')
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'agent_approvals'
      }, () => {
        fetchCount()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (count === 0) return null

  return (
    <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900 animate-in fade-in zoom-in">
      {count}
    </span>
  )
}
