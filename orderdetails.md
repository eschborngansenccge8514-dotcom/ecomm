<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Order details in merchant dashboard are missing something.

Here's exactly what's missing, then the complete fixed `OrderDetailClient.tsx` covering all of them.[^1][^2]

***

## What's Missing

| \# | Missing | Impact |
| :-- | :-- | :-- |
| 1 | **Customer info card** — no email, phone, link to order history | Can't contact customer without leaving the page |
| 2 | **Status timeline** — no visual progress bar of the order journey | Merchant can't see at a glance how far along an order is |
| 3 | **Real-time updates** — page is static, must refresh manually | Misses driver assignment, status changes live |
| 4 | **Loyalty points row** — `points_earned/redeemed/discount` columns exist but never shown | Merchant doesn't know points were applied |
| 5 | **Delivery booking inline** — must navigate to `/delivery` to book Lalamove | Breaks workflow; merchant needs it right here |
| 6 | **Driver info card** — `driver_name/phone/plate` fields never rendered | No way to see who the driver is |
| 7 | **Customer notes** — `notes` field on orders is never displayed | Special instructions silently ignored |
| 8 | **Status timestamps** — `confirmed_at`, `delivered_at` etc. never shown | No audit trail on the page |
| 9 | **Print / invoice button** — no way to print or download | Staff can't hand a receipt to anyone |
| 10 | **Delivery type label** — instant vs courier vs self-pickup never labeled | Ambiguous whether to book a driver or not |


***

## Updated `src/app/(dashboard)/orders/[id]/page.tsx`

Fetch all the missing fields from Supabase:

```typescript
import { createClient }  from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { OrderDetailClient } from '@/components/dashboard/OrderDetailClient'

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase
    .from('merchants').select('id').eq('user_id', user.id).single()

  const { data: order } = await supabase
    .from('orders')
    .select(`
      *,
      items:order_items(*),
      customer:profiles!customer_id(id, full_name, email, phone)
    `)
    .eq('id', id)
    .eq('merchant_id', merchant!.id)
    .single()

  if (!order) notFound()

  // Customer's previous orders with this merchant
  const { count: customerOrderCount } = order.customer_id
    ? await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchant!.id)
        .eq('customer_id', order.customer_id)
    : { count: 0 }

  return (
    <OrderDetailClient
      order={order}
      merchantId={merchant!.id}
      customerOrderCount={customerOrderCount ?? 0}
    />
  )
}
```


***

## Complete `src/components/dashboard/OrderDetailClient.tsx`

