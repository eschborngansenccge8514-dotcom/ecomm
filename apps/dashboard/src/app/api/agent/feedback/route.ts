import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { message_id, session_id, rating, comment }
    : { message_id: string, session_id: string, rating: 1 | -1, comment?: string }
    = await req.json()

  if (!message_id || !session_id || !rating) {
    return new Response('Missing required fields', { status: 400 })
  }

  const { error } = await supabase.from('agent_feedback').insert({
    merchant_id: user.id,
    session_id,
    message_id,
    rating,
    comment: comment ?? null
  })

  if (error) {
    console.error('Error saving feedback:', error)
    return new Response('Error saving feedback', { status: 500 })
  }

  return Response.json({ saved: true })
}
