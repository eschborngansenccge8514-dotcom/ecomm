import { getAuthContext } from '@/lib/utils.server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { Header } from '@/components/dashboard/Header'
import { NewOrderListener } from '@/components/dashboard/NewOrderListener'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, profile, merchant, isAdmin } = await getAuthContext()

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
