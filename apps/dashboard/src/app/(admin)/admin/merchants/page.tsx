import { supabaseAdmin } from '@/lib/supabase/admin'
import { MerchantsDirectoryClient } from '@/components/dashboard/admin/MerchantsDirectoryClient'
import { redirect } from 'next/navigation'

export default async function AdminMerchantsPage() {
  if (!supabaseAdmin) {
    console.error('supabaseAdmin not initialized. Check SUPABASE_SERVICE_ROLE_KEY.')
    return <div>Error loading admin data.</div>
  }

  // Fetch all merchants using admin client to bypass RLS
  const { data: merchants, error: merchantsError } = await supabaseAdmin
    .from('merchants')
    .select(`
      *,
      profiles!owner_id (
        full_name,
        phone
      )
    `)
    .order('created_at', { ascending: false })

  if (merchantsError) {
    console.error('Error fetching merchants:', {
      message: merchantsError.message,
      details: merchantsError.details,
      hint: merchantsError.hint,
      code: merchantsError.code
    })
  }

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
