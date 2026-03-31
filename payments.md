<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Continue with payments

Here is the complete payment system — 10 files, backend to frontend, fully wired.

***

## Architecture Overview

```
Checkout → Create DB order (pending) → Navigate to PaymentWebView
  → Edge Function creates gateway order/bill
  → WebView opens gateway page
  → User pays
  → App receives callback
  → Edge Function verifies + marks order paid
  → Navigate to Order Detail
```


***

## Step 1 — Install WebView

```bash
npx expo install react-native-webview
```


***

## Step 2 — Set Supabase Secrets

Run once in your terminal. These never touch the app or Git:

```bash
# Razorpay Curlec (get from dashboard.curlec.com)
supabase secrets set RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX
supabase secrets set RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXXXXXXXX

# Billplz (get from app.billplz.com > Settings > API)
supabase secrets set BILLPLZ_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
supabase secrets set BILLPLZ_COLLECTION_ID=xxxxxxxx
supabase secrets set BILLPLZ_X_SIGNATURE_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```


***

## File 1 — `supabase/functions/create-razorpay-order/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { orderId } = await req.json()
    if (!orderId) throw new Error('orderId is required')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch order to get amount + customer details
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, profiles:customer_id(full_name, phone, email:id(email))')
      .eq('id', orderId)
      .single()

    if (error || !order) throw new Error('Order not found')
    if (order.status !== 'pending') throw new Error('Order is not in pending state')

    const keyId     = Deno.env.get('RAZORPAY_KEY_ID')!
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!
    const authHeader = 'Basic ' + btoa(`${keyId}:${keySecret}`)

    // Amount in sen (smallest unit): RM 10.00 = 1000
    const amountInSen = Math.round(Number(order.total_amount) * 100)

    const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount:   amountInSen,
        currency: 'MYR',
        receipt:  order.order_number,
        notes:    { hyperlocal_order_id: orderId },
      }),
    })

    if (!razorpayRes.ok) {
      const err = await razorpayRes.text()
      throw new Error(`Razorpay API error: ${err}`)
    }

    const razorpayOrder = await razorpayRes.json()

    // Store razorpay order ID against our order for later verification
    await supabase
      .from('orders')
      .update({ payment_reference: razorpayOrder.id })
      .eq('id', orderId)

    return new Response(
      JSON.stringify({
        razorpayOrderId: razorpayOrder.id,
        razorpayKeyId:   keyId,
        amount:          amountInSen,
        currency:        'MYR',
        orderNumber:     order.order_number,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
```


***

## File 2 — `supabase/functions/verify-razorpay-payment/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hmac } from 'https://deno.land/x/hmac@v2.0.1/mod.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = await req.json()

    // ── Signature Verification ─────────────────────────────────────────────────
    // Razorpay signature = HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!
    const payload   = `${razorpayOrderId}|${razorpayPaymentId}`
    const expected  = hmac('sha256', keySecret, payload, 'utf8', 'hex') as string

    if (expected !== razorpaySignature) {
      throw new Error('Invalid payment signature — possible tampering detected')
    }

    // ── Update order in DB ─────────────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { error } = await supabase
      .from('orders')
      .update({
        status:              'paid',
        payment_status:      'paid',
        payment_reference:   razorpayPaymentId,
        paid_at:             new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('status', 'pending') // Idempotency guard

    if (error) throw error

    // Log payment event
    await supabase.from('payment_events').insert({
      order_id:       orderId,
      event_type:     'payment_verified',
      gateway:        'razorpay',
      gateway_ref:    razorpayPaymentId,
      raw_payload:    { razorpayOrderId, razorpayPaymentId },
    })

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
```


***

## File 3 — `supabase/functions/razorpay-webhook/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hmac } from 'https://deno.land/x/hmac@v2.0.1/mod.ts'

// Deploy with: supabase functions deploy razorpay-webhook --no-verify-jwt
serve(async (req) => {
  const body      = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''
  const secret    = Deno.env.get('RAZORPAY_KEY_SECRET')!

  // Verify webhook authenticity
  const expected = hmac('sha256', secret, body, 'utf8', 'hex') as string
  if (expected !== signature) {
    return new Response('Unauthorized', { status: 401 })
  }

  const event = JSON.parse(body)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Log every webhook for audit
  await supabase.from('payment_events').insert({
    event_type:  event.event,
    gateway:     'razorpay',
    gateway_ref: event.payload?.payment?.entity?.id,
    raw_payload: event,
  })

  // Handle payment capture
  if (event.event === 'payment.captured') {
    const payment  = event.payload.payment.entity
    const orderId  = payment.notes?.hyperlocal_order_id

    if (orderId) {
      await supabase
        .from('orders')
        .update({
          status:            'paid',
          payment_status:    'paid',
          payment_reference: payment.id,
          paid_at:           new Date().toISOString(),
        })
        .eq('id', orderId)
        .in('status', ['pending']) // Only update if still pending
    }
  }

  if (event.event === 'payment.failed') {
    const payment = event.payload.payment.entity
    const orderId = payment.notes?.hyperlocal_order_id
    if (orderId) {
      await supabase.from('payment_events').insert({
        order_id:    orderId,
        event_type:  'payment_failed',
        gateway:     'razorpay',
        gateway_ref: payment.id,
        raw_payload: payment,
      })
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```


***

## File 4 — `supabase/functions/create-billplz-bill/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BILLPLZ_BASE = 'https://www.billplz-sandbox.com/api' // change to billplz.com for production

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { orderId } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: order, error } = await supabase
      .from('orders')
      .select('*, profile:customer_id(full_name, phone)')
      .eq('id', orderId)
      .single()

    if (error || !order) throw new Error('Order not found')

    const apiKey        = Deno.env.get('BILLPLZ_API_KEY')!
    const collectionId  = Deno.env.get('BILLPLZ_COLLECTION_ID')!
    const supabaseUrl   = Deno.env.get('SUPABASE_URL')!
    const authHeader    = 'Basic ' + btoa(`${apiKey}:`)

    // Billplz amount is in cents: RM 10.00 = 1000
    const amountInCents = Math.round(Number(order.total_amount) * 100)

    const params = new URLSearchParams({
      collection_id:     collectionId,
      name:              order.profile?.full_name ?? 'Customer',
      email:             'noreply@hyperlocal.app', // use real email if available
      mobile:            order.profile?.phone ?? '',
      amount:            String(amountInCents),
      description:       `Order ${order.order_number}`,
      callback_url:      `${supabaseUrl}/functions/v1/billplz-webhook`,
      redirect_url:      `hyperlocal://payment-return`,
      reference_1_label: 'Order ID',
      reference_1:       orderId,
    })

    const billplzRes = await fetch(`${BILLPLZ_BASE}/v3/bills`, {
      method:  'POST',
      headers: { 'Authorization': authHeader },
      body:    params,
    })

    if (!billplzRes.ok) {
      const err = await billplzRes.text()
      throw new Error(`Billplz error: ${err}`)
    }

    const bill = await billplzRes.json()

    // Store bill ID for later verification
    await supabase
      .from('orders')
      .update({ payment_reference: bill.id })
      .eq('id', orderId)

    return new Response(
      JSON.stringify({ billUrl: bill.url, billId: bill.id }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
```


***

## File 5 — `supabase/functions/billplz-webhook/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hmac } from 'https://deno.land/x/hmac@v2.0.1/mod.ts'

// Deploy with: supabase functions deploy billplz-webhook --no-verify-jwt
serve(async (req) => {
  const body        = await req.text()
  const params      = new URLSearchParams(body)
  const xSignature  = Deno.env.get('BILLPLZ_X_SIGNATURE_KEY')!

  // ── Billplz X-Signature verification ────────────────────────────────────────
  // Signature = HMAC-SHA256 of pipe-delimited sorted param values (excluding x_signature)
  const keysToSign = ['billplz[id]', 'billplz[collection_id]', 'billplz[paid]',
                      'billplz[state]', 'billplz[amount]', 'billplz[paid_amount]',
                      'billplz[due_at]', 'billplz[email]', 'billplz[mobile]',
                      'billplz[name]', 'billplz[url]', 'billplz[reference_1]',
                      'billplz[reference_2]']

  const signedString = keysToSign
    .map(k => `${k}${params.get(k) ?? ''}`)
    .join('|')

  const computedSig = hmac('sha256', xSignature, signedString, 'utf8', 'hex') as string
  const receivedSig = params.get('x_signature') ?? ''

  if (computedSig !== receivedSig) {
    console.error('Billplz signature mismatch')
    return new Response('Unauthorized', { status: 401 })
  }

  const billId  = params.get('billplz[id]') ?? ''
  const paid    = params.get('billplz[paid]') === 'true'
  const orderId = params.get('billplz[reference_1]') ?? ''

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Log event
  await supabase.from('payment_events').insert({
    order_id:    orderId || null,
    event_type:  paid ? 'payment_captured' : 'payment_failed',
    gateway:     'billplz',
    gateway_ref: billId,
    raw_payload: Object.fromEntries(params.entries()),
  })

  if (paid && orderId) {
    await supabase
      .from('orders')
      .update({
        status:            'paid',
        payment_status:    'paid',
        payment_reference: billId,
        paid_at:           new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('status', 'pending')
  }

  return new Response('OK', { status: 200 })
})
```


***

## File 6 — Deploy the Edge Functions

```bash
# Deploy all five payment functions
supabase functions deploy create-razorpay-order   --no-verify-jwt
supabase functions deploy verify-razorpay-payment
supabase functions deploy razorpay-webhook         --no-verify-jwt
supabase functions deploy create-billplz-bill
supabase functions deploy billplz-webhook          --no-verify-jwt
```

Then in the **Razorpay Curlec Dashboard**, set your webhook URL to:

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/razorpay-webhook
```

And in the **Billplz Dashboard**, your callback URL is automatically set per-bill via the Edge Function.[^1]

***

## File 7 — `src/services/payment.service.ts`

```typescript
import { supabase } from '@/lib/supabase'

export const paymentService = {
  createRazorpayOrder: async (orderId: string) => {
    const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
      body: { orderId },
    })
    if (error) throw new Error(error.message)
    return data as {
      razorpayOrderId: string
      razorpayKeyId:   string
      amount:          number
      currency:        string
      orderNumber:     string
    }
  },

  verifyRazorpayPayment: async (params: {
    orderId:           string
    razorpayPaymentId: string
    razorpayOrderId:   string
    razorpaySignature: string
  }) => {
    const { data, error } = await supabase.functions.invoke('verify-razorpay-payment', {
      body: params,
    })
    if (error) throw new Error(error.message)
    return data as { success: boolean }
  },

  createBillplzBill: async (orderId: string) => {
    const { data, error } = await supabase.functions.invoke('create-billplz-bill', {
      body: { orderId },
    })
    if (error) throw new Error(error.message)
    return data as { billUrl: string; billId: string }
  },
}
```


***

## File 8 — `app/(customer)/(cart)/payment-webview.tsx`

This is the critical screen. It handles both Razorpay and Billplz in a single file:

```typescript
import {
  View, Text, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { useLocalSearchParams, router } from 'expo-router'
import { useState, useRef, useCallback } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { paymentService } from '@/services/payment.service'
import { useAuthStore } from '@/stores/authStore'
import Toast from 'react-native-toast-message'

// ─── Razorpay checkout HTML template ──────────────────────────────────────────
function buildRazorpayHTML(opts: {
  razorpayKeyId:   string
  razorpayOrderId: string
  amount:          number
  currency:        string
  orderNumber:     string
  customerName:    string
  customerPhone:   string
}): string {
  const config = JSON.stringify({
    key:         opts.razorpayKeyId,
    amount:      opts.amount,
    currency:    opts.currency,
    order_id:    opts.razorpayOrderId,
    name:        'Hyperlocal',
    description: `Order ${opts.orderNumber}`,
    theme:       { color: '#2563eb' },
    prefill: {
      name:    opts.customerName,
      contact: opts.customerPhone,
    },
    // FPX requires redirect=true and a callback_url
    // For non-FPX (card, wallet), the handler function below fires
    callback_url: 'hyperlocal://payment-return',
    redirect:     false,
  })

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: -apple-system, sans-serif; }
    .loader { text-align: center; }
    .loader p { color: #64748b; font-size: 14px; margin-top: 12px; }
    .spinner { width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <p>Opening payment...</p>
  </div>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    var options = ${config};

    options.handler = function(response) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'SUCCESS',
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_order_id:   response.razorpay_order_id,
        razorpay_signature:  response.razorpay_signature,
      }));
    };

    options.modal = {
      ondismiss: function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DISMISSED' }));
      },
      escape:       false,
      backdropclose: false,
    };

    var rzp = new Razorpay(options);

    rzp.on('payment.failed', function(response) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type:  'FAILED',
        code:  response.error.code,
        desc:  response.error.description,
      }));
    });

    // Delay slightly to ensure script is loaded
    setTimeout(function() { rzp.open(); }, 300);
  </script>
</body>
</html>
`
}

// ─── Razorpay WebView ──────────────────────────────────────────────────────────
function RazorpayView({
  orderId,
  onSuccess,
  onFailure,
  onDismiss,
}: {
  orderId:   string
  onSuccess: (paymentId: string, orderId: string, signature: string) => void
  onFailure: (desc: string) => void
  onDismiss: () => void
}) {
  const [html, setHtml]         = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const { profile } = useAuthStore()

  const loadGateway = useCallback(async () => {
    try {
      const data = await paymentService.createRazorpayOrder(orderId)
      setHtml(buildRazorpayHTML({
        razorpayKeyId:   data.razorpayKeyId,
        razorpayOrderId: data.razorpayOrderId,
        amount:          data.amount,
        currency:        data.currency,
        orderNumber:     data.orderNumber,
        customerName:    profile?.full_name ?? 'Customer',
        customerPhone:   profile?.phone ?? '',
      }))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [orderId])

  useState(() => { loadGateway() })

  const onMessage = useCallback((e: any) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data)
      if (msg.type === 'SUCCESS') {
        onSuccess(msg.razorpay_payment_id, msg.razorpay_order_id, msg.razorpay_signature)
      } else if (msg.type === 'FAILED') {
        onFailure(msg.desc ?? 'Payment failed')
      } else if (msg.type === 'DISMISSED') {
        onDismiss()
      }
    } catch (_) {}
  }, [onSuccess, onFailure, onDismiss])

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center gap-3">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-gray-400 text-sm">Preparing payment...</Text>
      </View>
    )
  }

  if (error || !html) {
    return (
      <View className="flex-1 items-center justify-center px-8 gap-4">
        <Ionicons name="warning-outline" size={48} color="#ef4444" />
        <Text className="text-gray-700 font-semibold text-center">
          Could not connect to payment gateway
        </Text>
        <Text className="text-gray-400 text-sm text-center">{error}</Text>
        <TouchableOpacity onPress={loadGateway} className="bg-primary-500 rounded-xl px-6 py-3">
          <Text className="text-white font-semibold">Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <WebView
      source={{ html }}
      javaScriptEnabled
      domStorageEnabled
      onMessage={onMessage}
      originWhitelist={['*']}
      mixedContentMode="always"
      style={{ flex: 1, backgroundColor: '#f8fafc' }}
    />
  )
}

// ─── Billplz WebView ───────────────────────────────────────────────────────────
function BillplzView({
  orderId,
  onSuccess,
  onFailure,
  onDismiss,
}: {
  orderId:   string
  onSuccess: (billId: string) => void
  onFailure: (reason: string) => void
  onDismiss: () => void
}) {
  const [billUrl, setBillUrl]     = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const loadBill = useCallback(async () => {
    try {
      const { billUrl: url } = await paymentService.createBillplzBill(orderId)
      setBillUrl(url)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [orderId])

  useState(() => { loadBill() })

  // Intercept Billplz redirect back to app [web:149]
  const onNavigationStateChange = useCallback((navState: any) => {
    const { url } = navState
    if (!url) return

    if (url.startsWith('hyperlocal://payment-return')) {
      const query = new URLSearchParams(url.split('?')[^1] ?? '')
      const paid  = query.get('billplz[paid]')
      const billId = query.get('billplz[id]')

      if (paid === 'true' && billId) {
        onSuccess(billId)
      } else {
        onFailure('Payment was not completed')
      }
    }
  }, [onSuccess, onFailure])

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center gap-3">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-gray-400 text-sm">Opening FPX payment...</Text>
      </View>
    )
  }

  if (error || !billUrl) {
    return (
      <View className="flex-1 items-center justify-center px-8 gap-4">
        <Ionicons name="warning-outline" size={48} color="#ef4444" />
        <Text className="text-gray-700 font-semibold text-center">Failed to create bill</Text>
        <Text className="text-gray-400 text-sm text-center">{error}</Text>
        <TouchableOpacity onPress={loadBill} className="bg-primary-500 rounded-xl px-6 py-3">
          <Text className="text-white font-semibold">Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <WebView
      source={{ uri: billUrl }}
      javaScriptEnabled
      domStorageEnabled
      onNavigationStateChange={onNavigationStateChange}
      startInLoadingState
      renderLoading={() => (
        <View className="absolute inset-0 bg-white items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      )}
      style={{ flex: 1 }}
    />
  )
}

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function PaymentWebViewScreen() {
  const { orderId, paymentMethod } = useLocalSearchParams<{
    orderId:       string
    paymentMethod: 'razorpay' | 'billplz'
  }>()
  const insets     = useSafeAreaInsets()
  const [isVerifying, setIsVerifying] = useState(false)

  const handleCancel = () => {
    Alert.alert(
      'Cancel payment?',
      'Your order is saved. You can retry payment from Order History.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => router.replace(`/(customer)/(orders)/${orderId}`),
        },
      ]
    )
  }

  // ── Razorpay success: verify signature on server ───────────────────────────
  const handleRazorpaySuccess = async (
    razorpayPaymentId: string,
    razorpayOrderId:   string,
    razorpaySignature: string
  ) => {
    setIsVerifying(true)
    try {
      await paymentService.verifyRazorpayPayment({
        orderId,
        razorpayPaymentId,
        razorpayOrderId,
        razorpaySignature,
      })
      Toast.show({ type: 'success', text1: 'Payment successful! 🎉' })
      router.replace(`/(customer)/(orders)/${orderId}`)
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Verification failed', text2: err.message })
      router.replace(`/(customer)/(orders)/${orderId}`)
    }
    setIsVerifying(false)
  }

  // ── Billplz success: webhook already handled by Edge Function ─────────────
  // The webhook fires before the redirect, so the order is already paid.
  // We just navigate to the order detail which will show 'paid' status.
  const handleBillplzSuccess = (_billId: string) => {
    Toast.show({ type: 'success', text1: 'Payment received! 🎉', text2: 'Your order is confirmed.' })
    router.replace(`/(customer)/(orders)/${orderId}`)
  }

  const handleFailure = (reason: string) => {
    Toast.show({ type: 'error', text1: 'Payment failed', text2: reason })
    router.replace(`/(customer)/(orders)/${orderId}`)
  }

  const handleDismiss = () => {
    Alert.alert(
      'Payment incomplete',
      'You closed the payment screen. Your order is saved — you can pay later from Order History.',
      [{ text: 'OK', onPress: () => router.replace(`/(customer)/(orders)/${orderId}`) }]
    )
  }

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-5 pt-4 pb-3 flex-row items-center gap-3 border-b border-gray-100">
        <TouchableOpacity onPress={handleCancel}>
          <Ionicons name="close" size={22} color="#374151" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-base font-bold text-gray-900">
            {paymentMethod === 'billplz' ? 'FPX Online Banking' : 'Card / E-Wallet'}
          </Text>
          <Text className="text-gray-400 text-xs">Secured by {paymentMethod === 'billplz' ? 'Billplz' : 'Razorpay Curlec'}</Text>
        </View>
        {/* Padlock */}
        <View className="flex-row items-center gap-1">
          <Ionicons name="lock-closed" size={13} color="#16a34a" />
          <Text className="text-green-600 text-xs font-semibold">Secure</Text>
        </View>
      </View>

      {/* Verifying overlay */}
      {isVerifying && (
        <View className="absolute inset-0 bg-black/40 z-50 items-center justify-center gap-3">
          <View className="bg-white rounded-2xl px-8 py-6 items-center gap-3">
            <ActivityIndicator size="large" color="#2563eb" />
            <Text className="text-gray-700 font-semibold">Verifying payment...</Text>
          </View>
        </View>
      )}

      {/* Gateway WebView */}
      {paymentMethod === 'razorpay' ? (
        <RazorpayView
          orderId={orderId}
          onSuccess={handleRazorpaySuccess}
          onFailure={handleFailure}
          onDismiss={handleDismiss}
        />
      ) : (
        <BillplzView
          orderId={orderId}
          onSuccess={handleBillplzSuccess}
          onFailure={handleFailure}
          onDismiss={handleDismiss}
        />
      )}
    </View>
  )
}
```


***

## File 9 — Update `app/(customer)/(cart)/_layout.tsx` (add payment-webview route)

```typescript
import { Stack } from 'expo-router'

export default function CartStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="checkout"        options={{ animation: 'slide_from_right' }} />
      <Stack.Screen
        name="payment-webview"
        options={{
          animation:           'slide_from_bottom',
          gestureEnabled:      false, // Prevent accidental swipe-dismiss during payment
          presentation:        'fullScreenModal',
        }}
      />
    </Stack>
  )
}
```


***

## File 10 — Update `handlePlaceOrder` in `checkout.tsx`

Replace only the `handlePlaceOrder` function in your existing `checkout.tsx`:

```typescript
const handlePlaceOrder = async () => {
  if (!canPlace) return
  setIsPlacing(true)
  try {
    // 1. Create the order record (always status: 'pending' first)
    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        merchant_id:      merchantId!,
        customer_id:      user!.id,
        status:           'pending',
        subtotal:         getTotal(),
        delivery_fee:     0,
        discount_amount:  0,
        total_amount:     getTotal(),
        payment_method:   paymentMethod,
        payment_status:   'unpaid',
        delivery_address: {
          name:     selectedAddress!.recipient_name,
          phone:    selectedAddress!.phone,
          line1:    selectedAddress!.address_line1,
          line2:    selectedAddress!.address_line2 ?? null,
          city:     selectedAddress!.city,
          state:    selectedAddress!.state,
          postcode: selectedAddress!.postcode,
        },
      })
      .select()
      .single()

    if (error) throw error

    // 2. Insert order items
    await supabase.from('order_items').insert(
      items.map(i => ({
        order_id:     order.id,
        product_id:   i.productId,
        variant_id:   i.variantId ?? null,
        product_name: i.productName,
        variant_name: i.variantName ?? null,
        unit_price:   i.price,
        quantity:     i.quantity,
        line_total:   i.price * i.quantity,
      }))
    )

    // 3. Clear cart immediately — order is safely in DB
    clearCart()

    // 4. Route based on payment method
    if (paymentMethod === 'cod') {
      // COD: mark as confirmed immediately, go straight to order detail
      await supabase
        .from('orders')
        .update({ status: 'confirmed', payment_status: 'unpaid' })
        .eq('id', order.id)

      Toast.show({ type: 'success', text1: 'Order placed! 🎉', text2: `Order ${order.order_number}` })
      router.replace(`/(customer)/(orders)/${order.id}`)

    } else {
      // Online payment: go to payment WebView
      router.replace({
        pathname: '/(customer)/(cart)/payment-webview',
        params:   { orderId: order.id, paymentMethod },
      })
    }
  } catch (err: any) {
    Toast.show({ type: 'error', text1: 'Failed to place order', text2: err.message })
  }
  setIsPlacing(false)
}
```


***

## Payment Events Table (Supabase SQL — run once)

Run this in your Supabase SQL Editor:

```sql
CREATE TABLE payment_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid REFERENCES orders(id) ON DELETE SET NULL,
  event_type  text NOT NULL,
  gateway     text NOT NULL,  -- 'razorpay' | 'billplz'
  gateway_ref text,           -- payment ID from gateway
  raw_payload jsonb,
  created_at  timestamptz DEFAULT now()
);

-- Only service role can write payment events (no customer can tamper)
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON payment_events
  USING (false) WITH CHECK (false);
```


***

## Full Verify Checklist

```bash
npx expo start
```

| Test case | Expected result |
| :-- | :-- |
| Select COD + Place Order | Order immediately shows as Confirmed, navigates to order detail |
| Select Razorpay + Place Order | `create-razorpay-order` Edge Function runs; Razorpay checkout HTML loads in WebView |
| Complete Razorpay card payment | `verify-razorpay-payment` HMAC check passes; order status changes to `paid` |
| Dismiss Razorpay WebView | Alert warns user, redirects to order with status `pending` (retryable) |
| Select Billplz + Place Order | Billplz bill created; bill URL opens in WebView |
| Complete FPX Billplz payment | Billplz webhook fires → Edge Function verifies X-Signature → order set to `paid` |
| WebView intercepts redirect | `hyperlocal://payment-return` URL intercepted; success/fail handled correctly |
| Check `payment_events` table | Every payment attempt logged with full raw payload |
| Signature tamper test | Modify `razorpay_signature` before verify → Edge Function rejects with 400 |

<span style="display:none">[^10][^11][^12][^13][^14][^15][^2][^3][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://billplz.github.io/api_slate/

[^2]: https://curlec.com

[^3]: https://razorpay.com/newsroom/say-hello-to-upi-in-malaysia-razorpay-curlec-team-up-with-npci-international-to-make-it-happen/

[^4]: https://curlec.com/payment-gateway/

[^5]: https://razorpay.com/docs/api/

[^6]: https://fintechnews.my/56273/payments-remittance-malaysia/razorpay-curlec-paypal/

[^7]: https://main.billplz.com/integrations

[^8]: https://docs.dodopayments.com/developer-resources/webhooks/examples/supabase-example

[^9]: https://fintechnews.my/54841/payments-remittance-malaysia/razorpay-curlec-upi-payments-malaysia/

[^10]: https://www.npmjs.com/package/@nmhafiz/n8n-nodes-billplz

[^11]: https://www.svix.com/blog/receive-webhooks-with-supabase-edge-functions/

[^12]: https://informistmedia.com/EquityWire/38513/NPCI-offshore-arm-Razorpay-Curlec-sign-pact-for-UPI-payments-in-Malaysia

[^13]: https://www.npmjs.com/package/@razmans/billplzbtn

[^14]: https://docs.dodopayments.com/pt-BR/developer-resources/webhooks/examples/supabase-example

[^15]: https://technode.global/2026/01/28/razorpay-curlec-teams-up-with-paypal-to-offer-cross-border-payment-solution-to-malaysian-smes/

