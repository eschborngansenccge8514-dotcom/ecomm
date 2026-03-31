<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Write a full implementation plan to improve edge case handling for Easyparcel API.

Here is the full implementation plan based directly on the EasyParcel API documentation endpoints and response codes.[^1]

***

## Overview of the Flow to Protect

Every EasyParcel transaction follows this pipeline — each step has specific failure points you need to handle:[^1]

```
Rate Check → Make Order → Pay Order → Get AWB → Track Parcel
     ↓              ↓           ↓           ↓           ↓
  No rates    Order fail   Insufficient  AWB null   Stuck status
  available   returned      Credit
```


***

## Phase 1 — Rate Checking (`EPRateCheckingBulk`)

**Edge Cases to Handle:**

- **Empty `rates[]` array** — Returned when no courier serves the sender/receiver postcode combination. This happens with certain rural postcodes in Malaysia.[^1]

```js
if (!result.rates || result.rates.length === 0) {
  // Show: "No courier available for this delivery route"
  // Fallback: Prompt customer to use self-arrange pickup
}
```

- **`status: "Fail"` inside result** — Even if `api_status` is `"Success"`, the inner result can fail individually per bulk item. Always check `result[n].status`, not just the top-level `api_status`.[^1]
- **`error_code: 3` — Missing API key** — Return a 500 to the user and alert your admin via Slack/email immediately. This is a configuration error, not a user error.[^1]
- **Same-day pickup cutoff** — The API notes *"same day pickup only available before 12pm"*. If an order is placed after noon, your system must automatically set `date_coll` to the next working day, not today's date.[^1]

***

## Phase 2 — Making Order (`EPSubmitOrderBulk`)

**Edge Cases to Handle:**

- **`status: "Fail"` in result with `remarks`** — The `remarks` field contains the specific reason. Log it per order and surface it to the admin.[^1]

Common `remarks` to handle:


| Remarks Value | Meaning | Action |
| :-- | :-- | :-- |
| `"Invalid service_id"` | Rate expired or courier no longer available | Re-run rate check and re-submit |
| `"Invalid postcode"` | Sender or receiver postcode format wrong | Validate postcode before submission |
| `"Required api key"` | Missing/expired API key | Alert admin, block checkout |
| `"Weight exceeded"` | Parcel too heavy for selected courier | Show alternative couriers only |

- **`parcel_number` not returned** — If the result returns no `parcel_number` or `order_number`, treat the order as failed and do not proceed to payment.[^1]
- **Bulk order partial failure** — When submitting multiple orders in one bulk call, some may succeed and some fail individually. Parse each item in the result array separately and handle failures per item, not the whole batch.[^1]

***

## Phase 3 — Order Payment (`EPPayOrderBulk`)

This is the **most critical edge case** in EasyParcel — the API returns `api_status: "Success"` and `error_code: 0` even when payment fails. You must check `messagenow` inside the result.[^1]

**All possible `messagenow` values and how to handle them:**


| `messagenow` Value | Meaning | Action |
| :-- | :-- | :-- |
| `"Fully Paid"` | ✅ Payment successful | Proceed to retrieve AWB |
| `"Insufficient Credit"` | ❌ EasyParcel wallet is empty | Alert admin to top up, hold order |
| `"Partial Payment"` | ⚠️ Only some parcels in the order were paid | Check each parcel individually |
| `"Waiting Payment"` | Order unpaid | Retry payment or flag for manual action |
| `"Cancel"` | Order was cancelled before payment | Re-create order from scratch |

- **`parcel[]` is empty `{}`** — When payment fails with `"Insufficient Credit"`, the `parcel` array returns empty objects with no `awb`. Never generate a shipment label from an empty parcel response.[^1]

**Recommended Supabase Edge Function logic:**

```js
const messagenow = result[^0].messagenow

if (messagenow !== "Fully Paid") {
  if (messagenow === "Insufficient Credit") {
    await notifyAdmin("EasyParcel credit insufficient — top up required")
    await updateOrderStatus(orderId, "payment_failed")
    return new Response(JSON.stringify({
      error: "Shipping payment failed. Our team has been alerted."
    }), { status: 402 })
  }
  // Handle other statuses...
}
```


***

## Phase 4 — AWB \& Label Retrieval

**Edge Cases to Handle:**

- **`awb` is null or empty string** — Only returned after successful payment. If `awb` is empty, do not generate or show a label link. Hold the order and alert admin.[^1]
- **`awb_id_link` PDF unavailable** — The link may return a 404 if EasyParcel hasn't generated it yet. Implement a retry with a 5-second delay before surfacing the label to the vendor.[^1]
- **Store AWB in your DB immediately** — Save `parcel_number`, `order_number`, and `awb` to your orders table the moment payment succeeds, so you can track even if downstream calls fail.[^1]

***

## Phase 5 — Parcel Status (`EPParcelStatusBulk`)

EasyParcel returns a rich set of `ship_status` values. Your dashboard must handle each one distinctly:[^1]


