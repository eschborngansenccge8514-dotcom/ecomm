<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Generate a complete, exhaustive implementation plan for these features. Every feature must be broken down to its smallest unit of work.

Here is the complete, exhaustive implementation plan broken down to the smallest unit of work. Every task is independently actionable.[^1]

***

## Implementation Plan: Lalamove Edge Case Handling


***

## EPIC 1 — Database \& Schema

### 1.1 — `delivery_exceptions` table

- [ ] Add column `driver_assigned_at timestamptz` to `orders`
- [ ] Add column `last_driver_lat double precision` to `orders`
- [ ] Add column `last_driver_lng double precision` to `orders`
- [ ] Add column `last_driver_update_at timestamptz` to `orders`
- [ ] Add column `lalamove_cancel_reason text` to `orders`
- [ ] Add column `lalamove_retry_count int DEFAULT 0` to `orders`
- [ ] Add column `priority_fee_added numeric DEFAULT 0` to `orders`
- [ ] Add column `exception_flag text` to `orders` — values: `null | 'driver_not_found' | 'driver_unresponsive' | 'api_failure' | 'quote_expired'`
- [ ] Add column `exception_flagged_at timestamptz` to `orders`
- [ ] Create `delivery_exception_logs` table with columns: `id, order_id, type, message, raw_payload, resolved, resolved_at, created_at`
- [ ] Enable RLS on `delivery_exception_logs`
- [ ] Create policy: service_role only writes, merchants read their own
- [ ] Create index on `orders(exception_flag)` where `exception_flag IS NOT NULL`
- [ ] Create index on `orders(status, merchant_id)` for poller queries


### 1.2 — `lalamove_api_log` table

- [ ] Create table: `id, order_id, endpoint, method, request_body jsonb, response_body jsonb, status_code int, attempt int, created_at`
- [ ] Enable RLS — service_role only
- [ ] Create index on `lalamove_api_log(order_id)`


### 1.3 — Webhook idempotency table

- [ ] Create table `webhook_events`: `id, provider, event_id text UNIQUE, order_id, processed_at`
- [ ] Enable RLS — service_role only
- [ ] Create unique index on `(provider, event_id)`

***

## EPIC 2 — Edge Functions

### 2.1 — `lalamove-webhook/index.ts` (already exists — harden it)

- [ ] Extract `eventId` from webhook payload header or body
- [ ] Check `webhook_events` table for duplicate `event_id` before processing
- [ ] If duplicate found, return `200` immediately (idempotency)[^1]
- [ ] Insert `webhook_events` row at start of processing
- [ ] Return HTTP `200` within 200ms — move all heavy logic to async after response[^1]
- [ ] Map `ASSIGNING_DRIVER` → set `driver_assigned_at = now()` on order
- [ ] Map `ON_GOING` → set `driver_assigned_at` if not already set
- [ ] Map `PICKED_UP` → update order status to `out_for_delivery`
- [ ] Map `COMPLETED` → update order status to `delivered`, call `award-loyalty-points`
- [ ] Map `REJECTED` → set `exception_flag = 'driver_not_found'`, set `exception_flagged_at = now()`
- [ ] Map `CANCELLED` → revert order status to `confirmed`, clear `lalamove_order_id`
- [ ] Map `EXPIRED` → set `exception_flag = 'driver_not_found'`
- [ ] On driver GPS update — save `last_driver_lat`, `last_driver_lng`, `last_driver_update_at`
- [ ] Log every incoming payload to `delivery_events` table
- [ ] Wrap entire handler in try/catch — always return `200` even on internal error[^1]


### 2.2 — `lalamove-cancel/index.ts` (new)

- [ ] Accept `{ orderId, reason }` body
- [ ] Validate caller owns the merchant (check `merchant_id` against auth user)
- [ ] Fetch `lalamove_order_id` from `orders` table
- [ ] Check if `lalamove_order_id` is null — return error `'No Lalamove order to cancel'`
- [ ] Call `DELETE /v3/orders/{lalamoveOrderId}` with correct HMAC auth
- [ ] On `200` from Lalamove: update order `status = 'confirmed'`, clear `lalamove_order_id`, `driver_name`, `driver_phone`, `driver_plate`
- [ ] On `422` from Lalamove: return specific message (e.g. "Driver already picked up, cannot cancel")
- [ ] On `404` from Lalamove: treat as already cancelled, update local state anyway
- [ ] On `5xx` from Lalamove: return error with message `'Lalamove unavailable, try again'`
- [ ] Log cancellation reason to `delivery_exception_logs`
- [ ] Increment `lalamove_retry_count` on retry cancellations


### 2.3 — `lalamove-add-priority-fee/index.ts` (new)

