import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils.server'

export async function GET(req: Request) {
  try {
    const { supabase, user, merchant, isAdmin } = await getAuthContext()
    
    // Admins can see all if they want, but usually we filter by current merchant context
    // For now, filter by the user's merchant_id (user matches owner)
    const { data: playbooks, error } = await supabase
      .from('agent_playbooks')
      .select('*')
      .eq('merchant_id', merchant?.id || user.id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(playbooks)
  } catch (e: any) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user, merchant } = await getAuthContext()
    const body = await req.json()

    // Ensure merchant_id is set to the current user's merchant
    const playbookData = {
      ...body,
      merchant_id: merchant?.id || user.id
    }

    const { data, error } = await supabase
      .from('agent_playbooks')
      .insert([playbookData])
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

