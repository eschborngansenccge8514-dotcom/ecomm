import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callEasyParcel } from '../_shared/easyparcel.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const { merchantId, apiKey, environment } = await req.json()

  if (!apiKey || !merchantId) {
    return new Response(JSON.stringify({ success: false, error: 'Missing apiKey or merchantId' }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    // ── 1. Validate key via MPRateCheckingBulk (KL → PJ test route) ────────────
    const rateData = await callEasyParcel(supabase, null, 'MPRateCheckingBulk', {
      'bulk[0][pick_code]':    '55100',
      'bulk[0][pick_state]':   'kul',
      'bulk[0][pick_country]': 'MY',
      'bulk[0][send_code]':    '47810',
      'bulk[0][send_state]':   'sgr',
      'bulk[0][send_country]': 'MY',
      'bulk[0][weight]':       '0.5',
    }, { apiKey, environment })

    if (rateData?.api_status === 'Error' || rateData?.api_status === 'Fail') {
      const msg = rateData?.error_remark || rateData?.error_message || 'Invalid API key or connection error'
      await supabase.from('merchant_easyparcel_config')
        .update({ last_tested_at: new Date().toISOString(), last_test_result: `failed: ${msg}` })
        .eq('merchant_id', merchantId)
      return new Response(JSON.stringify({ success: false, error: msg }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    // ── 2. Fetch wallet balance via EPCheckCreditBalance ──────────────────────
    let walletBalance: number | null = null
    try {
      const balanceData = await callEasyParcel(supabase, null, 'EPCheckCreditBalance', {}, { apiKey, environment })
      if (balanceData?.api_status === 'Success') {
        walletBalance = parseFloat(balanceData?.result ?? '0')
      }
    } catch (e) {
      console.error('Wallet check failed:', e)
    }

    // Save verified key + wallet balance
    await supabase.from('merchant_easyparcel_config')
      .update({
        api_key:           apiKey,
        environment,
        last_tested_at:    new Date().toISOString(),
        last_test_result:  'success',
        wallet_balance:    walletBalance,
        wallet_updated_at: walletBalance !== null ? new Date().toISOString() : null,
        updated_at:        new Date().toISOString(),
      })
      .eq('merchant_id', merchantId)

    // Extract sample couriers from rate check
    const couriers = (rateData?.result ?? []).map((r: any) => ({
      id:    r.service_id || r.courier_id,
      name:  r.courier_name,
      price: r.price,
    })).slice(0, 5)

    return new Response(JSON.stringify({ success: true, walletBalance, couriers }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    await supabase.from('merchant_easyparcel_config')
      .update({ last_tested_at: new Date().toISOString(), last_test_result: `error: ${err.message}` })
      .eq('merchant_id', merchantId)
    return new Response(JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})

