import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // 1. Fetch marketplace accounts status
  const { data: accounts } = await supabase
    .from('marketplace_accounts')
    .select('provider_id, status, last_sync_at')
    .eq('tenant_id', user.id)

  // 2. Fetch product mapping health (missing descriptions, low stock, etc.)
  // For now, simulate counts based on the mappings table
  const { count: totalListings } = await supabase
    .from('marketplace_product_mappings')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', user.id)

  // Simulate some issues
  const issues = [
    { type: 'low_stock', count: 3, severity: 'warning', message: '3 listings have stock below 10' },
    { type: 'sync_error', count: 1, severity: 'error', message: '1 listing failed to sync with TikTok' },
    { type: 'missing_desc', count: 5, severity: 'info', message: '5 listings have missing descriptions' }
  ];

  return Response.json({
    total_listings: totalListings || 0,
    accounts: accounts || [],
    issues: issues,
    health_score: 85 // out of 100
  })
}
