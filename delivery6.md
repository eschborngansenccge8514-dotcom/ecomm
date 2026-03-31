<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# I don't see any error in console. Only the UI showing: Could not load delivery rates

Edge function returned a non 2xx status code

This is from supabase:
POST | 400 | [https://dgafjyrittkskxlgswvf.supabase.co/functions/v1/get-delivery-quotes](https://dgafjyrittkskxlgswvf.supabase.co/functions/v1/get-delivery-quotes)
metadata
[
{
"deployment_id": "dgafjyrittkskxlgswvf_139bf0f2-87aa-41fd-a52f-5d29994df627_4",
"execution_id": "654f42c3-a4f1-4cbf-9065-7d8b251105b4",
"execution_time_ms": 168,
"function_id": "139bf0f2-87aa-41fd-a52f-5d29994df627",
"project_ref": "dgafjyrittkskxlgswvf",
"request": [
{
"headers": [
{
"accept": "*/*",
"accept_encoding": "gzip, br",
"connection": "Keep-Alive",
"content_length": "200",
"cookie": null,
"host": "dgafjyrittkskxlgswvf.supabase.co",
"user_agent": "Expo/1017756 CFNetwork/3860.500.83 Darwin/25.4.0",
"x_client_info": "supabase-js-react-native/2.100.1"
}
],
"host": "dgafjyrittkskxlgswvf.supabase.co",
"method": "POST",
"pathname": "/functions/v1/get-delivery-quotes",
"port": null,
"protocol": "https:",
"sb": [
{
"apikey": [],
"auth_user": "6e000e98-113c-4a9e-8e3c-1e8d2b0e0618",
"jwt": [
{
"apikey": [
{
"invalid": null,
"payload": [
{
"algorithm": "HS256",
"expires_at": 2090257108,
"issuer": "supabase",
"key_id": null,
"role": "anon",
"session_id": null,
"signature_prefix": "BUUn6j",
"subject": null
}
]
}
],
"authorization": [
{
"invalid": null,
"payload": [
{
"algorithm": "ES256",
"expires_at": 1774705439,
"issuer": "https://dgafjyrittkskxlgswvf.supabase.co/auth/v1",
"key_id": "3c351066-ac25-4dc1-b46e-478aa59ee291",
"role": "authenticated",
"session_id": "ba90ca0f-dcf8-4435-9810-95ff03508160",
"signature_prefix": "a14cH6",
"subject": "6e000e98-113c-4a9e-8e3c-1e8d2b0e0618"
}
]
}
]
}
]
}
],
"search": null,
"url": "https://dgafjyrittkskxlgswvf.supabase.co/functions/v1/get-delivery-quotes"
}
],
"response": [
{
"headers": [
{
"content_length": "79",
"content_type": "application/json",
"date": "Sat, 28 Mar 2026 12:47:43 GMT",
"sb_request_id": null,
"server": "cloudflare",
"vary": "Accept-Encoding",
"x_envoy_upstream_service_time": null,
"x_sb_compute_multiplier": null,
"x_sb_edge_region": "ap-southeast-1",
"x_sb_resource_multiplier": null,
"x_served_by": "supabase-edge-runtime"
}
],
"status_code": 400
}
],
"version": "4"
}
]

The problem is `supabase.functions.invoke` — it swallows the response body when it gets a non-2xx, so you only ever see "Edge function returned a non 2xx status code" instead of the real message. Two things to fix right now.

***

## Step 1 — See the actual 79-byte error body immediately

Run this curl to read the real error text directly:

```bash
curl -s -X POST https://dgafjyrittkskxlgswvf.supabase.co/functions/v1/get-delivery-quotes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -d '{
    "merchantId": "PASTE_YOUR_MERCHANT_ID_HERE",
    "deliveryAddress": {
      "line1": "123 Jalan Test",
      "city": "Kuala Lumpur",
      "state": "W.P. Kuala Lumpur",
      "postcode": "50000"
    },
    "totalWeightKg": 0.5,
    "parcelValue": 25
  }'
```

Paste the response here if still unclear. Your anon key is in `supabase/config.ts` or `.env`.

***

## Step 2 — Fix the Edge Function to always return 200

The root cause of the silent error is returning `status: 400`. The Supabase JS SDK treats any non-2xx as a thrown exception and discards the body. Change the last line of the catch block to always return `200`:

```typescript
// In supabase/functions/get-delivery-quotes/index.ts
// Replace the bottom catch block:

  } catch (err: any) {
    console.error('get-delivery-quotes error:', err.message)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
      //        ^^^
      // Always 200 — let the client check data.error instead
    )
  }
```

Do this for every Edge Function. Redeploy:

```bash
supabase functions deploy get-delivery-quotes
```


***

## Step 3 — Fix the client to read `data.error`

Now that the function always returns 200, `fnError` will always be `null` and `data.error` will carry the real message. Update `fetchQuotes` in `DeliveryMethodPicker.tsx`:

```typescript
const fetchQuotes = async () => {
  setIsLoading(true)
  setError(null)
  try {
    const { data, error: fnError } = await supabase.functions.invoke('get-delivery-quotes', {
      body: {
        merchantId,
        deliveryAddress: {
          line1:    selectedAddress!.address_line1,
          line2:    selectedAddress!.address_line2 ?? '',
          city:     selectedAddress!.city,
          state:    selectedAddress!.state,
          postcode: selectedAddress!.postcode,
        },
        totalWeightKg,
        parcelValue: cartSubtotal,
      },
    })

    if (fnError)     throw new Error(`Network error: ${fnError.message}`)
    if (data?.error) throw new Error(data.error)   // ← now surfaces the real message

    setInstant(data.instant    ?? [])
    setCourier(data.courier    ?? [])
    setSelfPickup(data.selfPickup ?? null)
    setQuotesLoaded(true)

    if (data.instant?.[0] && !selected) onSelect(data.instant[0])
  } catch (err: any) {
    setError(err.message)   // real message now shows in UI
  }
  setIsLoading(false)
}
```


***

## Step 4 — Add a console log to see what's actually being sent

Add this one line right before the `invoke` call so you can see exactly what the app is sending:

```typescript
console.log('📤 Delivery quotes payload:', {
  merchantId,
  address: selectedAddress,
  totalWeightKg,
  cartSubtotal,
})
```

The most common cause at 168ms execution time is that `merchantId` is `undefined` or `null` because the cart store hasn't populated it yet. Check that log — if `merchantId` shows as `undefined`, the fix is in `checkout.tsx`:

```typescript
// Add a guard before rendering DeliveryMethodPicker:
{merchantId ? (
  <DeliveryMethodPicker
    merchantId={merchantId}
    ...
  />
) : (
  <Text className="text-gray-400 text-sm">Loading store info...</Text>
)}
```

After the redeploy, the UI error message will show the exact problem text from the server instead of the generic "Edge function returned a non 2xx status code".

