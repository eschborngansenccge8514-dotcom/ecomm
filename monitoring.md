<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# I mean monitoring in merchant dashboard

Got it — you want **merchants to monitor their own Lalamove, EasyParcel, and payment statuses** directly from their vendor-facing dashboard. Here is a full feature list with UI details for each monitoring panel.

***

## 🚚 Lalamove Monitoring Panel (Merchant View)

This panel gives the merchant a real-time view of all their active and past Lalamove deliveries without needing to open the Lalamove app.[^1]

### Active Deliveries Widget

- **Live status badge** per order — colour-coded: 🟡 Assigning Driver → 🔵 On Going → 🟢 Picked Up → ✅ Completed → 🔴 Cancelled[^1]
- **Live driver location map** — embedded mini-map showing the driver's real-time pin relative to the pickup and dropoff point[^1]
- **Driver info card** — shows driver name, vehicle type, and contact number once matched, with a one-tap call button[^2]
- **Estimated arrival time** — countdown showing ETA to pickup and ETA to customer based on live GPS[^1]
- **Elapsed time in current status** — e.g. *"Assigning driver for 8 mins"* so merchants know when something looks stuck[^2]


### Delivery Exception Alerts (Merchant-Facing)

Shown as inline banners within the orders list, not buried in an admin panel:[^3][^1]


| Alert | Trigger | Merchant Action |
| :-- | :-- | :-- |
| 🔴 "Driver not found" | `ASSIGNING_DRIVER` > 10 min | "Add Priority Fee" or "Cancel \& Retry" button |
| 🟠 "Driver not moving" | GPS stale > 20 min | "Contact Driver" or "Report Issue" button |
| 🔴 "Delivery failed" | Order cancelled mid-delivery | "Re-book Delivery" button |
| 🟡 "Delivery delayed" | ETA exceeded by > 15 min | Notify customer button |

### Delivery History Tab

- Full list of past Lalamove orders filterable by date, status, and order ID[^2]
- Total delivery fees spent this month vs. last month
- Average delivery time per completed order
- Cancellation rate with reason breakdown (driver not found / merchant cancelled / customer cancelled)[^4]

***

## 📦 EasyParcel Monitoring Panel (Merchant View)

Gives merchants full shipment visibility without logging into the EasyParcel portal.[^5]

### Shipment Status Overview

A status summary bar at the top showing counts per status at a glance:[^5]

```
[ Pending Payment: 2 ] [ Awaiting Pickup: 5 ] [ In Transit: 12 ]
[ Delivered: 48 ]      [ On Hold: 1 ]         [ Returned: 0 ]
```


### Active Shipments List

Each row shows:[^5]

- **AWB number** with copy button
- **Courier name** (e.g. J\&T, Poslaju, DHL)
- **Current tracking status** with last updated timestamp
- **Customer name \& destination** (city/state only for privacy)
- **Days in transit** counter — highlights in orange if > 5 days without delivery
- **"Track" button** — expands inline tracking timeline without leaving the page


### Tracking Timeline (Inline Expand)

When merchant clicks "Track", shows a vertical timeline:[^4]

```
✅ Shipment Created        — 29 Mar 2026, 9:00am
✅ Collected by Courier    — 29 Mar 2026, 2:15pm
✅ In Transit (Hub Scan)   — 29 Mar 2026, 8:40pm
🔵 Out for Delivery        — 30 Mar 2026, 9:10am
⏳ Awaiting Delivery...
```


### Exception Alerts (Merchant-Facing)

Shown as notification badges on the EasyParcel panel tab:[^6]


| Alert | Trigger | Merchant Action |
| :-- | :-- | :-- |
| 🔴 "No AWB generated" | Paid but AWB empty after 30 min | "Retry AWB" button |
| 🟠 "Parcel on hold" | `ship_status = On Hold` | "Contact Courier" with AWB pre-filled |
| 🔴 "Parcel returned" | `ship_status = Returned` | "Re-ship" or "Refund Customer" button |
| 🟡 "Stuck in transit" | No scan update > 5 days | "Report to Courier" button |
| ⚫ "Insufficient credit" | EasyParcel wallet empty | "Top Up Now" link to EasyParcel portal |

### Shipment Performance Summary

A monthly summary card visible at the top of the panel:[^4]

