import { createClient } from '@/lib/supabase/server'
import { MerchantApplicationsClient } from '@/components/dashboard/admin/MerchantApplicationsClient'

export default async function AdminApplicationsPage() {
  const supabase = await createClient()

  // Fetch all applications
  const { data: applications } = await supabase
    .from('merchant_applications')
    .select(`
      *,
      profiles:user_id (
        full_name,
        phone
      )
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Merchant Applications</h2>
        <p className="text-muted-foreground">
          Review and manage new merchant sign-up requests.
        </p>
      </div>
      
      <MerchantApplicationsClient initialApplications={applications || []} />
    </div>
  )
}
