import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: approvalId } = await params
  
  // Auth check
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json()
  const { action, reject_reason } = body

  // Forward to centralized Edge Function
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/approve-and-execute`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        approvalId,
        action,
        reject_reason
      })
    })

    const result = await res.json()
    if (!res.ok) {
      return Response.json(result, { status: res.status })
    }

    return Response.json(result)
  } catch (err) {
    console.error('Approval Proxy Error:', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}

