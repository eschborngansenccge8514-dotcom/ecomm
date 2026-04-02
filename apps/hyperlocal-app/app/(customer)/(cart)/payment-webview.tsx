import {
  View, Text, TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { useLocalSearchParams, router } from 'expo-router'
import { useState, useCallback, useEffect, useRef } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { paymentService } from '@/services/payment.service'
import { useAuthStore } from '@/stores/authStore'
import Toast from 'react-native-toast-message'
import { useQueryClient } from '@tanstack/react-query'

// ─── Razorpay HTML ──────────────────────────────────────────────────────────────
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
    key:          opts.razorpayKeyId,
    amount:       opts.amount,
    currency:     opts.currency,
    order_id:     opts.razorpayOrderId,
    name:         'Hyperlocal',
    description:  `Order ${opts.orderNumber}`,
    theme:        { color: '#2563eb' },
    prefill: {
      name:    opts.customerName,
      contact: opts.customerPhone,
    },
    callback_url: 'https://dgafjyrittkskxlgswvf.supabase.co/functions/v1/razorpay-redirect',
    redirect:     true,
  })

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:-apple-system,sans-serif}
    .c{text-align:center}
    p{color:#64748b;font-size:14px;margin-top:12px}
    .s{width:40px;height:40px;border:3px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto}
    @keyframes spin{to{transform:rotate(360deg)}}
  </style>
</head>
<body>
  <div class="c"><div class="s"></div><p>Opening payment...</p></div>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    var options = ${config};
    var rzp = new Razorpay(options);
    rzp.on('payment.failed', function(resp) {
      window.location.href = 'hyperlocal://payment-return?failed=true&desc=' 
        + encodeURIComponent(resp.error.description || 'Payment failed');
    });
    setTimeout(function() { rzp.open(); }, 500);
  </script>
</body>
</html>`
}

// ─── Screen ────────────────────────────────────────────────────────────────────
export default function PaymentWebViewScreen() {
  const { orderId, paymentMethod } = useLocalSearchParams<{
    orderId:       string
    paymentMethod: 'razorpay' | 'billplz'
  }>()
  const insets      = useSafeAreaInsets()
  const { profile } = useAuthStore()

  const [stage, setStage]           = useState<'loading' | 'ready' | 'verifying' | 'error'>('loading')
  const [gatewayHtml, setGatewayHtml] = useState<string | null>(null)
  const [billUrl, setBillUrl]       = useState<string | null>(null)
  const [errorMsg, setErrorMsg]     = useState<string | null>(null)
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null)
  
  const handledRef = useRef(false)
  const queryClient = useQueryClient()

  // ─── Load Gateway ────────────────────────────────────────────────────────────
  const loadGateway = useCallback(async () => {
    setStage('loading')
    setErrorMsg(null)
    try {
      if (paymentMethod === 'razorpay') {
        const data = await paymentService.createRazorpayOrder(orderId)
        setGatewayHtml(buildRazorpayHTML({
          razorpayKeyId:   data.razorpayKeyId,
          razorpayOrderId: data.razorpayOrderId,
          amount:          data.amount,
          currency:        data.currency,
          orderNumber:     data.orderNumber,
          customerName:    profile?.full_name ?? 'Customer',
          customerPhone:   profile?.phone ?? '',
        }))
      } else {
        const data = await paymentService.createBillplzBill(orderId)
        setBillUrl(data.billUrl)
      }
      setStage('ready')
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Could not connect to payment gateway')
      setStage('error')
    }
  }, [orderId, paymentMethod, profile])

  useEffect(() => { loadGateway() }, [loadGateway])

  // ─── Stable Navigation Trigger ──────────────────────────────────────────────
  useEffect(() => {
    if (!successOrderId) return

    const timer = setTimeout(() => {
      console.log('[PaymentWebView] Executing deferred navigation to order:', successOrderId)
      
      try {
        // Clear cached order data so the details screen fetches the latest 'paid' status
        queryClient.invalidateQueries({ queryKey: ['order', successOrderId] })
        queryClient.invalidateQueries({ queryKey: ['orders'] })

        if (router.canDismiss()) {
          router.dismiss()
        }
        
        setTimeout(() => {
          router.navigate(`/(customer)/(orders)/${successOrderId}`)
        }, 300)
      } catch (err) {
        console.error('[PaymentWebView] Deferred navigation failed:', err)
        router.replace('/(customer)/(orders)')
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [successOrderId, queryClient])

  // ─── URL Handler ─────────────────────────────────────────────────────────────
  const handleUrl = useCallback((url: string) => {
    console.log('[PaymentWebView] Intercepted URL:', url)
    if (!url.includes('hyperlocal://payment-return')) return
    
    if (handledRef.current) return
    handledRef.current = true

    // Set stage to 'verifying' immediately to unmount WebView
    setStage('verifying')
    setGatewayHtml(null)
    setBillUrl(null)

    // Parse params manually
    const raw    = decodeURIComponent(url)
    const qs     = raw.split('?')[1] ?? ''
    const params = Object.fromEntries(
      qs.split('&').filter(Boolean).map(p => {
        const idx = p.indexOf('=')
        if (idx === -1) return [p, '']
        return [p.slice(0, idx), p.slice(idx + 1)]
      })
    )
    console.log('[PaymentWebView] Processing return params:', params)

    if (params['verified'] === 'true') {
      const confirmedId = params['orderId'] || orderId
      Toast.show({ type: 'success', text1: 'Payment verified! 🎉' })
      setSuccessOrderId(confirmedId)
    } else if (params['failed'] === 'true' || params['error']) {
      const msg = params['error'] || params['desc'] || 'Payment failed'
      Toast.show({ type: 'error', text1: 'Payment error', text2: msg })
      setStage('error')
      setErrorMsg(msg)
    } else {
      setSuccessOrderId(orderId)
    }
  }, [orderId])

  // ─── Rendering ───────────────────────────────────────────────────────────────
  if (stage === 'loading') {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor:'#fff', padding:32 }}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop:16, fontWeight:'600', fontSize:16, color:'#111' }}>
          Connecting to {paymentMethod}...
        </Text>
      </View>
    )
  }

  if (stage === 'verifying') {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor:'#fff', padding:32 }}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={{ marginTop:16, fontWeight:'700', fontSize:20, color:'#111' }}>Confirming Order</Text>
        <Text style={{ marginTop:8, color:'#6b7280', fontSize:14, textAlign:'center', marginBottom: 32 }}>
          Do not close the app. We are finalizing your order.
        </Text>
        <TouchableOpacity
          onPress={() => {
            router.dismiss()
            setTimeout(() => router.navigate(`/(customer)/(orders)/${orderId}`), 100)
          }}
          style={{ backgroundColor: '#f3f4f6', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 }}
        >
          <Text style={{ color: '#4b5563', fontWeight: '600' }}>Taking too long? Click to return</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (stage === 'error') {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor:'#fff', padding:32 }}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={{ marginTop:16, fontWeight:'700', fontSize:20, color:'#111' }}>Payment Failed</Text>
        <Text style={{ marginTop:8, color:'#6b7280', fontSize:14, textAlign:'center' }}>{errorMsg}</Text>
        <TouchableOpacity
          onPress={loadGateway}
          style={{ marginTop:32, backgroundColor:'#2563eb', borderRadius:16, paddingVertical:16, paddingHorizontal:48 }}
        >
          <Text style={{ color:'#fff', fontWeight:'700', fontSize:16 }}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.replace(`/(customer)/(orders)/${orderId}`)}
          style={{ marginTop:20 }}
        >
          <Text style={{ color:'#9ca3af', fontSize:14 }}>Back to order details</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // stage === 'ready'
  const source = paymentMethod === 'razorpay'
    ? { html: gatewayHtml!, baseUrl: 'https://checkout.razorpay.com' }
    : { uri: billUrl! }

  return (
    <View style={{ flex:1, backgroundColor:'#fff', paddingTop: insets.top }}>
      <View style={{ paddingHorizontal:20, paddingVertical:12, flexDirection:'row', alignItems:'center', borderBottomWidth:1, borderBottomColor:'#f3f4f6' }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close-outline" size={32} color="#111827" />
        </TouchableOpacity>
        <Text style={{ flex:1, textAlign:'center', fontWeight:'700', fontSize:18, marginRight:32, textTransform:'capitalize' }}>
          {paymentMethod} Checkout
        </Text>
      </View>

      <WebView
        key={paymentMethod}
        source={source}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        mixedContentMode="always"
        userAgent="Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36"
        onShouldStartLoadWithRequest={(req) => {
          if (req.url.startsWith('hyperlocal://')) {
            handleUrl(req.url)
            return false
          }
          return true
        }}
        onNavigationStateChange={(nav) => {
          if (nav.url?.startsWith('hyperlocal://')) {
            handleUrl(nav.url)
          }
        }}
        style={{ flex: 1 }}
      />
    </View>
  )
}