```typescript
'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter }    from 'next/navigation'
import { Button }       from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { format }       from 'date-fns'
import { cn }           from '@/lib/utils'
import toast            from 'react-hot-toast'
import {
  ArrowLeft, Phone, Mail, User, MapPin, Package,
  Clock, CreditCard, Star, Truck, Printer,
  Loader2, ExternalLink, StickyNote, CheckCircle2,
  Circle, ChevronRight,
} from 'lucide-react'

// ─── Status machine ──────────────────────────────────────────────────────────

const NEXT_ACTIONS: Record<string, { label: string; next: string; color: string }[]> = {
  paid:             [
    { label: 'Accept Order',      next: 'confirmed',        color: 'bg-blue-600 hover:bg-blue-700 text-white'   },
    { label: 'Reject Order',      next: 'cancelled',        color: 'bg-red-500  hover:bg-red-600  text-white'   },
  ],
  confirmed:        [{ label: 'Start Preparing',   next: 'preparing',        color: 'bg-purple-600 hover:bg-purple-700 text-white' }],
  preparing:        [{ label: 'Ready for Pickup',  next: 'ready_for_pickup', color: 'bg-cyan-600   hover:bg-cyan-700   text-white' }],
  ready_for_pickup: [{ label: 'Mark Delivered',    next: 'delivered',        color: 'bg-green-600  hover:bg-green-700  text-white' }],
  out_for_delivery: [{ label: 'Mark Delivered',    next: 'delivered',        color: 'bg-green-600  hover:bg-green-700  text-white' }],
}

const STATUS_COLOR: Record<string, string> = {
  paid:             'bg-blue-100   text-blue-700',
  confirmed:        'bg-indigo-100 text-indigo-700',
  preparing:        'bg-purple-100 text-purple-700',
  ready_for_pickup: 'bg-cyan-100   text-cyan-700',
  out_for_delivery: 'bg-sky-100    text-sky-700',
  delivered:        'bg-green-100  text-green-700',
  cancelled:        'bg-red-100    text-red-700',
  pending:          'bg-yellow-100 text-yellow-700',
}

// ─── Order status timeline definition ────────────────────────────────────────

const TIMELINE_STEPS = [
  { key: 'paid',             label: 'Order Placed',       tsKey: 'created_at'      },
  { key: 'confirmed',        label: 'Accepted',           tsKey: 'confirmed_at'    },
  { key: 'preparing',        label: 'Preparing',          tsKey: 'preparing_at'    },
  { key: 'ready_for_pickup', label: 'Ready',              tsKey: 'ready_at'        },
  { key: 'out_for_delivery', label: 'Out for Delivery',   tsKey: 'dispatched_at'   },
  { key: 'delivered',        label: 'Delivered',          tsKey: 'delivered_at'    },
]

const STATUS_ORDER = ['paid', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered']

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, icon, children, className }: {
  title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string
}) {
  return (
    <div className={cn('bg-white rounded-2xl border border-gray-100 p-5', className)}>
      {(title || icon) && (
        <div className="flex items-center gap-2 mb-4">
          {icon && <span className="text-gray-400">{icon}</span>}
          <h3 className="font-bold text-gray-900">{title}</h3>
        </div>
      )}
      {children}
    </div>
  )
}

function Row({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-gray-400 shrink-0">{label}</span>
      <span className={cn('text-sm font-medium text-gray-800 text-right', valueClass)}>{value}</span>
    </div>
  )
}

// ─── StatusTimeline ───────────────────────────────────────────────────────────

function StatusTimeline({ order }: { order: any }) {
  const cancelled = order.status === 'cancelled'
  const currentIdx = STATUS_ORDER.indexOf(order.status)

  if (cancelled) {
    return (
      <div className="flex items-center gap-2 bg-red-50 rounded-xl px-4 py-3">
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <div>
          <p className="text-sm font-bold text-red-700">Order Cancelled</p>
          {order.cancelled_at && (
            <p className="text-xs text-red-400">
              {format(new Date(order.cancelled_at), 'd MMM yyyy, h:mm a')}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {TIMELINE_STEPS.map((step, i) => {
        const isDone    = STATUS_ORDER.indexOf(step.key) <= currentIdx
        const isActive  = step.key === order.status
        const timestamp = order[step.tsKey]
        const isLast    = i === TIMELINE_STEPS.length - 1

        return (
          <div key={step.key} className="flex gap-3">
            {/* Dot + connector */}
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors',
                isDone
                  ? isActive
                    ? 'bg-blue-500 ring-4 ring-blue-100'
                    : 'bg-green-500'
                  : 'bg-gray-100'
              )}>
                {isDone
                  ? <CheckCircle2 size={14} className="text-white" />
                  : <Circle size={14} className="text-gray-300" />}
              </div>
              {!isLast && (
                <div className={cn('w-0.5 flex-1 my-1 min-h-[20px]',
                  isDone && !isActive ? 'bg-green-400' : 'bg-gray-100')} />
              )}
            </div>
            {/* Label + timestamp */}
            <div className={cn('pb-4', isLast ? 'pb-0' : '')}>
              <p className={cn('text-sm font-semibold leading-7',
                isActive ? 'text-blue-600' : isDone ? 'text-gray-700' : 'text-gray-300')}>
                {step.label}
              </p>
              {timestamp && (
                <p className="text-xs text-gray-400 -mt-1">
                  {format(new Date(timestamp), 'd MMM yyyy, h:mm a')}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Print invoice ────────────────────────────────────────────────────────────

function printInvoice(order: any) {
  const addr  = order.delivery_address as any
  const items = (order.items ?? []) as any[]
  const html  = `
    <html>
      <head>
        <title>Invoice ${order.order_number}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 32px; }
          h1   { font-size: 20px; margin-bottom: 4px; }
          .sub { color: #666; font-size: 12px; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; }
          th    { text-align: left; border-bottom: 2px solid #111; padding: 6px 0; font-size: 12px; }
          td    { padding: 6px 0; border-bottom: 1px solid #eee; font-size: 12px; }
          .total-row td { font-weight: bold; border-top: 2px solid #111; border-bottom: none; }
          .address { background: #f7f7f7; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 12px; line-height: 1.6; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #dcfce7; color: #166534; font-size: 11px; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Tax Invoice</h1>
        <p class="sub">Order: ${order.order_number} &nbsp;·&nbsp; ${format(new Date(order.created_at), 'd MMM yyyy, h:mm a')}</p>

        ${addr ? `
        <div class="address">
          <strong>Deliver to:</strong><br/>
          ${addr.name ?? ''}<br/>
          ${addr.line1 ?? ''}, ${addr.line2 ? addr.line2 + ', ' : ''}${addr.city ?? ''}, ${addr.state ?? ''} ${addr.postcode ?? ''}<br/>
          ${addr.phone ?? ''}
        </div>
        ` : ''}

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Variant</th>
              <th style="text-align:center">Qty</th>
              <th style="text-align:right">Unit Price</th>
              <th style="text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(i => `
              <tr>
                <td>${i.product_name}</td>
                <td style="color:#666">${i.variant_name ?? '—'}</td>
                <td style="text-align:center">${i.quantity}</td>
                <td style="text-align:right">RM ${Number(i.unit_price).toFixed(2)}</td>
                <td style="text-align:right">RM ${Number(i.line_total).toFixed(2)}</td>
              </tr>
            `).join('')}
            <tr><td colspan="5" style="padding-top:8px"></td></tr>
            <tr><td colspan="4" style="text-align:right;color:#666">Subtotal</td><td style="text-align:right">RM ${Number(order.subtotal).toFixed(2)}</td></tr>
            <tr><td colspan="4" style="text-align:right;color:#666">Delivery Fee</td><td style="text-align:right">${order.delivery_fee > 0 ? `RM ${Number(order.delivery_fee).toFixed(2)}` : 'Free'}</td></tr>
            ${order.points_discount > 0 ? `<tr><td colspan="4" style="text-align:right;color:#f59e0b">Points Discount</td><td style="text-align:right;color:#f59e0b">-RM ${Number(order.points_discount).toFixed(2)}</td></tr>` : ''}
            ${order.discount_amount > 0 ? `<tr><td colspan="4" style="text-align:right;color:#16a34a">Promo Discount</td><td style="text-align:right;color:#16a34a">-RM ${Number(order.discount_amount).toFixed(2)}</td></tr>` : ''}
            <tr class="total-row">
              <td colspan="4" style="text-align:right">TOTAL</td>
              <td style="text-align:right">RM ${Number(order.total_amount).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <p>Payment: <strong>${(order.payment_method ?? '—').replace(/_/g, ' ')}</strong> &nbsp; <span class="badge">${order.payment_status}</span></p>
        <p style="margin-top:24px;font-size:11px;color:#999">Thank you for your order.</p>
      </body>
    </html>
  `
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OrderDetailClient({ order: initial, merchantId, customerOrderCount }: {
  order: any; merchantId: string; customerOrderCount: number
}) {
  const [order, setOrder]       = useState(initial)
  const [updating, setUpdating] = useState(false)
  const [booking, setBooking]   = useState(false)
  const router  = useRouter()
  const addr    = order.delivery_address as any
  const actions = NEXT_ACTIONS[order.status] ?? []

  // ── Realtime subscription ────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    const channel  = supabase
      .channel(`order-detail-${order.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` },
        (payload) => {
          setOrder((prev: any) => ({ ...prev, ...payload.new }))
          toast.success('Order updated in real time')
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [order.id])

  // ── Status update ────────────────────────────────────────────────────────
  const handleUpdate = async (nextStatus: string) => {
    if (!confirm(`Change status to "${nextStatus.replace(/_/g, ' ')}"?`)) return
    setUpdating(true)
    const supabase  = createClient()
    const now       = new Date().toISOString()
    const updates: any = { status: nextStatus }

    if (nextStatus === 'confirmed')        updates.confirmed_at  = now
    if (nextStatus === 'preparing')        updates.preparing_at  = now
    if (nextStatus === 'ready_for_pickup') updates.ready_at      = now
    if (nextStatus === 'delivered')        updates.delivered_at  = now
    if (nextStatus === 'cancelled')        updates.cancelled_at  = now

    const { error } = await supabase.from('orders').update(updates).eq('id', order.id)
    if (error) { toast.error(error.message); setUpdating(false); return }

    setOrder((prev: any) => ({ ...prev, ...updates }))

    // Award loyalty points on delivery
    if (nextStatus === 'delivered') {
      supabase.functions.invoke('award-loyalty-points', { body: { orderId: order.id } })
        .then(({ data }) => {
          if (data?.pointsAwarded > 0)
            toast.success(`${data.pointsAwarded} loyalty pts awarded to customer 🌟`)
        })
    }

    toast.success('Order updated')
    setUpdating(false)
  }

  // ── Lalamove booking ─────────────────────────────────────────────────────
  const handleBookLalamove = async () => {
    if (!order.delivery_quote_id) {
      toast.error('No quote saved — customer must re-checkout')
      return
    }
    setBooking(true)
    const supabase = createClient()
    const { data, error } = await supabase.functions.invoke('lalamove-create-order', {
      body: { orderId: order.id, quotationId: order.delivery_quote_id, serviceType: order.delivery_service_id },
    })
    if (error || data?.error) {
      toast.error(error?.message ?? data?.error)
    } else {
      toast.success('Lalamove booked! 🏍️ Driver being assigned')
      setOrder((prev: any) => ({ ...prev, status: 'out_for_delivery', lalamove_order_id: data.lalamoveOrderId }))
    }
    setBooking(false)
  }

  // ── EasyParcel booking ───────────────────────────────────────────────────
  const handleBookEasyParcel = async () => {
    setBooking(true)
    const supabase = createClient()
    const { data, error } = await supabase.functions.invoke('easyparcel-create-order', {
      body: { orderId: order.id },
    })
    if (error || data?.error) {
      toast.error(error?.message ?? data?.error)
    } else {
      toast.success(`Parcel booked! AWB: ${data.trackingNumber} 📦`)
      setOrder((prev: any) => ({
        ...prev,
        status:          'out_for_delivery',
        tracking_number: data.trackingNumber,
        tracking_url:    data.trackingUrl,
      }))
    }
    setBooking(false)
  }

  const isInstant   = order.delivery_provider === 'lalamove'
  const isCourier   = order.delivery_provider === 'easyparcel'
  const isSelfPickup = order.delivery_type === 'self_pickup'

  const canBookDelivery =
    (isInstant || isCourier) &&
    !order.lalamove_order_id &&
    !order.tracking_number &&
    ['confirmed', 'preparing', 'ready_for_pickup'].includes(order.status)

  return (
    <div className="space-y-4 max-w-5xl">

      {/* ── Back + header bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft size={16} className="mr-1" /> Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{order.order_number}</h1>
              <span className={cn('text-xs font-bold px-2.5 py-0.5 rounded-full capitalize',
                STATUS_COLOR[order.status] ?? 'bg-gray-100 text-gray-600')}>
                {order.status.replace(/_/g, ' ')}
              </span>
              {/* Realtime pulse indicator */}
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-0.5">
              {format(new Date(order.created_at), 'd MMM yyyy, h:mm a')}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => printInvoice(order)}>
          <Printer size={15} className="mr-1.5" /> Print Invoice
        </Button>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ══ LEFT COLUMN (2/3 width) ════════════════════════════════════════ */}
        <div className="lg:col-span-2 space-y-4">

          {/* Customer notes banner */}
          {order.notes && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
              <StickyNote size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-700 mb-0.5">Customer Note</p>
                <p className="text-sm text-amber-800">{order.notes}</p>
              </div>
            </div>
          )}

          {/* Items ordered */}
          <SectionCard title="Items Ordered" icon={<Package size={16} />}>
            <div className="space-y-3">
              {(order.items ?? []).map((item: any) => (
                <div key={item.id} className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{item.product_name}</p>
                    {item.variant_name && (
                      <p className="text-xs text-gray-400 mt-0.5">{item.variant_name}</p>
                    )}
                    {item.notes && (
                      <p className="text-xs text-amber-600 mt-0.5 italic">"{item.notes}"</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      RM {Number(item.unit_price).toFixed(2)} × {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-gray-900 shrink-0">
                    RM {Number(item.line_total).toFixed(2)}
                  </p>
                </div>
              ))}

              {/* Price breakdown */}
              <div className="border-t border-gray-50 pt-3 space-y-1.5">
                <Row label="Subtotal"    value={`RM ${Number(order.subtotal).toFixed(2)}`} />
                <Row
                  label="Delivery Fee"
                  value={order.delivery_fee > 0
                    ? `RM ${Number(order.delivery_fee).toFixed(2)}`
                    : <span className="text-green-600 font-semibold">Free</span>}
                />
                {Number(order.discount_amount) > 0 && (
                  <Row
                    label="Promo Discount"
                    value={<span className="text-green-600">−RM {Number(order.discount_amount).toFixed(2)}</span>}
                  />
                )}
                {Number(order.points_discount) > 0 && (
                  <Row
                    label="🌟 Points Discount"
                    value={<span className="text-amber-600">−RM {Number(order.points_discount).toFixed(2)}</span>}
                  />
                )}
                <div className="flex justify-between items-center font-bold text-base border-t border-gray-100 pt-2 mt-1">
                  <span className="text-gray-900">Total</span>
                  <span className="text-blue-600 text-lg">RM {Number(order.total_amount).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Customer info */}
          <SectionCard title="Customer" icon={<User size={16} />}>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                {/* Avatar + name */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-base shrink-0">
                    {(order.customer?.full_name ?? addr?.name ?? 'G').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {order.customer?.full_name ?? addr?.name ?? 'Guest'}
                    </p>
                    {customerOrderCount > 1 && (
                      <p className="text-xs text-blue-600 font-medium">
                        {customerOrderCount} orders with you
                      </p>
                    )}
                  </div>
                </div>

                {/* Contact details */}
                <div className="space-y-1 pl-0.5">
                  {(order.customer?.email || addr?.email) && (
                    <a
                      href={`mailto:${order.customer?.email ?? addr?.email}`}
                      className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors w-fit"
                    >
                      <Mail size={13} className="text-gray-300" />
                      {order.customer?.email ?? addr?.email}
                    </a>
                  )}
                  {(order.customer?.phone || addr?.phone) && (
                    <a
                      href={`tel:${order.customer?.phone ?? addr?.phone}`}
                      className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors w-fit"
                    >
                      <Phone size={13} className="text-gray-300" />
                      {order.customer?.phone ?? addr?.phone}
                    </a>
                  )}
                </div>
              </div>

              {/* View customer history */}
              {order.customer_id && (
                <Button variant="outline" size="sm"
                  onClick={() => router.push(`/customers?search=${order.customer_id}`)}>
                  History <ChevronRight size={14} className="ml-1" />
                </Button>
              )}
            </div>

            {/* Delivery address */}
            {addr && !isSelfPickup && (
              <div className="mt-4 flex items-start gap-2 bg-gray-50 rounded-xl p-3">
                <MapPin size={14} className="text-gray-400 mt-0.5 shrink-0" />
                <div className="text-sm text-gray-600 space-y-0.5">
                  <p className="font-semibold text-gray-800">{addr.name}</p>
                  <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
                  <p>{addr.city}, {addr.state} {addr.postcode}</p>
                </div>
              </div>
            )}
            {isSelfPickup && (
              <div className="mt-4 flex items-center gap-2 bg-gray-50 rounded-xl p-3">
                <Package size={14} className="text-gray-400" />
                <p className="text-sm text-gray-600 font-medium">Self Pickup</p>
              </div>
            )}
          </SectionCard>

          {/* Payment */}
          <SectionCard title="Payment" icon={<CreditCard size={16} />}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">Method</p>
                <p className="text-sm font-semibold text-gray-800 capitalize">
                  {(order.payment_method ?? '—').replace(/_/g, ' ')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Status</p>
                <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full capitalize',
                  order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700')}>
                  {order.payment_status ?? '—'}
                </span>
              </div>
              {Number(order.points_redeemed) > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">🌟 Points Redeemed</p>
                  <p className="text-sm font-semibold text-amber-600">
                    {order.points_redeemed.toLocaleString()} pts
                  </p>
                </div>
              )}
              {Number(order.points_earned) > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">🌟 Points Earned</p>
                  <p className="text-sm font-semibold text-green-600">
                    +{order.points_earned.toLocaleString()} pts
                  </p>
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        {/* ══ RIGHT COLUMN (1/3 width) ═══════════════════════════════════════ */}
        <div className="space-y-4">

          {/* Status + actions */}
          <SectionCard title="Status & Actions" icon={<Clock size={16} />}>
            <StatusTimeline order={order} />

            {/* Action buttons */}
            {actions.length > 0 && (
              <div className="mt-5 space-y-2">
                {actions.map(a => (
                  <button key={a.next}
                    onClick={() => handleUpdate(a.next)}
                    disabled={updating}
                    className={cn(
                      'w-full py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2',
                      a.color,
                      updating && 'opacity-60 cursor-not-allowed'
                    )}
                  >
                    {updating && <Loader2 size={14} className="animate-spin" />}
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Delivery */}
          <SectionCard title="Delivery" icon={<Truck size={16} />}>
            <div className="space-y-3">
              <Row
                label="Type"
                value={
                  <span className="capitalize">
                    {isSelfPickup ? '🏃 Self Pickup'
                      : isInstant  ? '🏍️ Instant (Lalamove)'
                      : isCourier  ? '📦 Courier (EasyParcel)'
                      : order.delivery_type?.replace(/_/g, ' ') ?? '—'}
                  </span>
                }
              />
              {Number(order.delivery_fee) > 0 && (
                <Row label="Fee" value={`RM ${Number(order.delivery_fee).toFixed(2)}`} />
              )}
              {order.estimated_delivery && (
                <Row label="Estimated" value={format(new Date(order.estimated_delivery), 'd MMM, h:mm a')} />
              )}

              {/* Lalamove order ID */}
              {order.lalamove_order_id && (
                <Row label="Lalamove ID"
                  value={<span className="font-mono text-xs">{order.lalamove_order_id.slice(0, 12)}…</span>} />
              )}

              {/* Driver card — shown when Lalamove assigns a driver */}
              {order.driver_name && (
                <div className="bg-blue-50 rounded-xl p-3 space-y-1.5">
                  <p className="text-xs font-bold text-blue-700 flex items-center gap-1">
                    <span>🏍️</span> Driver Assigned
                  </p>
                  <p className="text-sm font-semibold text-blue-900">{order.driver_name}</p>
                  <a href={`tel:${order.driver_phone}`}
                    className="flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 w-fit">
                    <Phone size={12} />
                    {order.driver_phone}
                  </a>
                  {order.driver_plate && (
                    <p className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full w-fit font-mono font-bold">
                      {order.driver_plate}
                    </p>
                  )}
                </div>
              )}

              {/* Parcel tracking */}
              {order.tracking_number && (
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  <p className="text-xs font-bold text-gray-600">📦 Tracking</p>
                  <p className="font-mono text-xs text-gray-700 font-bold">{order.tracking_number}</p>
                  {order.tracking_url && (
                    <a href={order.tracking_url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline w-fit">
                      <ExternalLink size={11} /> Track parcel
                    </a>
                  )}
                </div>
              )}

              {/* Book delivery inline — only when applicable */}
              {canBookDelivery && (
                <div className="pt-1">
                  {isInstant && (
                    <button onClick={handleBookLalamove} disabled={booking}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl py-2.5 flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
                      {booking ? <Loader2 size={14} className="animate-spin" /> : '🏍️'}
                      Book Lalamove Driver
                    </button>
                  )}
                  {isCourier && (
                    <button onClick={handleBookEasyParcel} disabled={booking}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl py-2.5 flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
                      {booking ? <Loader2 size={14} className="animate-spin" /> : '📦'}
                      Book Courier
                    </button>
                  )}
                </div>
              )}
            </div>
          </SectionCard>

          {/* Loyalty summary */}
          {(Number(order.points_earned) > 0 || Number(order.points_redeemed) > 0) && (
            <SectionCard title="Loyalty Points" icon={<Star size={16} />}>
              <div className="space-y-2">
                {Number(order.points_redeemed) > 0 && (
                  <div className="flex items-center justify-between bg-amber-50 rounded-xl px-3 py-2">
                    <span className="text-xs text-amber-700 font-medium">Redeemed</span>
                    <span className="text-sm font-bold text-amber-700">
                      −{order.points_redeemed.toLocaleString()} pts
                    </span>
                  </div>
                )}
                {Number(order.points_earned) > 0 && (
                  <div className="flex items-center justify-between bg-green-50 rounded-xl px-3 py-2">
                    <span className="text-xs text-green-700 font-medium">Earned</span>
                    <span className="text-sm font-bold text-green-700">
                      +{order.points_earned.toLocaleString()} pts
                    </span>
                  </div>
                )}
                {Number(order.points_earned) === 0 && order.status !== 'delivered' && (
                  <p className="text-xs text-gray-400">Points will be awarded when order is delivered.</p>
                )}
              </div>
            </SectionCard>
          )}

        </div>
      </div>
    </div>
  )
}
```


***

## What changed at a glance

- **Realtime pulse** — green dot in the header + Supabase channel subscription auto-updates the entire page when any field changes[^1]
- **Status timeline** — visual step-by-step progress with per-step timestamps pulled from `confirmed_at`, `preparing_at`, `delivered_at` etc.
- **Customer card** — avatar, full name, email (`mailto:` link), phone (`tel:` link), repeat order count, delivery address block
- **Customer notes** — amber banner at the top if `order.notes` is set
- **Loyalty section** — points redeemed (amber), points earned (green), pending message if not yet delivered
- **Points in price breakdown** — `points_discount` and `discount_amount` rows in the totals
- **Delivery booking inline** — Lalamove or EasyParcel book button appears directly on this page when status is `confirmed/preparing/ready` and no driver has been assigned yet
- **Driver card** — blue card with name, tappable phone number, plate number when Lalamove assigns a driver
- **Print invoice** — generates a clean, printable HTML invoice with all items, discounts, and totals in a new tab[^2]
- **Delivery type label** — emoji + human-readable label (🏍️ Instant, 📦 Courier, 🏃 Self Pickup)
<span style="display:none">[^10][^11][^12][^13][^14][^15][^3][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://wedding.alibaba.com/buyingguides/order-detail-page

[^2]: https://www.alibaba.com/product-insights/how-to-choose-the-best-order-detail-page-for-your-e-commerce-needs.html

[^3]: https://www.theoriginsolution.com/blog/2025-web-design-best-practices-for-ecommerce/

[^4]: https://www.scribd.com/document/953166203/Best-eCommerce-Website-Design-Tips-Examples-2025

[^5]: https://www.buzzinteractive.co/blog/ecommerce-website-design-best-practices

[^6]: https://digitalthriveai.com/en-gb/resources/web-design/best-practices-ecommerce-ui-design/

[^7]: https://www.mintsoft.com/order-management/key-features-of-an-order-management-system/

[^8]: https://www.bigcommerce.com/articles/ecommerce/product-detail-page/

[^9]: https://www.paidchain.my/top-5-features-you-should-expect-from-a-modern-merchant-dashboard/

[^10]: https://www.diginyze.com/blog/10-must-have-features-for-a-killer-ecommerce-order-management-system/

[^11]: https://baymard.com/blog/current-state-ecommerce-product-page-ux

[^12]: https://www.blue-alligator.com/2024/05/31/5-features-to-look-for-in-an-order-management-system/

[^13]: https://www.globalreach.com/global-reach-media/blog/2025/12/18/e-commerce-product-page-structure

[^14]: https://easternenterprise.com/essential-dashboard-features-to-enhance-your-retail-business-operations-and-drive-success/

[^15]: https://aratum.com/perspective/five-features-that-make-the-best-order-management-software-for-e-commerce-businesses/

