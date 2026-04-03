import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: sessions, error } = await supabase
    .from('agent_sessions')
    .select('id, title, created_at, updated_at, status')
    .eq('merchant_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(30)

  if (error) return new Response(error.message, { status: 500 })

  return Response.json(sessions ?? [])
}
