import { getAuthContext } from '@/lib/utils.server'
import { SupportInboxClient } from '@/components/support/SupportInboxClient'
import { redirect } from 'next/navigation'

export default async function SupportConversationPage({
  params
}: {
  params: { id: string }
}) {
  const { supabase, user, merchant } = await getAuthContext()

  if (!user) {
    return <div>Unauthorized</div>
  }

  // Fetch all support sessions to populate the sidebar list
  const { data: sessions } = await supabase
    .from('support_sessions')
    .select(`
      *,
      support_messages (count)
    `)
    .eq('merchant_id', user.id)
    .order('updated_at', { ascending: false })

  return (
    <div className="-m-6 h-[calc(100vh-64px)] overflow-hidden bg-background">
      <SupportInboxClient 
        userId={user.id} 
        initialSessions={sessions || []} 
        defaultSessionId={params.id}
      />
    </div>
  )
}
