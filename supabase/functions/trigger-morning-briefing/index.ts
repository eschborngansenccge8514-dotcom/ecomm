import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseClient } from '../_shared/supabase.ts'

serve(async (req) => {
  const supabase = getSupabaseClient()

  // 1. Get all active merchants
  const { data: merchants } = await supabase
    .from('merchants')
    .select('id')

  if (!merchants) return new Response('No merchants found', { status: 200 })

  // 2. Trigger morning briefing for each
  const promises = merchants.map(m =>
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/run-scheduled-agent`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        run_type:    'morning_briefing',
        merchant_id: m.id
      })
    })
  )

  await Promise.allSettled(promises)

  return new Response(`Triggered ${merchants.length} briefings`)
})
