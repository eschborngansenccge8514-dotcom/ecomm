import { getAuthContext } from '@/lib/utils.server'
import { SupportSettingsClient } from '@/components/support/SupportSettingsClient'

export default async function SupportSettingsPage() {
  const { supabase, user, merchant, isAdmin } = await getAuthContext()

  if (!user) {
    return <div>Unauthorized</div>
  }

  // Fetch support config
  const { data: supportConfig } = await supabase
    .from('support_configs')
    .select('*')
    .eq('merchant_id', user.id)
    .single()

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Support Settings</h2>
      </div>
      <SupportSettingsClient 
        userId={user.id}
        initialConfig={supportConfig} 
      />
    </div>
  )
}
