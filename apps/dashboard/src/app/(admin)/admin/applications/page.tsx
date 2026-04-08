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
    .select('*')
    .order('created_at', { ascending: false })

  if (applicationsError) {
    console.error('Error fetching applications:', {
      message: applicationsError.message,
      details: applicationsError.details,
      hint: applicationsError.hint,
      code: applicationsError.code
    })
  }

  // Fetch profiles separately (no FK relationship between merchant_applications.user_id and profiles)
  let applicationsWithProfiles = applications || []
  if (applications && applications.length > 0) {
    const userIds = applications.map((a: any) => a.user_id)
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', userIds)

    if (profiles) {
      const profileMap = Object.fromEntries(profiles.map((p: any) => [p.id, p]))
      applicationsWithProfiles = applications.map((a: any) => ({
        ...a,
        profiles: profileMap[a.user_id] || null
      }))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Merchant Applications</h2>
        <p className="text-muted-foreground">
          Review and manage new merchant sign-up requests.
        </p>
      </div>
      
      <MerchantApplicationsClient initialApplications={applicationsWithProfiles} />
    </div>
  )
}
