import { getAuthContext } from '@/lib/utils.server'
import { redirect } from 'next/navigation'
import { MarketplaceClient } from '@/components/dashboard/MarketplaceClient'
import { ListingHealthWidget } from '@/components/dashboard/ListingHealthWidget'

export default async function MarketplacePage() {
  const { supabase, user, merchant, isAdmin } = await getAuthContext()

  const effectiveMerchantId = merchant?.id || 'admin'

  // 3. Fetch Marketplace Providers
  const { data: providers } = await supabase
    .from('marketplace_providers')
    .select('*')
    .order('name')

  // 4. Fetch Connected Accounts
  let accountsQuery = supabase.from('marketplace_accounts').select('*')
  if (merchant) {
    accountsQuery = accountsQuery.eq('tenant_id', merchant.id)
  }
  const { data: accounts } = await accountsQuery

  // 5. Fetch Recent Sync Jobs
  let syncJobsQuery = supabase
    .from('marketplace_sync_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)
  if (merchant) {
    syncJobsQuery = syncJobsQuery.eq('tenant_id', merchant.id)
  }
  const { data: recentJobs } = await syncJobsQuery

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Marketplace Integrations</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Connect and sync your products, inventory, and orders across multiple channels. Real-time health monitoring of your listings is enabled below.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        <div className="xl:col-span-2">
            <MarketplaceClient 
                providers={providers || []}
                accounts={accounts || []}
                recentJobs={recentJobs || []}
                merchantId={effectiveMerchantId}
            />
        </div>
        <div className="space-y-6">
            <ListingHealthWidget />
        </div>
      </div>
    </div>
  )
}
