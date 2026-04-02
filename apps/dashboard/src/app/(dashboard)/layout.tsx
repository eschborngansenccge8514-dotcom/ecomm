import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { Header } from '@/components/dashboard/Header'
import { NewOrderListener } from '@/components/dashboard/NewOrderListener'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch profile and merchant in parallel — saves one sequential round-trip
  const [{ data: profile }, { data: merchant }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('merchants').select('*').eq('owner_id', user.id).single(),
  ])

  const isAdmin = profile?.role === 'admin'

  if (!merchant && !isAdmin) {
    if (profile?.role === 'merchant') {
      redirect('/apply')
    }
    // For any other authenticated role (like customer) that shouldn't be here
    redirect('/login')
  }

  // Define a default merchant-like object for admins without a store
  const displayMerchant = merchant || {
    id: 'admin',
    store_name: 'Platform Admin',
    status: 'active',
    logo_url: null
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar merchant={displayMerchant} profile={profile} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header user={user} merchant={displayMerchant} profile={profile} />
        <NewOrderListener merchantId={displayMerchant.id} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