- [ ] Accept `{ orderId, tipAmount }` body (tipAmount in RM)
- [ ] Validate `tipAmount` is between 1 and 50
- [ ] Fetch `lalamove_order_id` from orders
- [ ] Call Lalamove `PATCH /v3/orders/{id}` with `priorityFee` field (convert RM to sen)
- [ ] On success: update `orders.priority_fee_added += tipAmount`
- [ ] Log to `delivery_exception_logs` with type `'priority_fee_added'`
- [ ] Return new total price to client
- [ ] Handle `422` — quotation may need refresh first


### 2.4 — `lalamove-get-order-status/index.ts` (new — for fallback poller)

- [ ] Accept `{ orderId }` body
- [ ] Fetch `lalamove_order_id` from DB
- [ ] Call `GET /v3/orders/{lalamoveOrderId}` with HMAC auth
- [ ] Compare returned status with stored status in DB
- [ ] If different: apply same status mapping logic as webhook handler
- [ ] Update driver GPS fields if present in response
- [ ] Log to `delivery_events` with `event_type = 'poll_sync'`
- [ ] Return `{ status, driverInfo, changed: boolean }`


### 2.5 — `lalamove-retry-order/index.ts` (new)

- [ ] Accept `{ orderId }` body
- [ ] Check `lalamove_retry_count < 3` — reject if exceeded
- [ ] Fetch original `delivery_quote_id` and `delivery_service_id` from order
- [ ] Call `lalamove-quote` to get a fresh quotation for same route + service
- [ ] If new price differs by > 20% — return `{ priceChanged: true, oldPrice, newPrice }` and stop
- [ ] If price acceptable — call `lalamove-create-order` with new quotation ID
- [ ] Increment `lalamove_retry_count`
- [ ] Clear `exception_flag`
- [ ] Log retry to `delivery_exception_logs`

***

## EPIC 3 — Supabase Scheduled Poller

### 3.1 — Background status poller using `pg_cron`

- [ ] Enable `pg_cron` extension in Supabase (Database → Extensions)
- [ ] Create SQL function `poll_active_lalamove_orders()` that:
    - Selects all orders where `delivery_provider = 'lalamove'` AND `status IN ('out_for_delivery')` AND `created_at > now() - interval '24 hours'`
    - For each, calls `net.http_post` to invoke `lalamove-get-order-status` Edge Function
- [ ] Schedule with `pg_cron`: run every 3 minutes

```sql
SELECT cron.schedule('poll-lalamove', '*/3 * * * *', 'SELECT poll_active_lalamove_orders()');
```

- [ ] Create SQL function `flag_stuck_driver_assignments()` that:
    - Selects orders where `status = 'out_for_delivery'` AND `driver_assigned_at < now() - interval '15 minutes'` AND `exception_flag IS NULL`
    - Updates `exception_flag = 'driver_not_found'`, `exception_flagged_at = now()`
- [ ] Schedule stuck-driver check: every 5 minutes
- [ ] Create SQL function `flag_unresponsive_drivers()` that:
    - Selects orders where `status = 'out_for_delivery'` AND `last_driver_update_at < now() - interval '20 minutes'` AND `last_driver_lat IS NOT NULL`
    - Updates `exception_flag = 'driver_unresponsive'`, `exception_flagged_at = now()`
- [ ] Schedule unresponsive driver check: every 5 minutes

***

## EPIC 4 — Quotation Expiry Handling (Mobile App)

### 4.1 — `DeliveryMethodPicker.tsx` countdown timer

- [ ] Store `expiresAt` timestamp from Lalamove quote in component state
- [ ] Add `useEffect` with `setInterval` to tick every second
- [ ] Compute `secondsRemaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))`
- [ ] Show countdown badge on selected instant delivery option: `⏱ Expires in 2:47`
- [ ] When `secondsRemaining < 60` — turn badge red, pulse animation
- [ ] When `secondsRemaining === 0` — auto-call `fetchQuotes()` to refresh all quotes
- [ ] If new quote price differs from old — show toast: `"Delivery price updated to RM X.XX"`
- [ ] Clear interval on component unmount
- [ ] Deselect current delivery option when quote expires so user must re-confirm new price


### 4.2 — Checkout guard before place order

- [ ] In `handlePlaceOrder` — check if selected instant delivery quote is expired (`expiresAt < Date.now()`)
- [ ] If expired: block order placement, show error `"Delivery quote expired. Please reselect delivery method."`
- [ ] Scroll checkout to delivery section automatically

***

## EPIC 5 — API Failure \& Retry (Edge Functions)

### 5.1 — Exponential backoff utility (inline in each function)

- [ ] Write `retryWithBackoff(fn, maxRetries = 3)` async helper:
    - Attempt 1: immediate
    - Attempt 2: wait 2000ms
    - Attempt 3: wait 4000ms
    - Attempt 4: wait 8000ms
    - On all retries exhausted: throw last error
