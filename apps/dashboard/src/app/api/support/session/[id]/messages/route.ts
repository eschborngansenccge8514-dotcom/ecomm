import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client not initialized' }, { status: 500 })
  }

  const { id } = await params

  try {
    const { data: messages, error } = await supabaseAdmin
      .from('support_messages')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json(messages || [])
  } catch (error: any) {
    console.error('[API/Support/Messages] GET Error:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}
