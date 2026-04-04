import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { invokeWorkerServer } from '@/lib/worker-server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 })
    }

    // Call the Consolidated E-Invoice Worker Route
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-indexed

    const { data: result, error: invokeError } = await invokeWorkerServer('einvoice-consolidate', {
      body: { 
        merchant_id: merchant.id,
        year,
        month
      }
    });

    if (invokeError) {
      console.error('Worker Invoke Error:', invokeError);
      return NextResponse.json({ error: invokeError.error || invokeError.message || 'Failed to trigger consolidation' }, { status: 400 });
    }

    if (result && result.success === false) {
      return NextResponse.json({ error: result.error || 'Failed to consolidate' }, { status: 400 });
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Consolidation Trigger Error:', {
      message: error.message,
      stack: error.stack,
      cause: error.cause
    })
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
