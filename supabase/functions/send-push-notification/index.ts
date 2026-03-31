import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { userId, userIds, title, body, data } = await req.json()
    
    // Support single userId or array of userIds
    const targetUserIds = userIds || (userId ? [userId] : [])
    if (targetUserIds.length === 0) throw new Error('userId or userIds is required')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Fetch Expo Push Tokens for all users
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, expo_push_token')
      .in('id', targetUserIds)

    if (profileError || !profiles) throw new Error('Failed to fetch user profiles')

    const messages = profiles
      .filter(p => p.expo_push_token && p.expo_push_token.startsWith('ExponentPushToken'))
      .map(p => ({
        to: p.expo_push_token,
        sound: 'default',
        title,
        body,
        data: { ...data, userId: p.id }
      }))

    if (messages.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No valid push tokens found' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    // 2. Call Expo Push API
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages)
    })

    const resData = await res.json()

    // 3. Log results and handle token errors
    const logs = messages.map((m, i) => {
      const response = resData.data[i]
      const status = response.status // 'ok' or 'error'
      
      return {
        user_id: profiles.find(p => p.expo_push_token === m.to)?.id,
        title,
        body,
        data,
        status,
        response_payload: response
      }
    })

    await supabase.from('push_notification_logs').insert(logs)

    // Clear invalid tokens if needed
    for (let i = 0; i < resData.data.length; i++) {
      const response = resData.data[i]
      if (response.status === 'error' && response.details?.error === 'DeviceNotRegistered') {
        const token = messages[i].to
        await supabase.from('profiles').update({ expo_push_token: null }).eq('expo_push_token', token)
      }
    }

    return new Response(JSON.stringify({ success: true, count: messages.length }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200, // Return as 200 to caller
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
