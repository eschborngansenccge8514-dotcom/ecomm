import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { invokeWorkerServer } from '@/lib/worker-server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { orderId, merchantId } = await req.json()
  
  const { data, error } = await invokeWorkerServer('lalamove-retry-order', {
    body: { orderId, merchantId }
  })

  if (error) return NextResponse.json({ error: error.message || error.error || 'Retry failed' }, { status: 400 })
  return NextResponse.json(data)
}
