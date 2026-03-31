<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# POST | 400 | [https://dgafjyrittkskxlgswvf.supabase.co/functions/v1/get-delivery-quotes](https://dgafjyrittkskxlgswvf.supabase.co/functions/v1/get-delivery-quotes)

metadata
[
{
"deployment_id": "dgafjyrittkskxlgswvf_139bf0f2-87aa-41fd-a52f-5d29994df627_4",
"execution_id": "9d4ddbaa-3fae-4868-9437-97d5f8ea58da",
"execution_time_ms": 712,
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
"expires_at": 1774701938,
"issuer": "https://dgafjyrittkskxlgswvf.supabase.co/auth/v1",
"key_id": "3c351066-ac25-4dc1-b46e-478aa59ee291",
"role": "authenticated",
"session_id": "ba90ca0f-dcf8-4435-9810-95ff03508160",
"signature_prefix": "O369U2",
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
"date": "Sat, 28 Mar 2026 12:43:17 GMT",
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

Good progress — the function **is now running** (`execution_id` is no longer null). The 400 comes from our own `catch` block. The 712ms execution time means the DB query ran, which tells us it's a **data validation error**, not a code crash.

We need to see the actual error body. Two ways:

***

## Step 1 — See the exact error message

**Option A — Log it in the app.** Update `DeliveryMethodPicker.tsx` temporarily:

```typescript
// In fetchQuotes(), replace the catch block:
} catch (err: any) {
  console.log('🔴 Delivery quotes error:', JSON.stringify(err))
  // Also log the raw function response
  setError(err.message)
}

// And after the invoke call, add:
console.log('📦 Delivery quotes response:', JSON.stringify(data), JSON.stringify(fnError))
```

**Option B — curl it directly** (fastest):

```bash
curl -X POST https://dgafjyrittkskxlgswvf.supabase.co/functions/v1/get-delivery-quotes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "merchantId": "YOUR_MERCHANT_ID_HERE",
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

The response body will have `{"error": "...exact message..."}`.

***

## Step 2 — Most likely cause at 712ms

The DB query ran and returned, which means it almost certainly hit one of these two checks. Run this in your Supabase SQL Editor right now:

```sql
SELECT
  id,
  store_name,
  address_line1,
  city,
  state,
  postcode,
  lat,
  lng,
  status
FROM merchants
WHERE id = '6e000e98-113c-4a9e-8e3c-1e8d2b0e0618'  -- your user's merchant
   OR user_id = '6e000e98-113c-4a9e-8e3c-1e8d2b0e0618';
```

You're looking for any `null` in `postcode`, `state`, or `city`. If any are null, that's your error — the guard in the function throws:

```
"Merchant has no postcode set. Update Store Settings first."
```

**Fix:** Go to the merchant Store Settings screen in the app → fill in the full address → Save. Then retest.

***

## Step 3 — Make the error visible in the UI permanently

The current picker just shows a generic string. Replace the error state display in `DeliveryMethodPicker.tsx` so the real server message always shows:

```typescript
// Replace the error block in DeliveryMethodPicker:
if (error) {
  return (
    <View className="bg-red-50 rounded-xl p-4 gap-2">
      <View className="flex-row items-center gap-2">
        <Ionicons name="warning-outline" size={16} color="#ef4444" />
        <Text className="text-red-600 font-semibold text-sm">Could not load delivery rates</Text>
      </View>
      {/* Show the actual server error message */}
      <Text className="text-red-500 text-xs leading-relaxed">{error}</Text>
      <TouchableOpacity
        onPress={() => fetchQuotes()}  // re-fetch same address
        className="flex-row items-center gap-2 mt-1"
      >
        <Ionicons name="refresh-outline" size={14} color="#2563eb" />
        <Text className="text-primary-600 text-sm font-medium">Try again</Text>
      </TouchableOpacity>
    </View>
  )
}
```

And update `fetchQuotes` to capture the server error body properly:

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

    // fnError catches network/deploy errors; data.error catches logic errors
    if (fnError)    throw new Error(fnError.message)
    if (data?.error) throw new Error(data.error)   // ← this surfaces the real 400 message

    setInstant(data.instant  ?? [])
    setCourier(data.courier  ?? [])
    setSelfPickup(data.selfPickup ?? null)
    setQuotesLoaded(true)

    if (data.instant?.[0] && !selected) onSelect(data.instant[0])
  } catch (err: any) {
    setError(err.message)    // now shows the real server message in the UI
  }
  setIsLoading(false)
}
```

Once you add `if (data?.error) throw new Error(data.error)`, the exact error from the Edge Function (`"Merchant has no postcode set"` / `"deliveryAddress.state is required"` / etc.) will appear directly on screen — no more hunting through logs.

