import { getAuthContext } from '@/lib/utils.server'

export async function GET() {
  const { supabase, user, merchant, isAdmin } = await getAuthContext()
  
  if (!user || (!merchant && !isAdmin)) return new Response('Unauthorized', { status: 401 })

  const { data: sessions, error } = await supabase
    .from('agent_sessions')
    .select('id, title, created_at, updated_at, status')
    .eq('merchant_id', user.id) // Schema uses merchant_id column for user_id FK
    .order('updated_at', { ascending: false })
    .limit(30)

  if (error) return new Response(error.message, { status: 500 })

  return Response.json(sessions ?? [])
}
