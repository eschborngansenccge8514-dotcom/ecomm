import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: CORS })

  try {
    const { amount, gateway } = await req.json()
    if (!amount || amount <= 0) throw new Error('Valid amount is required')
    if (!gateway) throw new Error('Gateway is required')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get user from Authorization header
    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) throw new Error('Unauthorized')

    // Get merchant
    const { data: merchant, error: mError } = await supabase
      .from('merchants')
      .select('id, store_name, phone, email')
      .eq('owner_id', user.id)
      .single()

    if (mError || !merchant) throw new Error('Merchant not found')

    // 1. Create a pending top-up record
    const { data: topup, error: tError } = await supabase
      .from('wallet_topups')
      .insert({
        merchant_id: merchant.id,
        amount: Number(amount),
        status: 'pending',
        payment_gateway: gateway
      })
      .select()
      .single()

    if (tError) throw tError

    let paymentData = {}

    if (gateway === 'razorpay') {
      const keyId     = Deno.env.get('RAZORPAY_KEY_ID')!
      const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!
      const authHeaderR = 'Basic ' + btoa(`${keyId}:${keySecret}`)

      const amountInSen = Math.round(Number(amount) * 100)

      const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Authorization': authHeaderR,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount:   amountInSen,
          currency: 'MYR',
          receipt:  `TOPUP-${topup.id.slice(0, 8)}`,
          notes:    { 
            type: 'wallet_topup',
            topup_id: topup.id,
            merchant_id: merchant.id
          },
        }),
      })

      if (!razorpayRes.ok) {
        const errText = await razorpayRes.text()
        throw new Error(`Razorpay error: ${errText}`)
      }

      const razorpayOrder = await razorpayRes.json()
      
      await supabase
        .from('wallet_topups')
        .update({ payment_id: razorpayOrder.id })
        .eq('id', topup.id)

      paymentData = {
        razorpayOrderId: razorpayOrder.id,
        razorpayKeyId:   keyId,
        amount:          amountInSen,
        currency:        'MYR'
      }
    } else if (gateway === 'billplz') {
      const apiKey = Deno.env.get('BILLPLZ_API_KEY')!
      const collectionId = Deno.env.get('BILLPLZ_COLLECTION_ID')! // Platform collection
      const authHeaderB = 'Basic ' + btoa(`${apiKey}:`)

      const billplzRes = await fetch('https://www.billplz.com/api/v3/bills', {
        method: 'POST',
        headers: {
          'Authorization': authHeaderB,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collection_id: collectionId,
          email:         user.email,
          mobile:        merchant.phone || '',
          name:          merchant.store_name,
          amount:        Math.round(Number(amount) * 100),
          callback_url:  `${Deno.env.get('SUPABASE_URL')}/functions/v1/billplz-webhook`,
          description:   `Wallet Top-up for ${merchant.store_name}`,
          reference_1:   topup.id,
          reference_2:   'wallet_topup'
        }),
      })

      if (!billplzRes.ok) {
        const errText = await billplzRes.text()
        throw new Error(`Billplz error: ${errText}`)
      }

      const billData = await billplzRes.json()
      
      await supabase
        .from('wallet_topups')
        .update({ payment_id: billData.id })
        .eq('id', topup.id)

      paymentData = {
        billId: billData.id,
        url:    billData.url
      }
    } else {
      throw new Error('Unsupported gateway')
    }

    return new Response(
      JSON.stringify({ success: true, topupId: topup.id, ...paymentData }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