- [ ] Apply `retryWithBackoff` to `fetch` call in `lalamove-create-order`
- [ ] Apply `retryWithBackoff` to `fetch` call in `lalamove-cancel`
- [ ] Apply `retryWithBackoff` to `fetch` call in `lalamove-get-order-status`
- [ ] Apply `retryWithBackoff` to `fetch` call in `lalamove-add-priority-fee`
- [ ] On each retry attempt, log attempt number to `lalamove_api_log`


### 5.2 — HTTP error code mapping (in every Lalamove Edge Function)

- [ ] Handle `401` — log `'Invalid API credentials'`, do not retry
- [ ] Handle `404` — log `'Order not found on Lalamove'`, do not retry
- [ ] Handle `422` — parse `message` field from Lalamove response body, surface to client
- [ ] Handle `429` — wait 5 seconds then retry once
- [ ] Handle `500/502/503` — apply exponential backoff retry
- [ ] Handle fetch timeout (>10s) — abort with `AbortController`, log as timeout
- [ ] After 3 failed retries — insert row into `delivery_exception_logs` with `type = 'api_failure'`
- [ ] After 3 failed retries — set `orders.exception_flag = 'api_failure'`

***

## EPIC 6 — Push Notifications (Mobile App)

### 6.1 — Expo Push Notification setup

- [ ] Install `expo-notifications` and `expo-device`
- [ ] Create `src/services/notifications.service.ts`
- [ ] Add `registerForPushNotifications()` function — requests permission, gets Expo push token
- [ ] Store token in `profiles.expo_push_token` column (add column via migration)
- [ ] Call `registerForPushNotifications()` on app startup (in root `_layout.tsx`)
- [ ] Add `useEffect` listener for incoming notifications while app is foregrounded


### 6.2 — `send-push-notification` Edge Function (new)

- [ ] Accept `{ userId, title, body, data }` body
- [ ] Fetch `expo_push_token` from `profiles` table
- [ ] If no token: log and return gracefully
- [ ] Call Expo Push API: `POST https://exp.host/--/api/v2/push/send`
- [ ] Handle `DeviceNotRegistered` error — clear token from DB
- [ ] Handle `MessageTooBig` error — truncate body and retry
- [ ] Log result to a `push_notification_logs` table
- [ ] Support batch: accept `{ userIds[], title, body, data }` for bulk sends


### 6.3 — Trigger notifications from webhook handler

- [ ] On `ASSIGNING_DRIVER` → call `send-push-notification`: `"🏍️ Finding your driver..."` to customer
- [ ] On `ON_GOING` → call `send-push-notification`: `"Driver is on the way to pick up your order!"` to customer
- [ ] On `PICKED_UP` → call `send-push-notification`: `"Your order is out for delivery 🚀"` to customer
- [ ] On `COMPLETED` → call `send-push-notification`: `"Order delivered! ⭐ Rate your experience"` to customer
- [ ] On `CANCELLED` → call `send-push-notification`: `"Delivery cancelled. We're finding a new driver."` to customer
- [ ] On `exception_flag = 'driver_not_found'` set → call `send-push-notification`: `"Still searching for a driver. Please wait..."` to customer

***

## EPIC 7 — Merchant Dashboard: Delivery Exceptions Page

### 7.1 — `src/app/(dashboard)/delivery/exceptions/page.tsx`

- [ ] Fetch all orders where `exception_flag IS NOT NULL` for this merchant
- [ ] Fetch associated `delivery_exception_logs` rows
- [ ] Pass to `DeliveryExceptionsClient` component


### 7.2 — `DeliveryExceptionsClient.tsx`

- [ ] Show count badge in sidebar next to Delivery nav item (red badge if > 0 exceptions)
- [ ] Render three tabs: "Driver Not Found" | "API Failures" | "Resolved"
- [ ] Per flagged order card, show:
    - [ ] Order number + customer name + address
    - [ ] Time since flag was raised (`flagged X mins ago`)
    - [ ] Current Lalamove status (poll live via `lalamove-get-order-status`)
    - [ ] Retry count badge
    - [ ] Exception type label


### 7.3 — Actions per exception card

- [ ] **"Add Priority Fee"** button — opens modal with RM input → calls `lalamove-add-priority-fee`
- [ ] **"Find New Driver"** button — calls `lalamove-retry-order` → shows spinner → updates card status
- [ ] **"Cancel Delivery"** button — opens confirmation modal with cancellation fee warning → calls `lalamove-cancel`
- [ ] **"Mark Resolved"** button — sets `exception_flag = null`, moves order to Resolved tab
- [ ] All action buttons disabled + show spinner while request in-flight
- [ ] On success: optimistically remove card from current tab, move to correct state
- [ ] On error: show toast with exact API error message


### 7.4 — Cancel confirmation modal

