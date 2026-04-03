import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'

async function getAgentStats() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Admin-only page — check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/')

  // Use service role for cross-merchant queries
  const { createClient: adminClient } = await import('@supabase/supabase-js')
  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Last 24h stats
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [traces, errors, costs, feedback] = await Promise.all([
    admin.from('agent_traces').select('id', { count: 'exact' }).gte('created_at', since),
    admin.from('agent_traces').select('id', { count: 'exact' }).eq('status', 'failed').gte('created_at', since),
    admin.from('agent_traces').select('estimated_cost_usd').gte('created_at', since),
    admin.from('agent_feedback').select('rating').gte('created_at', since)
  ])

  const totalCost    = (costs.data as any[])?.reduce((s, r) => s + (r.estimated_cost_usd ?? 0), 0) ?? 0
  const thumbsUp     = (feedback.data as any[])?.filter(f => f.rating === 1).length ?? 0
  const thumbsDown   = (feedback.data as any[])?.filter(f => f.rating === -1).length ?? 0
  const satisfactionRate = thumbsUp + thumbsDown > 0
    ? Math.round((thumbsUp / (thumbsUp + thumbsDown)) * 100)
    : null

  return {
    totalRuns:        traces.count  ?? 0,
    failedRuns:       errors.count  ?? 0,
    totalCostUsd:     totalCost,
    thumbsUp,
    thumbsDown,
    satisfactionRate
  }
}

export default async function AgentHealthPage() {
  const stats = await getAgentStats()

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Agent Health — Last 24h</h1>
        <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Admin Only</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Runs',     value: stats.totalRuns.toLocaleString() },
          { label: 'Failed Runs',    value: stats.failedRuns.toLocaleString(),
            alert: stats.failedRuns > 10 },
          { label: 'Total Cost',     value: `$${stats.totalCostUsd.toFixed(4)}` },
          { label: 'Thumbs Up',      value: stats.thumbsUp.toLocaleString() },
          { label: 'Thumbs Down',    value: stats.thumbsDown.toLocaleString() },
          { label: 'Satisfaction',   value: stats.satisfactionRate != null
                                       ? `${stats.satisfactionRate}%`
                                       : 'N/A' }
        ].map(kpi => (
          <div key={kpi.label}
               className={`border rounded-xl p-4 space-y-1
                 ${(kpi as any).alert
                   ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950'
                   : 'bg-background'}`}>
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className="text-2xl font-bold">{kpi.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
