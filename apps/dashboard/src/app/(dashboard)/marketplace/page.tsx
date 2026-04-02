import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MarketplaceClient } from '@/components/dashboard/MarketplaceClient'

export default async function MarketplacePage() {
  const supabase = await createClient()

  // 1. Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Get merchant (tenant)
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, store_name')
    .eq('owner_id', user.id)
    .single()

  if (!merchant) redirect('/setup')

  // 3. Fetch Marketplace Providers
  const { data: providers } = await supabase
    .from('marketplace_providers')
    .select('*')
    .order('name')

  // 4. Fetch Connected Accounts
  const { data: accounts } = await supabase
    .from('marketplace_accounts')
    .select('*')
    .eq('tenant_id', merchant.id)

  // 5. Fetch Recent Sync Jobs
  const { data: recentJobs } = await supabase
    .from('marketplace_sync_jobs')
    .select('*')
    .eq('tenant_id', merchant.id)
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketplace Integrations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Connect and sync your products, inventory, and orders across multiple channels.
          </p>
        </div>
      </div>

      <MarketplaceClient 
        providers={providers || []}
        accounts={accounts || []}
        recentJobs={recentJobs || []}
        merchantId={merchant.id}
      />
    </div>
  )
}
