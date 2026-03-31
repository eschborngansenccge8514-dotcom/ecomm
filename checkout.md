<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Add cart, checkout and payment gateway edge case handling

Here is the full implementation plan for cart, checkout, and payment gateway edge case handling, built specifically for your hyperlocal Malaysian e-commerce platform on Supabase.

***

## 🛒 Cart Edge Cases

### Inventory Race Conditions

The most dangerous cart issue — two users buy the last item simultaneously and both orders go through.[^1][^2]

- **Optimistic stock reservation** — When a customer adds an item to cart, reserve the stock immediately in a `cart_reservations` table with an expiry timestamp (e.g., 15 minutes), not the actual inventory table.
- **Supabase row-level locking** — Use `SELECT FOR UPDATE` when decrementing stock at checkout to prevent concurrent writes:

```sql
BEGIN;
  SELECT stock FROM products
  WHERE id = $1 AND stock >= $2
  FOR UPDATE;         -- locks this row until transaction ends

  UPDATE products
  SET stock = stock - $2
  WHERE id = $1;
COMMIT;
```

- **Reservation expiry cleanup** — Run a `pg_cron` job every 5 minutes to release expired cart reservations back to inventory:[^1]

```sql
SELECT cron.schedule('release-expired-reservations', '*/5 * * * *', $$
  UPDATE products p
  SET stock = stock + cr.quantity
  FROM cart_reservations cr
  WHERE cr.product_id = p.id
    AND cr.expires_at < NOW()
    AND cr.status = 'reserved';

  DELETE FROM cart_reservations WHERE expires_at < NOW();
$$);
```


### Cart Modification During Checkout

A customer can open a second tab and modify the cart after clicking "Pay Now", causing the order to be created from an inconsistent cart state.[^3]

- **Cart locking** — Lock the cart row the moment a payment intent is created, and block all modifications until payment succeeds or fails:[^3]

```sql
ALTER TABLE carts ADD COLUMN locked_at TIMESTAMPTZ;
ALTER TABLE carts ADD COLUMN locked_by TEXT; -- payment_intent_id
```

```js
// On "Pay Now" click
if (await isCartLocked(cartId)) {
  return { error: "Your cart is being processed. Please wait." }
}
await lockCart(cartId, paymentIntentId)
```

- **Unlock on failure, delete on success** — If payment fails, unlock the cart so the user can retry. If payment succeeds, delete the cart and convert it to an order.[^3]


### Other Cart Edge Cases

| Scenario | Handling |
| :-- | :-- |
| Product price changes while in cart | Re-validate price at checkout; show "Price updated" alert if changed [^4] |
| Product becomes unavailable in cart | Block checkout, highlight unavailable item in red with removal prompt [^1] |
| Vendor temporarily closes | Show "Vendor unavailable" banner, remove their items from active checkout [^5] |
| Delivery zone changes (customer moves address) | Re-validate all cart items against new zone; remove items from vendors outside zone [^6] |
| Expired cart reservation | Notify customer "Your reservation expired. Items may no longer be available." and re-check stock [^2] |
| Empty cart checkout attempt | Block at UI level and API level; return `400` if order submission has 0 items [^4] |


***

## 💳 Checkout Edge Cases

### Address \& Delivery Validation

- **Out-of-zone address** — Before confirming checkout, call the Lalamove quotation API with the customer's address. If it returns no rates or an error, block checkout and prompt the customer to update their address.[^6]
- **Incomplete address** — Enforce all required fields (address line, postcode, city, state) at the form level AND validate again in your Edge Function before submitting to Lalamove or EasyParcel.
- **Postcode format validation** — Malaysian postcodes are always 5 digits. Reject anything else before hitting the EasyParcel API to avoid wasted API calls.[^7]


### Coupon \& Discount Edge Cases

