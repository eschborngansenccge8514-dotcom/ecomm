'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Headphones } from 'lucide-react'
import { cn } from '@/lib/utils'

export function SupportBadge() {
  const [count, setCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    async function fetchCount() {
      // Get the count of active sessions (open or escalated)
      const { count: c, error } = await supabase
        .from('support_sessions')
        .select('*', { count: 'exact', head: true })
        .in('status', ['open', 'escalated'])
      
      if (!error) {
        setCount(c ?? 0)
      }
    }

    fetchCount()

    // Realtime subscription for support sessions
    const channel = supabase
      .channel('support-badge-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'support_sessions'
      }, () => {
        fetchCount()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (count === 0) return null

  return (
    <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white shadow-sm ring-2 ring-white animate-in zoom-in duration-300">
      {count}
    </span>
  )
}
