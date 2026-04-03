import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Simplified count logic for dashboard
  const { data: points } = await supabase
    .from('loyalty_points')
    .select('id, total_spent_rm, updated_at, created_at')
    .eq('merchant_id', user.id)

  if (!points) return NextResponse.json({ vip: 0, loyal: 0, at_risk: 0, new: 0 })

  const now = Date.now()
  const sixtyDays = 60 * 24 * 60 * 60 * 1000
  const thirtyDays = 30 * 24 * 60 * 60 * 1000

  const counts = {
    vip:     points.filter(p => (p.total_spent_rm || 0) > 1000).length,
    loyal:   points.filter(p => (p.total_spent_rm || 0) > 200).length,
    at_risk: points.filter(p => (now - new Date(p.updated_at).getTime()) > sixtyDays).length,
    new:     points.filter(p => (now - new Date(p.created_at).getTime()) < thirtyDays).length,
  }

  return NextResponse.json(counts)
}