| Scenario | Handling |
| :-- | :-- |
| Expired coupon code | Return `"Coupon expired"` with the expiry date shown [^4] |
| Coupon minimum spend not met | Show "Spend RM X more to use this coupon" [^4] |
| Single-use coupon used twice | Check `coupon_uses` table before applying; reject silently if already used [^4] |
| Multiple coupons stacked | Only allow one coupon per order; reject subsequent applications [^4] |
| Coupon applied to ineligible product | Apply discount only to eligible items; clearly show which items qualify [^4] |

### Session \& Timeout Edge Cases

- **Session expires mid-checkout** — If the user's auth session expires between cart and payment, redirect to re-login but **preserve the cart** using `localStorage` or a guest cart ID. Never lose cart contents on session expiry.
- **Browser tab closed during checkout** — The payment intent is now dangling. Run a cleanup job that cancels unpaid payment intents older than 30 minutes and releases their cart reservations.
- **Double-click "Place Order"** — Disable the submit button immediately on first click at the UI level, and enforce idempotency using a unique `checkout_token` per session at the API level.

***

## 💰 Payment Gateway Edge Cases

Since you're in Malaysia, this covers **FPX / DuitNow / e-wallets (Touch 'n Go, GrabPay)** and card payments via gateways like **iPay88, Billplz, or Stripe**.[^8]

### Webhook Duplicate Processing

The single most common payment bug — the gateway retries the webhook and your system processes the same payment twice, creating duplicate orders or double-fulfillment.[^9][^10]

```js
// In your payment webhook Edge Function
const { payment_id, status } = payload

// Idempotency check FIRST before any processing
const { data: existing } = await supabase
  .from('payment_events')
  .select('id')
  .eq('payment_id', payment_id)
  .eq('status', status)
  .single()

if (existing) {
  return new Response('OK', { status: 200 }) // ACK but ignore duplicate
}

// Log the event first
await supabase.from('payment_events').insert({ payment_id, status, processed_at: new Date() })

// Then process
await processPayment(payment_id, status)
```


### Payment Status Flow

Never update order status based only on a single webhook event. Map the full status transition correctly:[^11]

```
PENDING → FAILED → PENDING → SUCCESS
```

| Webhook Status | Order Action |
| :-- | :-- |
| `PENDING` | Set order to `awaiting_payment`, do not fulfil |
| `SUCCESS` / `PAID` | Set to `paid`, trigger EasyParcel + Lalamove flow |
| `FAILED` | Unlock cart, notify customer to retry, do NOT cancel order yet |
| `EXPIRED` | Cancel order, release inventory, notify customer |
| `REFUNDED` | Trigger refund flow, update order to `refunded` |
| `CHARGEBACK` | Flag for admin review, hold all related shipments |

> ⚠️ **Always update order status on `SUCCESS` only** — never on `PENDING` or `FAILED`, as gateways can send `FAILED → PENDING → SUCCESS` in sequence.[^11]

### FPX / DuitNow Specific

- **Bank redirect timeout** — FPX redirects to the customer's bank portal. If the customer closes the tab without completing, your system never gets a callback. Set a **30-minute order expiry** and poll the gateway's status check endpoint if no webhook arrives.[^12]
- **Bank outage** — Individual banks go down regularly in Malaysia. If the rate check or payment initiation fails for a specific bank, show a friendly message: *"This bank is currently unavailable. Please try another bank or payment method."*[^12]
- **DuitNow QR expiry** — QR codes expire after a set time. If the customer scans but doesn't approve in time, auto-regenerate a new QR and reset the expiry countdown on screen.


### E-Wallet Specific (Touch 'n Go, GrabPay)

- **Insufficient wallet balance** — The gateway will return a specific error code. Show: *"Insufficient balance in your e-wallet. Please top up or use another payment method."*
- **Wallet not linked** — If the customer's e-wallet account isn't linked to the gateway, redirect them to the wallet's top-up/link page with a back URL.


### Card Payment Specific

