<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Write a full implementation plan to integrate with easyparcel marketplace api

Here is a complete, production-ready implementation plan for integrating with the EasyParcel Marketplace API, based directly on the official documentation.

***

## Overview \& Key Concepts

The EasyParcel Marketplace API is designed for **platforms with multiple sellers**, where each seller has their own EasyParcel account but all share one marketplace `authentication` key issued by EasyParcel. Every API call requires two credentials: the `authentication` token (from EasyParcel's IT team) and the individual seller's `api` key . The base URL follows the pattern `https://connect.easyparcel.my/?ac={action}`, and a sandbox/demo environment is available at `https://demo.connect.easyparcel.my/?ac={action}` .[^1]

***

## Phase 1: Prerequisites \& Setup

Before writing any code, complete these steps:

1. **Register as a Marketplace Partner** — Contact EasyParcel to obtain your `authentication` key (granted to the marketplace platform owner)
2. **Seller Onboarding** — Each seller must create an EasyParcel account and generate their own `api` key from the dashboard under *Integration → API Key → Marketplace API*[^2][^3]
3. **Store API Keys Securely** — Keep both the `authentication` and seller `api` keys in environment variables (`.env`) or a secrets manager, never hardcoded in source[^4]
4. **Choose Your Environment** — Use `https://demo.connect.easyparcel.my` for development and `https://connect.easyparcel.my` for production

***

## Phase 2: API Client Architecture

Build a reusable HTTP client wrapper before implementing individual features. All requests use `HTTP POST` with `application/x-www-form-urlencoded` encoding .

```python
import requests

EP_BASE_URL = "https://connect.easyparcel.my/?ac="  # or demo URL
AUTHENTICATION = "your_marketplace_auth_key"

def ep_post(action: str, seller_api: str, bulk: list, extra: dict = {}) -> dict:
    payload = {
        "authentication": AUTHENTICATION,
        "api": seller_api,
        "bulk": bulk,
        **extra
    }
    response = requests.post(EP_BASE_URL + action, data=flatten_bulk(payload))
    return response.json()
```

> **Note:** EasyParcel expects `bulk` as URL-encoded array notation (e.g., `bulk[^0][key]=value`). Use a helper to flatten nested arrays before posting.

***

## Phase 3: Core API Endpoints

Implement the following endpoints in order, as each step depends on the output of the previous.

### Step 1 — Rate Checking (`MPRateCheckingBulk`)

Before placing an order, fetch available courier rates for a shipment.

**Required inputs:** sender postcode + state + country, receiver postcode + state + country, parcel weight.

```python
def get_shipping_rates(seller_api, pick_code, pick_state, send_code, send_state, weight, date_coll=None):
    bulk = [{
        "pick_code": pick_code,
        "pick_state": pick_state,
        "pick_country": "MY",
        "send_code": send_code,
        "send_state": send_state,
        "send_country": "MY",
        "weight": weight,
        "date_coll": date_coll or datetime.today().strftime('%Y-%m-%d')
    }]
    return ep_post("MPRateCheckingBulk", seller_api, bulk)
```

**Key response fields to capture:** `rate_id`, `service_id`, `price`, `courier_name`, `delivery` (estimated days), `service_detail` (pickup/dropoff/both) .

***

### Step 2 — Market Rate Checking (`MPNormalRateCheckingBulk`)

Use this endpoint to display **public (non-member) vs. member pricing** on your marketplace UI . The response splits into `member_rate` and `non_member_rate` arrays, allowing you to show savings to buyers.

***

### Step 3 — Submit Order (`MPSubmitOrderBulk`)

Once the seller or buyer selects a courier, submit the shipment order using the `service_id` returned from rate checking .

```python
def submit_order(seller_api, order_data: dict):
    # order_data must include: weight, content, value, service_id,
    # full pick_* and send_* address fields, collect_date, sms, send_email
    return ep_post("MPSubmitOrderBulk", seller_api, [order_data])
```

**Response:** Returns `order_number` (e.g., `EI-AAY69`), `price`, and `courier` name . Store the `order_number` in your database — it's used for all subsequent actions.

***

### Step 4 — Pay for Order (`MPPayOrderBulk`)

Payment is deducted from the seller's EasyParcel credit balance . Call this immediately after order submission.

```python
def pay_order(seller_api, order_numbers: list):
    bulk = [{"order_no": no} for no in order_numbers]
    return ep_post("MPPayOrderBulk", seller_api, bulk)
```

**Response:** Returns `parcelno`, `awb` (Airway Bill Number), and `awb_id_link` (PDF label URL) . Handle the `"Insufficient Credit"` case gracefully and prompt the seller to top up.

***

### Step 5 — Check Order Status (`MPOrderStatusBulk`)

Poll this to determine if an order is `Waiting Payment`, `Paid`, `Cancel`, or `Partial Payment` .

```python
def check_order_status(seller_api, order_numbers: list):
    bulk = [{"order_no": no} for no in order_numbers]
    return ep_post("MPOrderStatusBulk", seller_api, bulk)
```


***

### Step 6 — Check Parcel Status (`MPParcelStatusBulk`)

After payment, use this to get the physical shipment status and AWB details . Possible `ship_status` values include: `Pending For Collection`, `Collected`, `Delivering (in transit)`, `Successfully Delivered`, `Returned`, `Cancelled`.

***

### Step 7 — Track Parcel (`MPTrackingBulk`)

Use the `awb` (Airway Bill Number) from payment response to get granular courier tracking events .

```python
def track_parcel(seller_api, awb_numbers: list):
    bulk = [{"awb_no": awb} for awb in awb_numbers]
    return ep_post("MPTrackingBulk", seller_api, bulk)
```

**Response fields:** `status_list` (array of events with `event_date`, `event_time`, `status`, `location`), `latest_status`, `ep_status_code` (1–5 representing schedule → delivered) .

***

### Step 8 — Check Credit Balance (`EPCheckCreditBalance`)

Proactively warn sellers when their balance is low. This call only needs the `api` key (no `authentication` or `bulk` array) .

```python
def check_balance(seller_api):
    response = requests.post(EP_BASE_URL + "EPCheckCreditBalance", data={"api": seller_api})
    return response.json()  # returns {"result": "150.00", "api_status": "Success"}
```


***

## Phase 4: Error Handling Strategy

All responses include a top-level `api_status`, `error_code`, and `error_remark` . Build a centralized error handler:


| `error_code` | Meaning | Recommended Action |
| :-- | :-- | :-- |
| `0` | Success | Proceed normally |
| `1` | Required authentication key | Check `authentication` config |
| `3` | Required API key | Verify seller's `api` key |
| `messagenow: "Insufficient Credit"` | Low balance | Notify seller to top up |
| `status: "Fail"` in result item | Per-parcel failure | Log `remarks` field and retry |


***

## Phase 5: End-to-End Workflow

The complete happy path for a seller booking a shipment:

```
[Checkout Triggered]
       ↓
MPRateCheckingBulk   →  Display courier options + prices to seller
       ↓
Seller selects courier (capture service_id)
       ↓
MPSubmitOrderBulk    →  Store order_number in DB
       ↓
EPCheckCreditBalance →  Verify sufficient funds
       ↓
MPPayOrderBulk       →  Store AWB + print label (awb_id_link)
       ↓
MPParcelStatusBulk   →  Poll status on dashboard
       ↓
MPTrackingBulk       →  Show buyer live tracking
```


***

## Phase 6: Production Checklist

- [ ] Switch base URL from `demo.connect.easyparcel.my` to `connect.easyparcel.my`
- [ ] Validate all Malaysian state codes against Appendix III in EasyParcel docs (e.g., `sgr`, `kul`, `png`, `jhr`)
- [ ] Implement retry logic with exponential backoff for `api_status: "Error"` responses
- [ ] Store `order_number`, `parcel_number`, and `awb` in your database for reconciliation
- [ ] Set up a cron job to poll `MPParcelStatusBulk` for active shipments and update buyer notifications
- [ ] Add a low-balance webhook or scheduled check via `EPCheckCreditBalance` to alert sellers when credit falls below a threshold
- [ ] Generate and serve AWB labels from `awb_id_link` directly to sellers — it returns a downloadable PDF
<span style="display:none">[^10][^11][^12][^13][^14][^15][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://developers.easyparcel.com/?pg=DocAPI\&c=Malaysia\&type=MarketPlace

[^2]: https://edu.newpages.com.my/article/126/how-to-integrate-easyparcel

[^3]: https://help.lelong.my/setup-easyparcel-integration/

[^4]: https://api.easyparcel.com

[^5]: https://developers.easyparcel.com

[^6]: https://github.com/apih/easyparcel

[^7]: https://docs.easyparcel.it

[^8]: https://guides.orderla.my/orderla-pro/easyparcel-integration

[^9]: https://api2cart.com/api-technology/marketplace-integration/

[^10]: https://exabytes.freshdesk.com/en/support/solutions/articles/14000121036-connecting-easyparcel-account

[^11]: https://sgeasyparcel.freshdesk.com/support/solutions/articles/17000116085-easyparcel-api-key

[^12]: https://packagist.org/packages/rusdyahmad/php-easyparcel

[^13]: https://support.sitegiant.com/knowledge-base/how-to-integrate-and-sync-order-with-easyparcel/

[^14]: https://shipway.in/easyparcel

[^15]: https://docs.easypost.com/docs/batches

