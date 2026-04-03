import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callEasyParcel } from '../_shared/easyparcel.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { merchantId } = await req.json().catch(() => ({}))
    let epCallConfig = undefined
    
    if (merchantId) {
      const { data: epConfig } = await supabase
        .from('merchant_easyparcel_config')
        .select('*')
        .eq('merchant_id', merchantId)
        .single()
      
      if (epConfig) {
        epCallConfig = {
          apiKey:  epConfig.api_key,
          authKey: epConfig.auth_key,
          environment: epConfig.environment || 'sandbox'
        }
      }
    }

    // Phase 7 — Credit Balance (MPCheckCreditBalance)
    const balanceData = await callEasyParcel(supabase, null, 'MPCheckCreditBalance', {}, epCallConfig)

    const balanceStr = balanceData.result?.credit_balance
    const balance = Number(balanceStr || 0)
    const threshold = 50.0 // RM 50

    console.log(`EasyParcel Balance Check: Current RM ${balance}`)

    if (balance < threshold) {
      console.warn(`EasyParcel balance low: RM ${balance}`)
      
      // Get admin user to notify
      const { data: admin } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1).single()
      
      if (admin) {
        await supabase.from('notifications').insert({
          user_id: admin.id,
          title: 'EasyParcel Balance Low',
          body: `Your EasyParcel wallet balance is RM ${balance.toFixed(2)}. Please top up to avoid booking failures.`,
          type: 'system_alert',
          data: { balance, threshold }
        })
      }
    }

    return new Response(JSON.stringify({ balance, threshold, low: balance < threshold }), { 
      headers: { ...CORS, 'Content-Type': 'application/json' } 
    })

  } catch (err: any) {
    console.error('[easyparcel-check-balance] Error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 400, 
      headers: { ...CORS, 'Content-Type': 'application/json' } 
    })
  }
})
