import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { invokeWorkerServer } from '@/lib/worker-server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { orderId, merchantId, priorityFee } = await req.json()
  
  const { data, error } = await invokeWorkerServer('lalamove-add-priority-fee', {
    body: { orderId, merchantId, tipAmount: priorityFee }
  })

  if (error) return NextResponse.json({ error: error.message || error.error || 'Failed to add Priority Fee' }, { status: 400 })
  return NextResponse.json(data)
}
