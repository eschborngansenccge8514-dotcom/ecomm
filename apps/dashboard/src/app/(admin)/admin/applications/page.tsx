import { supabaseAdmin } from '@/lib/supabase/admin'
import { MerchantApplicationsClient } from '@/components/dashboard/admin/MerchantApplicationsClient'
import { redirect } from 'next/navigation'

export default async function AdminApplicationsPage() {
  if (!supabaseAdmin) {
    console.error('supabaseAdmin not initialized. Check SUPABASE_SERVICE_ROLE_KEY.')
    return <div>Error loading admin data.</div>
  }

  // Fetch all applications using admin client
  const { data: applications, error: applicationsError } = await supabaseAdmin
    .from('merchant_applications')
    .select(`
      *,
      profiles!user_id (
        full_name,
        phone
      )
    `)
    .order('created_at', { ascending: false })

  if (applicationsError) {
    console.error('Error fetching applications:', {
      message: applicationsError.message,
      details: applicationsError.details,
      hint: applicationsError.hint,
      code: applicationsError.code
    })
  }

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
