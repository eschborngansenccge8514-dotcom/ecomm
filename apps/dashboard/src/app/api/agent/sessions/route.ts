import { getAuthContext } from '@/lib/utils.server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  let user: any = null
  let merchant: any = null
  let isAdmin = false

  // 1. Try SSR session
  try {
    const auth = await getAuthContext()
    user = auth.user
    merchant = auth.merchant
    isAdmin = auth.isAdmin
  } catch (err) {
    // 2. Fallback to Bearer (Mobile)
    const authHeader = req.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const supabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { user: tokenUser } } = await supabase.auth.getUser(token)
      if (tokenUser) {
        user = tokenUser
        const [{ data: m }, { data: p }] = await Promise.all([
          supabase.from('merchants').select('*').eq('owner_id', tokenUser.id).single(),
          supabase.from('profiles').select('*').eq('id', tokenUser.id).single()
        ])
        merchant = m
        isAdmin = p?.role === 'admin'
      }
    }
  }

  if (!user || (!merchant && !isAdmin)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  // Use a simple client for this query
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: sessions, error } = await supabase
    .from('agent_sessions')
    .select('id, title, created_at, updated_at, status')
    .eq('merchant_id', user.id) // Schema uses merchant_id column for user_id FK
    .order('updated_at', { ascending: false })
    .limit(30)

  if (error) return new Response(error.message, { status: 500 })

  return Response.json(sessions ?? [])
}
