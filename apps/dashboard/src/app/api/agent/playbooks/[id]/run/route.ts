import { NextResponse } from 'next/server'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { merchantId } = await req.json()
  const playbookId = params.id

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/run-scheduled-agent`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        run_type:    'playbook',
        merchant_id: merchantId,
        playbook_id: playbookId,
        context:     'Manual run from dashboard'
      })
    }
  )

  const result = await response.json()
  return NextResponse.json(result)
}
