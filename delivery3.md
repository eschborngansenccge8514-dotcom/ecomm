<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# I got an error "Could not load delivery rates"

There are **5 common root causes** for this error. Work through them in order — most people hit \#1 or \#3.

***

## Step 1 — Read the Actual Error

The "Could not load delivery rates" message in the UI hides the real error. Get the real one two ways:

**Option A — Supabase Dashboard logs**[^1]

```
supabase.com/dashboard → Edge Functions → get-delivery-quotes → Logs
```

Look for any red 4xx/5xx entries and click to expand the message.

**Option B — Local serve (shows full stack trace)**[^2]

```bash
supabase functions serve get-delivery-quotes --env-file .env.local
```

Then in a second terminal:

```bash
curl -X POST http://localhost:54321/functions/v1/get-delivery-quotes \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "YOUR_MERCHANT_ID",
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

You'll see the full error in the terminal. Paste it back here if unclear.

***

## Step 2 — Fix by Root Cause

### Cause 1 — Secrets not set (most common)

The function silently breaks if any secret is missing. Verify:

```bash
supabase secrets list
```

You must see all five:

```
LALAMOVE_API_KEY        ✓
LALAMOVE_API_SECRET     ✓
EASYPARCEL_API_KEY      ✓
DELIVERY_ENV            ✓
LALAMOVE_MARKET         ✓
```

If any are missing, set them now:

```bash
supabase secrets set LALAMOVE_API_KEY=your_key_here
supabase secrets set LALAMOVE_API_SECRET=your_secret_here
supabase secrets set EASYPARCEL_API_KEY=your_key_here
supabase secrets set DELIVERY_ENV=sandbox
supabase secrets set LALAMOVE_MARKET=MY
```

Then **redeploy** — secrets changes require a redeploy:

```bash
supabase functions deploy get-delivery-quotes
```


***

### Cause 2 — Merchant missing address fields

The function crashes if `merchant.postcode`, `merchant.state`, or `merchant.city` is `null`. Check your merchants table:

```sql
-- Run in Supabase SQL Editor
SELECT id, store_name, address_line1, city, state, postcode, lat, lng
FROM merchants
WHERE id = 'YOUR_MERCHANT_ID';
```

If any core address fields are null, fill them in via Store Settings, then retest. `lat` and `lng` are optional — the function already falls back to KL coordinates.

***

### Cause 3 — `_shared` import path broken

The `get-delivery-quotes` function imports from `../_shared/lalamove-auth.ts`. Deno requires the shared folder to be **inside** `supabase/functions/`. Verify your folder structure looks exactly like this:

```
supabase/
  functions/
    _shared/
      lalamove-auth.ts       ← must be here
    get-delivery-quotes/
      index.ts
    lalamove-quote/
      index.ts
    ...
