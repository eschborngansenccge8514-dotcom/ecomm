import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseClient } from '../_shared/supabase.ts'

serve(async (req) => {
  const supabase = getSupabaseClient()
  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const currentDay = now.getDay() // 0=Sun
  const currentDayOfMonth = now.getDate()

  const formattedTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`

  // 1. Find all active playbooks that match the current schedule
  const { data: playbooks } = await supabase
    .from('agent_playbooks')
    .select('*')
    .eq('is_active', true)
    .or(`schedule->>time.eq.${formattedTime},schedule->>type.eq.manual`) // Manual check? No, just scheduled

  if (!playbooks) return new Response('No playbooks scheduled')

  const matchingPlaybooks = playbooks.filter(p => {
    const s = p.schedule
    if (s.type === 'daily') return s.time === formattedTime
    if (s.type === 'weekly') return s.time === formattedTime && s.day === currentDay
    if (s.type === 'monthly') return s.time === formattedTime && s.day_of_month === currentDayOfMonth
    return false
  })

  // 2. Trigger run-scheduled-agent for each matching playbook
  const promises = matchingPlaybooks.map(p =>
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/run-scheduled-agent`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        run_type:    'playbook',
        merchant_id: p.merchant_id,
        playbook_id: p.id
      })
    })
  )

  await Promise.allSettled(promises)
  return new Response(`Triggered ${matchingPlaybooks.length} playbooks`)
})
