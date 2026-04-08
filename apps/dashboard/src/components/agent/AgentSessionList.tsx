'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Session {
  id: string; title: string; updated_at: string
}

interface Props {
  activeId?: string
  userId?: string
  onSelect: (sessionId: string) => void
  onNewChat: () => void
}

export function AgentSessionList({ activeId, userId, onSelect, onNewChat }: Props) {
  const [sessions, setSessions] = useState<Session[]>([])

  useEffect(() => {
    fetch('/api/agent/sessions')
      .then(res => res.ok ? res.json() : [])
      .then(setSessions)
  }, [])

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()
    const channel = supabase
      .channel('agent-sessions-list')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'agent_sessions',
        filter: `merchant_id=eq.${userId}`
      }, (payload) => {
        const s = payload.new as Session
        setSessions(prev => [s, ...prev])
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'agent_sessions',
        filter: `merchant_id=eq.${userId}`
      }, (payload) => {
        const s = payload.new as Session
        setSessions(prev =>
          prev
            .map(existing => existing.id === s.id ? s : existing)
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        )
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  return (
    <div className="flex flex-col h-full border-r bg-background w-56 shrink-0">
      <div className="p-3 border-b">
        <button
          onClick={onNewChat}
          className="w-full text-sm px-3 py-2 rounded-lg bg-primary
                     text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          + New Chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sessions.map(s => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`w-full text-left px-3 py-2.5 text-xs border-b hover:bg-muted
                        transition-colors ${activeId === s.id ? 'bg-muted font-medium' : ''}`}
          >
            <p className="truncate font-medium text-foreground">{s.title ?? 'Untitled'}</p>
            <p className="text-muted-foreground mt-0.5">
              {new Date(s.updated_at).toLocaleDateString('en-MY')}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