- **3D Secure (3DS) challenge** — Some cards trigger OTP verification. Your frontend must handle the 3DS redirect flow and await the result before showing success or failure. Never mark an order as paid before 3DS completion.[^12]
- **Card declined** — Return the gateway's decline reason (e.g., `insufficient_funds`, `card_expired`, `do_not_honor`) as a human-readable message. Do not expose raw error codes to the customer.
- **Partial authorisation** — Some prepaid cards authorise only part of the amount. Reject partial authorisations entirely — do not allow partial payment for a full order.

***

## 🔁 Retry \& Recovery Flow (Full Picture)

```
Customer clicks "Pay Now"
        ↓
  Lock cart + reserve stock
        ↓
  Create payment intent
        ↓
  Customer redirected to gateway
        ↓
    ┌───────────────┐
    │  Webhook fires │
    └───────────────┘
         ↓
  ┌── SUCCESS ──────────────────────────────────────────────┐
  │  Unlock cart → create order → trigger EasyParcel +      │
  │  Lalamove → notify customer                             │
  └─────────────────────────────────────────────────────────┘
         ↓
  ┌── FAILED ───────────────────────────────────────────────┐
  │  Unlock cart → keep reservation alive for 10 min →      │
  │  notify customer to retry → log failure reason          │
  └─────────────────────────────────────────────────────────┘
         ↓
  ┌── NO WEBHOOK (30 min timeout) ──────────────────────────┐
  │  Poll gateway status API → if still PENDING, wait 15    │
  │  more min → if EXPIRED, release stock + cancel order    │
  └─────────────────────────────────────────────────────────┘
```


***

## Recommended Admin Panel — "Payment Exceptions"

Surface all issues in a dedicated section:[^10][^12]

- 🔴 **Duplicate webhook attempts** detected and suppressed (log count)
- 🟡 **Stuck `PENDING` payments** older than 30 minutes
- 🟠 **Failed payments** with retry count and decline reason
- ⚫ **Orders paid but EasyParcel/Lalamove not triggered** (fulfilment gap)
- 📋 **Full payment event log** per order with timestamps and gateway response codes
- 💰 **Daily revenue reconciliation** — compare gateway settlement report vs. your DB total
<span style="display:none">[^13][^14][^15][^16][^17][^18]</span>

<div align="center">⁂</div>

[^1]: https://www.reddit.com/r/webdev/comments/7p0y02/how_to_handle_ecommercecart_race_condition/

[^2]: https://stackoverflow.com/questions/3389000/avoid-race-conditions-in-ecommerce-scenarios/26549344

[^3]: https://www.linkedin.com/posts/rajman-bind-27bb38177_systemdesign-backendengineering-postgresql-activity-7425964390853591041-ckZ7

[^4]: https://www.linkedin.com/pulse/writing-test-cases-e-commerce-domain-edge-detailed-guide-ot8lc

[^5]: https://www.hyperzod.com/blog/what-is-hyperlocal-ecommerce

[^6]: https://www.imgglobalinfotech.com/blog/how-to-build-hyperlocal-ecommerce-marketplace

[^7]: https://plausible.io/blog/shopify-analytics

[^8]: https://webmedic.com/best-shopify-payment-gateways-malaysia

[^9]: https://www.hooktunnel.com/blog/stripe-webhook-duplicate-events

[^10]: https://dev.to/ramapratheeba/how-to-handle-duplicate-webhook-events-in-aspnet-core-idempotency-guide-4kj6

[^11]: https://www.cashfree.com/docs/payments/online/webhooks/webhook-indempotency

[^12]: https://paydibs.com/how-payment-gateway-works/

[^13]: https://theedgemalaysia.com/content/advertise/payment-gateways-the-backbone-of-a-cashless-society

[^14]: https://stripe.com/resources/more/payment-gateway-testing-a-how-to-guide-for-businesses

[^15]: https://curlec.com/blog/guides/what-is-payment-gateway/

[^16]: https://knowledge.antom.com/choosing-a-payment-gateway-for-malaysian-businesses

[^17]: https://wezboone.com/blog/top-12-payment-gateways-in-malaysia.html

[^18]: https://www.youtube.com/watch?v=DrWZHTT9rug

