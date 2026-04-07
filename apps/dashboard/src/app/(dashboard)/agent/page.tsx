import { useEffect, useState } from 'react'
import { AgentSessionList } from '@/components/agent/AgentSessionList'
import { AgentChatPanel }   from '@/components/agent/AgentChatPanel'
import { createClient }     from '@/lib/supabase/client'

export default function AgentPage() {
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [userId, setUserId] = useState<string | undefined>()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  return (
    <div className="flex flex-1 h-[calc(100vh-4rem)] overflow-hidden">
      <AgentSessionList
        activeId={sessionId}
        onSelect={setSessionId}
        onNewChat={() => setSessionId(undefined)}
        userId={userId}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <AgentChatPanel
          key={sessionId ?? 'new'}   // remount on session change
          initialSessionId={sessionId}
          userId={userId}
        />
      </div>
    </div>
  )
}