| `ship_status` | Customer-Facing Message | Admin Action |
| :-- | :-- | :-- |
| `"Waiting Payment"` | — | Retry payment immediately |
| `"Pending For Collection"` | "Parcel awaiting pickup by courier" | None |
| `"Collected"` | "Parcel collected by courier" | None |
| `"Delivering (in transit)"` | "Your parcel is on the way" | None |
| `"Successfully Delivered"` | "Parcel delivered ✅" | Trigger order completion |
| `"Returned"` | "Parcel returned to sender" | Notify vendor + customer, initiate refund flow |
| `"On Hold"` | "Parcel held by courier" | Alert admin to contact courier |
| `"Expired (Unpaid)"` | — | Re-create and re-pay order |
| `"Cancel By Admin"` | "Shipment cancelled" | Refund customer, notify vendor |
| `"Other Status"` | "Delivery update available" | Log and monitor manually |


***

## Phase 6 — Parcel Tracking (`EPTrackingBulk`)

**Edge Cases to Handle:**

- **`ep_status_code` reference** — Use the numeric code (not text) for programmatic logic to avoid breaking on typos (EasyParcel's own docs show `"Deliverd"` misspelled in sample data). Always map by `ep_status_code`:[^1]
    - `1` = Schedule In Arrangement
    - `2` = To Be Collected
    - `3` = Collected
    - `4` = Delivery In Transit / On Hold
    - `5` = Delivered / Returned
- **`latest_update` is stale** — If the date hasn't changed in 5+ days and `ep_status_code` is still `4`, flag as a delayed shipment and notify both customer and admin.[^1]

***

## Phase 7 — Credit Balance (`EPCheckCreditBalance`)

This is often overlooked but critical for preventing checkout failures.[^1]

- **Pre-checkout balance check** — Before placing any EasyParcel order, call `EPCheckCreditBalance` and compare against the shipment price returned from rate checking.
- **Low balance alert threshold** — Set an alert (e.g., when balance drops below RM 50) that notifies your admin via email/Slack before the wallet runs dry.
- **Daily balance health check** — Run a Supabase `pg_cron` job every morning to check balance and alert if below threshold:

```sql
-- Run daily at 8am Malaysia time (UTC+8 = 00:00 UTC)
select cron.schedule(
  'easyparcel-balance-check',
  '0 0 * * *',
  $$ select net.http_post(
    url := 'https://<your-project>.supabase.co/functions/v1/check-ep-balance',
    headers := '{"Authorization": "Bearer <service_role_key>"}'
  ) $$
);
```


***

## Phase 8 — Global API Error Handling

Wrap every EasyParcel API call with this standardized error handler:[^1]

```js
async function callEasyParcel(action, params) {
  const MAX_RETRIES = 3
  let attempt = 0

  while (attempt < MAX_RETRIES) {
    try {
      const response = await fetch(`https://connect.easyparcel.my/?ac=${action}`, {
        method: 'POST',
        body: new URLSearchParams(params)
      })
      const data = await response.json()

      // EasyParcel-level error (invalid key, validation fail)
      if (data.api_status === "Error") {
        if (data.error_code === 3) throw new Error("Invalid API Key")
        throw new Error(data.error_remark)
      }

      return data

    } catch (err) {
      attempt++
      if (attempt >= MAX_RETRIES) {
        await logToDatabase({ action, error: err.message, timestamp: new Date() })
        await notifyAdmin(`EasyParcel ${action} failed after ${MAX_RETRIES} retries`)
        throw err
      }
      await sleep(2 ** attempt * 1000) // Exponential backoff: 2s, 4s, 8s
    }
  }
}
```


***

## Recommended Admin Dashboard Panel — "Shipping Exceptions"

Build a dedicated section in your admin dashboard that surfaces all EasyParcel issues in real time:[^1]

- 🔴 **Orders with `"Insufficient Credit"`** payment failures
- 🟡 **Orders with `"Waiting Payment"` or `"Expired (Unpaid)"` status**
- 🟠 **Parcels with `"On Hold"` or `"Returned"` ship status**
- ⚫ **Parcels with no AWB after 30 minutes of payment**
- 📉 **Low EasyParcel credit balance warning**
- 📋 **Full API error log with retry count per order**
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^2][^3][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://plausible.io/blog/shopify-analytics

[^2]: https://developers.easyparcel.com

[^3]: https://developers.easyparcel.com/?pg=DocAPI\&c=Malaysia\&type=MarketPlace

[^4]: https://developers.easyparcel.com/?ac=DocAPI\&file=Malaysia_Individual_1.4.0.0

[^5]: https://developers.easyparcel.com/?ac=DocAPI\&file=Malaysia_Individual_1.3.0.0

[^6]: https://documenter.getpostman.com/view/10519343/TVRpz4zC

[^7]: https://gist.github.com/mazudi/b9887feb8d29e9e68ded17b61a411cf8

[^8]: https://api.easyparcel.com

[^9]: https://developers.easyparcel.com/?pg=Demo\&c=Malaysia

[^10]: https://developer.myparcel.nl/api-reference/02.responses.html

[^11]: https://developers.easyparcel.com/?pg=DocAPI\&c=Thailand\&type=MarketPlace

[^12]: https://github.com/apih/easyparcel

[^13]: https://myparcelnl.github.io/api/

[^14]: https://developers.easyparcel.com/?ac=DocAPI\&file=Malaysia_MarketPlace_1.0.0.0

[^15]: https://guides.orderla.my/orderla-pro/easyparcel-integration

[^16]: https://packagist.org/packages/rusdyahmad/php-easyparcel

