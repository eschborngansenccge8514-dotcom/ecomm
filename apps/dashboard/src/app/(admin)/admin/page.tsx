import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import Link from 'next/link'
import { 
  Users, 
  FileText, 
  Activity, 
  ArrowUpRight 
} from 'lucide-react'

async function getAdminStats() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/')

  // Use service role for platform-wide stats
  const { createClient: adminClient } = await import('@supabase/supabase-js')
  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [merchants, applications, traces] = await Promise.all([
    admin.from('merchants').select('id', { count: 'exact' }),
    admin.from('merchant_applications').select('id', { count: 'exact' }).eq('status', 'pending'),
    admin.from('agent_traces').select('id', { count: 'exact' }).gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  ])

  return {
    totalMerchants: merchants.count ?? 0,
    pendingApplications: applications.count ?? 0,
    agentRuns24h: traces.count ?? 0
  }
}

export default async function AdminDashboardPage() {
  const stats = await getAdminStats()

  const cards = [
    {
      title: 'Total Merchants',
      value: stats.totalMerchants,
      icon: Users,
      href: '/admin/merchants',
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    {
      title: 'Pending Applications',
      value: stats.pendingApplications,
      icon: FileText,
      href: '/admin/applications',
      color: 'text-amber-600',
      bg: 'bg-amber-50'
    },
    {
      title: 'Agent Activity (24h)',
      value: stats.agentRuns24h,
      icon: Activity,
      href: '/admin/agent-health',
      color: 'text-purple-600',
      bg: 'bg-purple-50'
    }
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-outfit">Platform Overview</h1>
        <p className="text-gray-500 mt-1">Manage the Hyperlocal platform and merchant ecosystem.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card) => (
          <Link 
            key={card.title} 
            href={card.href}
            className="group p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all hover:border-gray-200"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${card.bg}`}>
                <card.icon className={card.color} size={24} />
              </div>
              <ArrowUpRight className="text-gray-300 group-hover:text-gray-400 transition-colors" size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{card.title}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-8">
        <h2 className="text-lg font-semibold mb-4 font-outfit">Quick Actions</h2>
        <div className="flex flex-wrap gap-4">
          <Link href="/admin/merchants" className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors">
            Manage Merchants
          </Link>
          <Link href="/admin/applications" className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
            Review Applications
          </Link>
          <Link href="/" className="px-4 py-2 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-50 transition-colors">
            Switch to Merchant View
          </Link>
        </div>
      </div>
    </div>
  )
}