```

If `_shared` is outside the `functions/` folder, move it in and redeploy.[^3]

***

### Cause 4 — Function not deployed

Double-check it actually deployed:

```bash
supabase functions list
```

`get-delivery-quotes` must appear in the list. If it's missing:

```bash
supabase functions deploy get-delivery-quotes
```


***

### Cause 5 — EasyParcel crashes the whole function

Even if Lalamove works, an EasyParcel error can bubble up. The fix is to make the EasyParcel block fully isolated. Replace the try/catch block in `get-delivery-quotes/index.ts`:

```typescript
// ── EasyParcel rates — fully isolated, never crashes parent ────────────────────
let courierRates: any[] = []
try {
  const epKey     = Deno.env.get('EASYPARCEL_API_KEY')
  if (!epKey) throw new Error('EASYPARCEL_API_KEY not set')

  const isProd    = Deno.env.get('DELIVERY_ENV') === 'production'
  const epBaseUrl = isProd
    ? 'https://connect.easyparcel.my/?ac=EPRateCheckingBulk'
    : 'https://demo.connect.easyparcel.my/?ac=EPRateCheckingBulk'

  const epParams = new URLSearchParams({ api: epKey })
  epParams.append('bulk[^0][pick_code]',    merchant.postcode)
  epParams.append('bulk[^0][pick_state]',   stateCode(merchant.state ?? 'Selangor'))
  epParams.append('bulk[^0][pick_country]', 'MY')
  epParams.append('bulk[^0][send_code]',    deliveryAddress.postcode)
  epParams.append('bulk[^0][send_state]',   stateCode(deliveryAddress.state ?? 'Selangor'))
  epParams.append('bulk[^0][send_country]', 'MY')
  epParams.append('bulk[^0][weight]',       String(weightKg))
  epParams.append('bulk[^0][parcel_value]', String(parcelValue ?? 10))

  const controller = new AbortController()
  const timeout    = setTimeout(() => controller.abort(), 8000) // 8s timeout

  const epRes  = await fetch(epBaseUrl, { method: 'POST', body: epParams, signal: controller.signal })
  clearTimeout(timeout)
  const epData = await epRes.json()

  if (epData.api_status === 'Success') {
    courierRates = (epData.result?.[^0]?.rates ?? [])
      .slice(0, 5)
      .map((r: any) => ({
        type:          'courier',
        provider:      'easyparcel',
        serviceId:     r.service_id,
        rateId:        r.rate_id,
        courierName:   r.courier_name,
        courierLogo:   r.courier_logo,
        serviceName:   r.service_name,
        serviceDetail: r.service_detail,
        priceRM:       Number(r.price),
        delivery:      r.delivery,
        weightKg,
      }))
  } else {
    // Log but don't throw — Lalamove results still return fine
    console.warn('EasyParcel returned non-success:', epData.error_remark)
  }
} catch (epErr) {
  console.warn('EasyParcel rate check failed (non-fatal):', epErr.message)
}
```

Then redeploy:

```bash
supabase functions deploy get-delivery-quotes
```


***

## Quick Diagnostic Flowchart

```
"Could not load delivery rates"
         │
         ▼
  Check Supabase Logs ──── 401 Unauthorized ──► Cause 1: Wrong API keys
         │
         ├── 500 / "merchant not found" ──────► Cause 2: merchantId not passed correctly
         │
         ├── 500 / "Cannot resolve module" ──► Cause 3: _shared folder path wrong
         │
         ├── Function not in list ────────────► Cause 4: Not deployed
         │
         └── 500 / EasyParcel error ──────────► Cause 5: Apply isolated try/catch above
```

Once you've checked the logs, share the exact error message here and we can fix it precisely.
<span style="display:none">[^10][^11][^12][^13][^14][^15][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://www.buildcamp.io/guides/debugging-supabase-edge-functions

[^2]: https://zone-www-dot-odjxwgdhx-supabase.vercel.app/docs/guides/functions/debugging

[^3]: https://www.jameshw.dev/journal/2023-01-10/import-local-files

[^4]: https://github.com/dyad-sh/dyad/issues/1658

[^5]: https://supabase.com/docs/guides/functions/logging

[^6]: https://supabase.com/docs/guides/functions/troubleshooting

[^7]: https://github.com/orgs/supabase/discussions/36683

[^8]: https://stackoverflow.com/questions/78979217/how-to-import-my-supabase-db-types-in-edge-functions-deno

[^9]: https://docs.nbase.io/docs/guides/functions/debugging

[^10]: https://github.com/supabase/supabase/issues/35601

[^11]: https://github.com/supabase/supabase/issues/33834

[^12]: https://supabase.com/docs/guides/troubleshooting/unable-to-deploy-edge-function

[^13]: https://www.reddit.com/r/Supabase/comments/1jwhxwc/edge_function_logs_taking_20_minutes_to_show_up/

[^14]: https://supabase.com/docs/guides/troubleshooting/unable-to-call-edge-function

[^15]: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/functions/logging.mdx

