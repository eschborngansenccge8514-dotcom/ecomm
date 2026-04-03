'use client'

import { useState } from 'react'
import { AgentSessionList } from '@/components/agent/AgentSessionList'
import { AgentChatPanel }   from '@/components/agent/AgentChatPanel'

export default function AgentPage() {
  const [sessionId, setSessionId] = useState<string | undefined>()

  return (
    <div className="flex flex-1 h-[calc(100vh-4rem)] overflow-hidden">
      <AgentSessionList
        activeId={sessionId}
        onSelect={setSessionId}
        onNewChat={() => setSessionId(undefined)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <AgentChatPanel
          key={sessionId ?? 'new'}   // remount on session change
          initialSessionId={sessionId}
        />
      </div>
    </div>
  )
}
