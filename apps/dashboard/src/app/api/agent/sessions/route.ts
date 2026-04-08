import { resolveAuth } from '@/lib/utils.server'

export async function GET(req: Request) {
  const auth = await resolveAuth(req)
  if (!auth || (!auth.merchant && !auth.isAdmin)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  const { user, supabase } = auth

  const { data: sessions, error } = await supabase
    .from('agent_sessions')
    .select('id, title, created_at, updated_at, status')
    .eq('merchant_id', user.id) // Schema uses merchant_id column for user_id FK
    .order('updated_at', { ascending: false })
    .limit(30)

  if (error) return new Response(error.message, { status: 500 })

  return Response.json(sessions ?? [])
}