- [ ] Show warning: `"A driver has been assigned. Lalamove may charge a cancellation fee."`
- [ ] Show current driver name if available
- [ ] Require typing `"CANCEL"` to confirm (prevents accidental taps)
- [ ] On confirm: call `lalamove-cancel`, update UI


### 7.5 — Retry order flow

- [ ] Show spinner: `"Getting fresh quote..."`
- [ ] If `priceChanged: true` returned: show `"Price changed from RM X to RM Y. Confirm?"`
- [ ] If confirmed: proceed with new quotation
- [ ] If price same: auto-confirm and show `"New driver request sent"`


### 7.6 — Sidebar badge

- [ ] In `Header.tsx` — add second bell counter for delivery exceptions
- [ ] Subscribe to `orders` table realtime where `merchant_id = X` and `exception_flag IS NOT NULL`
- [ ] Update badge count in real time without page refresh

***

## EPIC 8 — Customer App: Delivery Status Tracking

### 8.1 — `app/(customer)/(orders)/[id].tsx` — live delivery status

- [ ] Subscribe to realtime changes on `orders` row for this order ID
- [ ] Show delivery status timeline:
    - [ ] `confirmed` → `preparing` → `ready` → `out_for_delivery` → `delivered`
    - [ ] Active step highlighted, completed steps with checkmark
- [ ] When `driver_name` is populated: show driver card with name, phone, plate
- [ ] When `exception_flag = 'driver_not_found'`: show amber banner `"Still searching for a driver..."`
- [ ] When `exception_flag = 'driver_unresponsive'`: show warning `"Driver may be delayed. We're monitoring."`
- [ ] Add "Contact Driver" button that calls `tel:${driver_phone}` when driver is assigned
- [ ] Add "Cancel Order" button visible only pre-pickup — calls `lalamove-cancel` Edge Function
- [ ] Show cancellation fee warning if driver is already assigned

***

## EPIC 9 — API Call Logging \& Observability

### 9.1 — Log every Lalamove API call

- [ ] In every Lalamove Edge Function, after each fetch: insert row to `lalamove_api_log`
    - [ ] `endpoint`, `method`, `request_body` (strip secrets), `response_body`, `status_code`, `attempt`
- [ ] In `lalamove_api_log`, redact HMAC `Authorization` header before storing


### 9.2 — Dashboard: `src/app/(dashboard)/delivery/logs/page.tsx`

- [ ] Fetch last 100 rows from `lalamove_api_log` for merchant's orders
- [ ] Show table: timestamp, order number, endpoint, status code, attempt
- [ ] Color-code: green = 2xx, amber = 4xx, red = 5xx
- [ ] Click row to expand full request/response JSON in a `<pre>` block
- [ ] Add search by order number

***

## EPIC 10 — Testing Checklist

- [ ] Simulate `REJECTED` webhook → verify `exception_flag` set + customer notification fired
- [ ] Simulate `CANCELLED` webhook → verify order reverts to `confirmed`
- [ ] Let quote expire (sandbox) → verify countdown reaches 0 → auto-refresh fires
- [ ] Trigger retry with price change → verify user sees confirmation modal
- [ ] Trigger `lalamove-cancel` on assigned-driver order → verify cancellation fee warning shown
- [ ] Kill webhook endpoint → wait 3 minutes → verify poller syncs status from Lalamove API
- [ ] Send duplicate webhook event → verify idempotency: second event returns 200 and is ignored
- [ ] Simulate 3× `5xx` from Lalamove → verify exponential backoff → `api_failure` flag set
- [ ] Add priority fee → verify `priority_fee_added` column updated + Lalamove confirms
- [ ] Retry order after driver not found → verify `lalamove_retry_count` increments
- [ ] Exceed `lalamove_retry_count = 3` → verify retry button disabled on dashboard

***

## Summary Table

| Epic | Files to create/modify | Estimated tasks |
| :-- | :-- | :-- |
| 1 — DB Schema | 1 SQL migration | 15 tasks |
| 2 — Edge Functions | 4 new + 1 modified | 38 tasks |
| 3 — Scheduled Poller | SQL + pg_cron | 7 tasks |
| 4 — Quote Expiry (mobile) | 1 component modified | 9 tasks |
| 5 — API Retry Logic | All Lalamove functions | 12 tasks |
| 6 — Push Notifications | 1 new function + service | 14 tasks |
| 7 — Exceptions Dashboard | 3 new files | 18 tasks |
| 8 — Customer Tracking | 1 screen modified | 9 tasks |
| 9 — API Logging | All functions + 1 page | 7 tasks |
| 10 — Testing | — | 11 tasks |
| **Total** | **~15 files** | **140 tasks** |

<div align="center">⁂</div>

[^1]: I-already-implemented-lalamove-but-haven-t-add-fun.md