- Total shipments this month
- On-time delivery rate (% delivered within courier's stated SLA)
- Average days to deliver
- Return rate (%) with trend vs. last month

***

## 💳 Payment Monitoring Panel (Merchant View)

Lets merchants track payment health for their own store in real time.[^7][^8]

### Live Transaction Feed

A real-time scrolling list of the last 20 transactions showing:[^7]

- Order ID + customer name (masked: `Ah**** L***`)
- Payment method icon (FPX / TNG / GrabPay / Card)
- Amount in RM
- Status badge: ✅ Paid / ⏳ Pending / ❌ Failed / 🔄 Refunded
- Timestamp


### Payment Status Summary Cards

Four metric cards at the top of the panel:[^8][^7]

```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Today's Revenue│ │  Pending Orders │ │  Failed Payments│ │  Success Rate   │
│    RM 1,240.00  │ │        3        │ │        1        │ │     96.2%       │
│  ↑ 12% vs yday  │ │  Oldest: 18 min │ │  Last: 42 min   │ │  ↓ 2% vs yday   │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
```


### Payment Exception Alerts (Merchant-Facing)

| Alert | Trigger | Merchant Action |
| :-- | :-- | :-- |
| 🟡 "Payment pending too long" | PENDING > 30 min | "Check Status" polls gateway live |
| ❌ "Payment failed" | Gateway returns failed status | Shows decline reason + "Contact Customer" |
| 🔄 "Refund requested" | Customer raises dispute | "Approve Refund" or "Reject" button |
| ⚠️ "Chargeback received" | Bank-initiated reversal | "View Details" — flagged for merchant review |

### Settlement Summary (Daily)

Mirrors what Touch 'n Go and other Malaysian gateways provide in their merchant portals:[^8]

- Total settled amount for the day
- Breakdown by payment method (FPX / e-wallet / card)
- Pending settlement (collected but not yet transferred to bank)
- Expected bank-in date per settlement batch


### Payment Method Breakdown Chart

A pie or bar chart showing:[^9]

- FPX (which banks)
- Touch 'n Go eWallet
- GrabPay
- Credit/Debit Card

This helps merchants understand which payment methods their local customers prefer, useful for deciding which gateways to prioritise.[^7]

***

## 🔔 Unified Notification Centre (Merchant View)

All three monitoring panels feed into a single notification bell at the top of the merchant dashboard:[^3][^1]

```
🔔 Notifications (4 unread)
────────────────────────────────────────────
🔴 [Lalamove] Driver not found for Order #1042 — 8 min ago
          [ Add Priority Fee ]  [ Cancel & Retry ]

🟠 [EasyParcel] Parcel EP123456 is On Hold — 2 hrs ago
          [ Contact Courier ]

❌ [Payment] Order #1039 payment failed (Insufficient funds) — 15 min ago
          [ Contact Customer ]

🟡 [EasyParcel] Credit balance low: RM 30.00 — Today, 8:00am
          [ Top Up Now ]
```

Merchants should also be able to toggle **push notifications and email alerts** per category (delivery / shipment / payment) from their profile settings.[^8][^7]
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16]</span>

<div align="center">⁂</div>

[^1]: https://milkride.com/merchant-dashboard/

[^2]: https://delivrise.com/delivrise-merchant-dashboard/

[^3]: https://www.youtube.com/watch?v=yqiaHc5tiaY

[^4]: https://www.shipbob.com/blog/delivery-management/

[^5]: https://www.wcvendors.com/vendor-dashboard-top-features/

[^6]: https://plausible.io/blog/shopify-analytics

[^7]: https://www.paidchain.my/top-5-features-you-should-expect-from-a-modern-merchant-dashboard/

[^8]: https://www.touchngo.com.my/merchant/merchant-dashboard

[^9]: https://www.setproduct.com/blog/e-commerce-dashboard-examples

[^10]: https://www.multidisciplinaryfrontiers.com/uploads/archives/20250812174322_FMR-2025-2-050.1.pdf

[^11]: https://www.ecommboardroom.com/best-dashboard-for-ecommerce

[^12]: https://www.gooddata.com/blog/supply-chain-dashboard-examples/

[^13]: https://windsor.ai/ecommerce-marketing-dashboard-templates/

[^14]: https://www.wodely.com/multi-merchant/

[^15]: https://dribbble.com/search/delivery-status-ui

[^16]: https://dribbble.com/tags/order-tracking-dashboard

