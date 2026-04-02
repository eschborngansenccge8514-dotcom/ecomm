import { createClient } from '@/lib/supabase/server'
import { MerchantsDirectoryClient } from '@/components/dashboard/admin/MerchantsDirectoryClient'

export default async function AdminMerchantsPage() {
  const supabase = await createClient()

  // Fetch all merchants
  const { data: merchants } = await supabase
    .from('merchants')
    .select(`
      *,
      profiles:owner_id (
        full_name,
        phone,
        email
      )
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Merchant Directory</h2>
        <p className="text-muted-foreground">
          View and manage all registered merchants on the platform.
        </p>
      </div>
      
      <MerchantsDirectoryClient initialMerchants={merchants || []} />
    </div>
  )
}
