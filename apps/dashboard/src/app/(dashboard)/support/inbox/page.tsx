import { getAuthContext } from '@/lib/utils.server'
import { SupportInboxClient } from '@/components/support/SupportInboxClient'

export default async function SupportInboxPage() {
  const { supabase, user, merchant } = await getAuthContext()

  if (!user) {
    return <div>Unauthorized</div>
  }

  // Fetch all support sessions for this merchant
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
      />
    </div>
  )
}
