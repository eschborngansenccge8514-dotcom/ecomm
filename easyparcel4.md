<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Add a new page in merchant dashboard to fully manage easyparcel

I've fully read the EasyParcel Marketplace API v1.4.0.0 documentation.  It covers rate checking (`MPRateCheckingBulk`), order submission (`MPSubmitOrderBulk`, `EPSubmitOrderBulkV3`), order payment (`MPPayOrderBulk`), parcel status, tracking (`MPTrackingBulk`), credit balance, insurance, and more.  Here is the complete implementation.[^1]

***

## Step 1 — Database Migration

```sql
-- ── EasyParcel merchant settings ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS merchant_easyparcel_settings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id    uuid UNIQUE NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  api_key        text,               -- from registered EasyParcel account
  auth_key       text,               -- from EasyParcel IT administrator
  is_demo        boolean DEFAULT true,
  is_enabled     boolean DEFAULT false,
  -- Default sender address (pre-fills booking form)
  sender_name    text,
  sender_company text,
  sender_phone   text,
  sender_addr1   text,
  sender_addr2   text,
  sender_city    text,
  sender_state   text DEFAULT 'sgr',
  sender_postcode text,
  sender_country  text DEFAULT 'MY',
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
ALTER TABLE merchant_easyparcel_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchant manages own ep settings"
  ON merchant_easyparcel_settings FOR ALL TO authenticated
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

-- ── EasyParcel shipments ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS easyparcel_shipments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id      uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  order_id         uuid REFERENCES orders(id) ON DELETE SET NULL,
  -- EasyParcel identifiers
  ep_order_number  text,             -- e.g. EI-AAY69
  ep_parcel_number text,             -- e.g. EP-AOBH3
  awb              text,             -- airway bill / tracking number
  awb_id_link      text,             -- PDF label download link
  tracking_url     text,             -- direct tracking URL
  -- Service info
  courier_name     text,
  courier_short    text,
  service_id       text,
  service_name     text,
  -- Financial
  shipping_cost    numeric DEFAULT 0,
  tax_amount       numeric DEFAULT 0,
  addon_price      numeric DEFAULT 0,
  -- Status
  order_status     text DEFAULT 'Waiting Payment',
  ship_status      text DEFAULT 'Pending',
  -- Parcel details
  weight           numeric DEFAULT 0,
  width            numeric DEFAULT 0,
  length           numeric DEFAULT 0,
  height           numeric DEFAULT 0,
  content          text,
  declared_value   numeric DEFAULT 0,
  reference        text,
  collect_date     date,
  -- Addresses (denormalised for history)
  pick_name        text, pick_contact text,
  pick_addr1       text, pick_city text, pick_state text, pick_postcode text,
  send_name        text, send_contact text, send_email text,
  send_addr1       text, send_city text, send_state text, send_postcode text,
  -- Cached tracking events
  tracking_data    jsonb,
  tracking_updated_at timestamptz,
  is_demo          boolean DEFAULT false,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ep_shipments_merchant ON easyparcel_shipments(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ep_shipments_order    ON easyparcel_shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_ep_shipments_awb      ON easyparcel_shipments(awb);
ALTER TABLE easyparcel_shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchant manages own ep shipments"
  ON easyparcel_shipments FOR ALL TO authenticated
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));
```


***

## Step 2 — `src/lib/easyparcel.ts`

```typescript
// ── EasyParcel API helper ─────────────────────────────────────────────────────
export const EP_LIVE = 'https://connect.easyparcel.my/'
export const EP_DEMO = 'https://demo.connect.easyparcel.my/'

// PHP http_build_query–compatible serialiser (handles nested arrays)
export function phpBuildQuery(obj: any, prefix = ''): string {
  const parts: string[] = []
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => {
      const k = `${prefix}[${i}]`
      parts.push(typeof v === 'object' && v !== null ? phpBuildQuery(v, k) : `${enc(k)}=${enc(v)}`)
    })
  } else if (typeof obj === 'object' && obj !== null) {
    for (const [key, v] of Object.entries(obj)) {
      const k = prefix ? `${prefix}[${key}]` : key
      parts.push(typeof v === 'object' && v !== null ? phpBuildQuery(v, k) : `${enc(k)}=${enc(v)}`)
    }
  }
  return parts.join('&')
}
const enc = (v: any) => encodeURIComponent(String(v ?? ''))

export async function epPost(isDemo: boolean, action: string, params: Record<string, any>) {
  const base = isDemo ? EP_DEMO : EP_LIVE
  const res  = await fetch(`${base}?ac=${action}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    phpBuildQuery(params),
    cache:   'no-store',
  })
  if (!res.ok) throw new Error(`EasyParcel HTTP ${res.status}`)
  return res.json()
}

// ── Malaysian state codes ──────────────────────────────────────────────────────
export const MY_STATES: Record<string, string> = {
  jhr:'Johor', kdh:'Kedah', ktn:'Kelantan', mlk:'Melaka',
  nsn:'Negeri Sembilan', phg:'Pahang', prk:'Perak', pls:'Perlis',
  png:'Pulau Pinang', sgr:'Selangor', trg:'Terengganu',
  kul:'Kuala Lumpur', pjy:'Putra Jaya', srw:'Sarawak', sbh:'Sabah', lbn:'Labuan',
}
export const MY_STATE_OPTIONS = Object.entries(MY_STATES)
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name))

// ── Parcel status colour map ───────────────────────────────────────────────────
export function shipStatusMeta(status: string): { label: string; cls: string } {
  const s = status?.toLowerCase() ?? ''
  if (s.includes('delivered') || s.includes('successfully'))  return { label: 'Delivered',    cls: 'bg-green-100 text-green-700'  }
  if (s.includes('transit') || s.includes('delivering'))       return { label: 'In Transit',   cls: 'bg-blue-100 text-blue-700'    }
  if (s.includes('collected'))                                  return { label: 'Collected',    cls: 'bg-blue-100 text-blue-700'    }
  if (s.includes('drop off'))                                   return { label: 'Dropped Off',  cls: 'bg-purple-100 text-purple-700'}
  if (s.includes('pending') || s.includes('arrangement'))      return { label: 'Pending',      cls: 'bg-amber-100 text-amber-700'  }
  if (s.includes('waiting'))                                    return { label: 'Awaiting Pay', cls: 'bg-orange-100 text-orange-700'}
  if (s.includes('cancel'))                                     return { label: 'Cancelled',    cls: 'bg-red-100 text-red-600'      }
  if (s.includes('returned') || s.includes('return'))          return { label: 'Returned',     cls: 'bg-red-100 text-red-700'      }
  return { label: status || 'Unknown', cls: 'bg-gray-100 text-gray-500' }
}

// ── Courier logo helper ────────────────────────────────────────────────────────
export const COURIER_EMOJI: Record<string, string> = {
  'poslaju': '📮', 'pos laju': '📮', 'skynet': '🟠', 'dhl': '📦',
  'nationwide': '🚚', 'j&t': '🔴', 'ninja': '🥷', 'best': '⭐',
  'flash': '⚡', 'city-link': '🔵', 'aramex': '🟡', 'cj century': '🟢',
}
export function courierEmoji(name: string): string {
  const n = name.toLowerCase()
  for (const [key, emoji] of Object.entries(COURIER_EMOJI)) {
    if (n.includes(key)) return emoji
  }
  return '📦'
}
```


***

## Step 3 — API Routes

### `src/app/api/easyparcel/rates/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient }   from '@/lib/supabase/server'
import { epPost }         from '@/lib/easyparcel'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { merchantId, bulk } = await req.json()

  const { data: cfg } = await supabase
    .from('merchant_easyparcel_settings')
    .select('api_key, auth_key, is_demo')
    .eq('merchant_id', merchantId).single()
  if (!cfg?.api_key) return NextResponse.json({ error: 'EasyParcel not configured' }, { status: 400 })

  const result = await epPost(cfg.is_demo, 'MPRateCheckingBulk', {
    authentication: cfg.auth_key,
    api:            cfg.api_key,
    bulk,
    exclude_fields: ['rates.*.pickup_point'],
  })
  return NextResponse.json(result)
}
```


### `src/app/api/easyparcel/book/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient }   from '@/lib/supabase/server'
import { epPost }         from '@/lib/easyparcel'
import { format }         from 'date-fns'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { merchantId, orderId, parcel, couriers, dropoff } = await req.json()
  // parcel: { weight, width, length, height, content, value, collect_date,
  //           pick_*, send_*, reference }

  const { data: cfg } = await supabase
    .from('merchant_easyparcel_settings')
    .select('*').eq('merchant_id', merchantId).single()
  if (!cfg?.api_key) return NextResponse.json({ error: 'EasyParcel not configured' }, { status: 400 })

  const collectDate = parcel.collect_date || format(new Date(), 'yyyy-MM-dd')

  // EPSubmitOrderBulkV3 — direct order + payment in one call
  const result = await epPost(cfg.is_demo, 'EPSubmitOrderBulkV3', {
    authentication: cfg.auth_key,
    api:            cfg.api_key,
    courier:        couriers ?? ['Poslaju', 'Skynet', 'Nationwide', 'J&T Express', 'DHL eCommerce'],
    dropoff:        dropoff ? 1 : 0,
    bulk: [{
      referrence:    parcel.reference ?? `ORD-${orderId?.slice(0,8) ?? Date.now()}`,
      weight:        parcel.weight,
      width:         parcel.width  || 0,
      length:        parcel.length || 0,
      height:        parcel.height || 0,
      content:       parcel.content,
      value:         parcel.value,
      pick_name:     parcel.pick_name,
      pick_company:  parcel.pick_company ?? '',
      pick_contact:  parcel.pick_contact,
      pick_mobile:   parcel.pick_mobile  ?? '',
      pick_addr1:    parcel.pick_addr1,
      pick_addr2:    parcel.pick_addr2   ?? '',
      pick_city:     parcel.pick_city,
      pick_state:    parcel.pick_state,
      pick_code:     parcel.pick_postcode,
      pick_country:  'MY',
      send_name:     parcel.send_name,
      send_contact:  parcel.send_contact,
      send_mobile:   parcel.send_mobile  ?? '',
      send_addr1:    parcel.send_addr1,
      send_addr2:    parcel.send_addr2   ?? '',
      send_city:     parcel.send_city,
      send_state:    parcel.send_state,
      send_code:     parcel.send_postcode,
      send_country:  'MY',
      collect_date:  collectDate,
      send_email:    parcel.send_email   ?? '',
      sms:           1,
    }],
  })

  if (result.api_status !== 'Success') {
    return NextResponse.json({ error: result.error_remark }, { status: 400 })
  }

  const success = result.result?.success?.[^0]
  if (!success) {
    const fail = result.result?.fail?.[^0]
    return NextResponse.json({ error: fail?.remarks ?? 'Booking failed' }, { status: 400 })
  }

  // Save to easyparcel_shipments
  const { data: saved, error: dbErr } = await supabase.from('easyparcel_shipments').insert({
    merchant_id:      merchantId,
    order_id:         orderId ?? null,
    ep_order_number:  success.order_number,
    ep_parcel_number: success.parcel_number,
    awb:              success.awb,
    awb_id_link:      success.awb_id_link,
    tracking_url:     success.tracking_url,
    courier_name:     success.courier,
    courier_short:    success.courier_short,
    shipping_cost:    Number(success.price)      || 0,
    tax_amount:       Number(success.tax)        || 0,
    addon_price:      Number(success.addon_price)|| 0,
    order_status:     'Paid',
    ship_status:      'Pending For Collection',
    weight:           parcel.weight,
    width:            parcel.width   || 0,
    length:           parcel.length  || 0,
    height:           parcel.height  || 0,
    content:          parcel.content,
    declared_value:   parcel.value,
    reference:        parcel.reference ?? '',
    collect_date:     collectDate,
    pick_name:        parcel.pick_name,    pick_contact: parcel.pick_contact,
    pick_addr1:       parcel.pick_addr1,   pick_city:    parcel.pick_city,
    pick_state:       parcel.pick_state,   pick_postcode:parcel.pick_postcode,
    send_name:        parcel.send_name,    send_contact: parcel.send_contact,
    send_email:       parcel.send_email,
    send_addr1:       parcel.send_addr1,   send_city:    parcel.send_city,
    send_state:       parcel.send_state,   send_postcode:parcel.send_postcode,
    is_demo:          cfg.is_demo,
  }).select('id').single()
  if (dbErr) console.error('EP save error:', dbErr)

  // Update order with AWB
  if (orderId && success.awb) {
    await supabase.from('orders').update({
      tracking_number: success.awb,
      shipping_status: 'shipped',
      courier:         success.courier_short ?? success.courier,
    }).eq('id', orderId)
  }

  return NextResponse.json({ ok: true, shipment: { ...success, db_id: saved?.id } })
}
```


### `src/app/api/easyparcel/track/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { epPost }       from '@/lib/easyparcel'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { merchantId, awbNumbers, shipmentId } = await req.json()

  const { data: cfg } = await supabase
    .from('merchant_easyparcel_settings')
    .select('api_key, auth_key, is_demo')
    .eq('merchant_id', merchantId).single()
  if (!cfg?.api_key) return NextResponse.json({ error: 'Not configured' }, { status: 400 })

  const bulk  = awbNumbers.map((awb: string) => ({ awb_no: awb }))
  const result = await epPost(cfg.is_demo, 'MPTrackingBulk', {
    authentication: cfg.auth_key,
    api:            cfg.api_key,
    bulk,
  })

  // Cache tracking data
  if (result.api_status === 'Success' && shipmentId && result.result?.[^0]) {
    await supabase.from('easyparcel_shipments').update({
      tracking_data:       result.result[^0],
      ship_status:         result.result[^0].latest_status ?? undefined,
      tracking_updated_at: new Date().toISOString(),
    }).eq('id', shipmentId)
  }

  return NextResponse.json(result)
}
```


### `src/app/api/easyparcel/balance/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { epPost }       from '@/lib/easyparcel'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { merchantId } = await req.json()
  const { data: cfg }  = await supabase
    .from('merchant_easyparcel_settings')
    .select('api_key, is_demo')
    .eq('merchant_id', merchantId).single()
  if (!cfg?.api_key) return NextResponse.json({ error: 'Not configured' }, { status: 400 })

  // EPCheckCreditBalance does NOT need authentication key
  const result = await epPost(cfg.is_demo, 'EPCheckCreditBalance', { api: cfg.api_key })
  return NextResponse.json(result)
}
```


### `src/app/api/easyparcel/status/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { epPost }       from '@/lib/easyparcel'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { merchantId, orderNumbers, shipmentIds } = await req.json()
  const { data: cfg } = await supabase
    .from('merchant_easyparcel_settings')
    .select('api_key, auth_key, is_demo')
    .eq('merchant_id', merchantId).single()
  if (!cfg?.api_key) return NextResponse.json({ error: 'Not configured' }, { status: 400 })

  const bulk   = orderNumbers.map((order_no: string) => ({ order_no }))
  const result = await epPost(cfg.is_demo, 'MPParcelStatusBulk', {
    authentication: cfg.auth_key,
    api:            cfg.api_key,
    bulk,
  })

  // Update statuses in DB
  if (result.api_status === 'Success' && result.result) {
    for (let i = 0; i < result.result.length; i++) {
      const r = result.result[i]
      const parcel = r.parcel?.[^0]
      if (shipmentIds?.[i] && parcel) {
        await supabase.from('easyparcel_shipments').update({
          order_status: r.status,
          ship_status:  parcel.ship_status ?? undefined,
          awb:          parcel.awb || undefined,
          awb_id_link:  parcel.awb_id_link || undefined,
          updated_at:   new Date().toISOString(),
        }).eq('id', shipmentIds[i])
      }
    }
  }

  return NextResponse.json(result)
}
```


### `src/app/api/easyparcel/settings/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const merchantId = req.nextUrl.searchParams.get('merchantId')
  const { data } = await supabase
    .from('merchant_easyparcel_settings')
    .select('*').eq('merchant_id', merchantId!).single()
  return NextResponse.json(data ?? {})
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const { error } = await supabase.from('merchant_easyparcel_settings').upsert(
    { ...body, merchant_id: body.merchantId, updated_at: new Date().toISOString() },
    { onConflict: 'merchant_id' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
```


***

## Step 4 — `src/app/(dashboard)/shipping/easyparcel/page.tsx`

```typescript
import { getMerchant }    from '@/lib/utils.server'
import { EasyParcelClient } from '@/components/dashboard/EasyParcelClient'

export default async function EasyParcelPage() {
  const { supabase, merchant } = await getMerchant()

  const [{ data: settings }, { data: shipments }, { data: pendingOrders }] = await Promise.all([
    supabase.from('merchant_easyparcel_settings').select('*').eq('merchant_id', merchant.id).single(),
    supabase.from('easyparcel_shipments')
      .select('*, orders(order_number, customer_name)')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false })
      .limit(100),
    // Orders that need shipping and don't have an EP shipment yet
    supabase.from('orders')
      .select('id, order_number, customer_name, customer_email, customer_phone, shipping_address, total_amount, created_at')
      .eq('merchant_id', merchant.id)
      .in('status', ['processing', 'confirmed'])
      .is('tracking_number', null)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return (
    <EasyParcelClient
      merchantId={merchant.id}
      merchant={merchant}
      initialSettings={settings ?? null}
      initialShipments={(shipments as any[]) ?? []}
      pendingOrders={(pendingOrders as any[]) ?? []}
    />
  )
}
```


***

## Step 5 — `src/components/dashboard/EasyParcelClient.tsx`

```typescript
'use client'
import { useState, useCallback } from 'react'
import { useRouter }   from 'next/navigation'
import { Input }       from '@/components/ui/input'
import { Button }      from '@/components/ui/button'
import { cn }          from '@/lib/utils'
import toast           from 'react-hot-toast'
import { format }      from 'date-fns'
import { MY_STATE_OPTIONS, MY_STATES, shipStatusMeta, courierEmoji } from '@/lib/easyparcel'
import {
  Package, Truck, Calculator, Settings2, RefreshCw, Eye, EyeOff,
  ExternalLink, Download, Search, CheckCircle2, XCircle,
  Wallet, Loader2, Plus, ChevronRight, ArrowLeft, Info,
} from 'lucide-react'

const rm = (v: any) => `RM ${Number(v ?? 0).toFixed(2)}`
const n  = (v: any) => Number(v ?? 0)

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id:'overview',  icon: <Package size={14}/>,    label:'Overview'       },
  { id:'book',      icon: <Truck size={14}/>,      label:'Book Shipments' },
  { id:'shipments', icon: <CheckCircle2 size={14}/>,label:'Shipments'     },
  { id:'rates',     icon: <Calculator size={14}/>, label:'Rate Calculator'},
  { id:'settings',  icon: <Settings2 size={14}/>,  label:'Settings'       },
]

// ─── Rate card ────────────────────────────────────────────────────────────────
function RateCard({ rate, onSelect, selected }: { rate: any; onSelect?: () => void; selected?: boolean }) {
  return (
    <div onClick={onSelect}
      className={cn('flex items-center gap-3 p-3 rounded-xl border-2 transition-all',
        onSelect && 'cursor-pointer',
        selected ? 'border-blue-600 bg-blue-50' : 'border-gray-100 hover:border-gray-300')}>
      <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-xl shrink-0">
        {rate.courier_logo
          ? <img src={rate.courier_logo} alt={rate.courier_name} className="w-9 h-9 object-contain rounded-lg" />
          : <span>{courierEmoji(rate.courier_name ?? '')}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 text-sm truncate">{rate.courier_name}</p>
        <p className="text-xs text-gray-400 truncate">{rate.service_name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md">{rate.service_detail}</span>
          <span className="text-xs text-gray-400">{rate.delivery}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-blue-600 text-lg">{rm(rate.price)}</p>
        {n(rate.addon_price) > 0 && (
          <p className="text-xs text-gray-400">+{rm(rate.addon_price)} addon</p>
        )}
      </div>
      {selected && <CheckCircle2 size={18} className="text-blue-600 shrink-0" />}
    </div>
  )
}

// ─── Tracking modal ───────────────────────────────────────────────────────────
function TrackingModal({ shipment, merchantId, onClose }: {
  shipment: any; merchantId: string; onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [data,    setData]    = useState<any>(shipment.tracking_data)

  const refresh = async () => {
    setLoading(true)
    const res = await fetch('/api/easyparcel/track', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId, awbNumbers: [shipment.awb], shipmentId: shipment.id }),
    })
    const json = await res.json()
    if (json.result?.[^0]) setData(json.result[^0])
    else toast.error('Tracking not available yet')
    setLoading(false)
  }

  const statusList = data?.status_list
    ? Object.values(data.status_list).filter((v: any) => v?.event_date)
    : []

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-bold">Tracking Parcel</p>
            <p className="text-blue-200 text-sm font-mono">{shipment.awb}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh} disabled={loading}
              className="text-blue-200 hover:text-white transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="text-blue-200 hover:text-white transition-colors text-xl font-bold">×</button>
          </div>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {/* Current status */}
          {data?.latest_status && (
            <div className="bg-blue-50 rounded-2xl p-4 mb-4 text-center">
              <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">Current Status</p>
              <p className="font-bold text-blue-900 text-lg mt-1">{data.latest_status}</p>
              {data.latest_update && (
                <p className="text-xs text-blue-500 mt-0.5">Updated: {data.latest_update}</p>
              )}
            </div>
          )}

          {/* Sender / Receiver */}
          {(data?.status_list?.status_list?.sender || data?.status_list?.sender) && (
            <div className="flex gap-3 mb-4 text-xs">
              <div className="flex-1 bg-gray-50 rounded-xl p-3">
                <p className="text-gray-400 mb-0.5">From</p>
                <p className="font-semibold text-gray-800">{shipment.pick_name}</p>
              </div>
              <div className="flex-1 bg-gray-50 rounded-xl p-3">
                <p className="text-gray-400 mb-0.5">To</p>
                <p className="font-semibold text-gray-800">{shipment.send_name}</p>
              </div>
            </div>
          )}

          {/* Timeline */}
          {statusList.length > 0 ? (
            <div className="space-y-0">
              {(statusList as any[]).reverse().map((event: any, i: number) => (
                <div key={i} className="flex items-start gap-3 pb-4 relative">
                  <div className="flex flex-col items-center shrink-0">
                    <div className={cn('w-3 h-3 rounded-full mt-0.5',
                      i === 0 ? 'bg-blue-600' : 'bg-gray-200')} />
                    {i < statusList.length - 1 && (
                      <div className="w-0.5 bg-gray-100 flex-1 mt-1 min-h-[20px]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-semibold', i === 0 ? 'text-blue-700' : 'text-gray-700')}>
                      {event.status}
                    </p>
                    {event.location && (
                      <p className="text-xs text-gray-400">{event.location}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {event.event_date} {event.event_time && `· ${event.event_time}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">📦</p>
              <p className="text-gray-500 text-sm">No tracking events yet</p>
              <Button size="sm" onClick={refresh} className="mt-3" disabled={loading}>
                {loading ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
                Refresh Tracking
              </Button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
          {shipment.awb_id_link && (
            <a href={shipment.awb_id_link} target="_blank"
              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
              <Download size={14} /> Print Label
            </a>
          )}
          {shipment.tracking_url && (
            <a href={shipment.tracking_url} target="_blank"
              className="flex-1 flex items-center justify-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-semibold py-2.5 rounded-xl transition-colors border border-gray-200">
              <ExternalLink size={14} /> Track on EasyParcel
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Book shipment modal ──────────────────────────────────────────────────────
function BookShipmentModal({ order, merchantId, settings, onClose, onSuccess }: {
  order: any; merchantId: string; settings: any; onClose: () => void
  onSuccess: (shipment: any) => void
}) {
  const [step,    setStep]    = useState<'details'|'rates'|'done'>('details')
  const [loading, setLoading] = useState(false)
  const [rates,   setRates]   = useState<any[]>([])

  const addr = order.shipping_address ?? {}

  // Parcel details
  const [weight,   setWeight]   = useState('1')
  const [width,    setWidth]    = useState('0')
  const [length,   setLength]   = useState('0')
  const [height,   setHeight]   = useState('0')
  const [content,  setContent]  = useState('')
  const [value,    setValue]    = useState(String(n(order.total_amount).toFixed(2)))
  const [pickDate, setPickDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [dropoff,  setDropoff]  = useState(false)

  // Couriers (ordered preference)
  const [couriers, setCouriers] = useState<string[]>(['Poslaju','J&T Express','Skynet','DHL eCommerce','Nationwide'])

  const checkRates = async () => {
    if (!weight || Number(weight) <= 0) { toast.error('Enter parcel weight'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/easyparcel/rates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId,
          bulk: [{
            pick_code:    settings.sender_postcode,
            pick_state:   settings.sender_state,
            pick_country: 'MY',
            send_code:    addr.postcode,
            send_state:   addr.state,
            send_country: 'MY',
            weight:       Number(weight),
            width:        Number(width)  || 0,
            length:       Number(length) || 0,
            height:       Number(height) || 0,
            date_coll:    pickDate,
          }],
        }),
      })
      const json = await res.json()
      const ratesList = json.result?.[^0]?.rates ?? []
      if (!ratesList.length) { toast.error('No rates available for this route'); return }
      setRates(ratesList.sort((a: any, b: any) => n(a.price) - n(b.price)))
      setStep('rates')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const bookShipment = async () => {
    if (!content.trim()) { toast.error('Enter parcel content description'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/easyparcel/book', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId,
          orderId: order.id,
          couriers,
          dropoff,
          parcel: {
            weight: Number(weight), width: Number(width),
            length: Number(length), height: Number(height),
            content, value: Number(value),
            collect_date: pickDate,
            reference: order.order_number,
            // Sender
            pick_name:     settings.sender_name,
            pick_company:  settings.sender_company,
            pick_contact:  settings.sender_phone,
            pick_addr1:    settings.sender_addr1,
            pick_addr2:    settings.sender_addr2,
            pick_city:     settings.sender_city,
            pick_state:    settings.sender_state,
            pick_postcode: settings.sender_postcode,
            // Receiver
            send_name:     order.customer_name,
            send_contact:  order.customer_phone,
            send_email:    order.customer_email,
            send_addr1:    addr.address_line1 ?? addr.addr1,
            send_addr2:    addr.address_line2 ?? addr.addr2 ?? '',
            send_city:     addr.city,
            send_state:    addr.state,
            send_postcode: addr.postcode,
          },
        }),
      })
      const json = await res.json()
      if (!json.ok) { toast.error(json.error ?? 'Booking failed'); return }
      toast.success(`Booked! AWB: ${json.shipment.awb}`)
      setStep('done')
      onSuccess(json.shipment)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const ALL_COURIERS = ['Poslaju','J&T Express','Skynet','DHL eCommerce','Nationwide','ABX','Aramex','CJ Century','Flash Express','Ninjavan']
  const toggleCourier = (c: string) =>
    setCouriers(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 shrink-0">
          {step !== 'details' && step !== 'done' && (
            <button onClick={() => setStep('details')} className="text-gray-400 hover:text-gray-700">
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="flex-1">
            <h3 className="font-bold text-gray-900">Book Shipment</h3>
            <p className="text-xs text-gray-400">Order #{order.order_number} · {order.customer_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl font-bold shrink-0">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ── Done ─────────────────────────────────────────── */}
          {step === 'done' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Shipment Booked!</h3>
              <p className="text-gray-500 text-sm">The label is ready to print and tracking is active.</p>
              <Button onClick={onClose} className="mt-6 w-full">Close</Button>
            </div>
          )}

          {/* ── Details ─────────────────────────────────────── */}
          {step === 'details' && (
            <>
              {/* Receiver address preview */}
              <div className="bg-gray-50 rounded-2xl p-4">
                <p className="text-xs font-bold text-gray-400 mb-2">SHIP TO</p>
                <p className="font-semibold text-gray-800 text-sm">{order.customer_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {[addr.address_line1 ?? addr.addr1, addr.city, MY_STATES[addr.state] ?? addr.state, addr.postcode]
                    .filter(Boolean).join(', ')}
                </p>
                {order.customer_phone && <p className="text-xs text-gray-400 mt-0.5">{order.customer_phone}</p>}
              </div>

              {/* Parcel details */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-800">Parcel Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Weight (kg) *</label>
                    <Input type="number" min="0.1" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Declared Value (RM) *</label>
                    <Input type="number" value={value} onChange={e => setValue(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Length (cm)</label>
                    <Input type="number" value={length} onChange={e => setLength(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Width (cm)</label>
                    <Input type="number" value={width} onChange={e => setWidth(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Height (cm)</label>
                    <Input type="number" value={height} onChange={e => setHeight(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Content *</label>
                  <Input value={content} onChange={e => setContent(e.target.value)}
                    placeholder="e.g. Clothing, Electronics, Books" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Pickup Date *</label>
                    <Input type="date" value={pickDate} min={format(new Date(), 'yyyy-MM-dd')}
                      onChange={e => setPickDate(e.target.value)} />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <button type="button" onClick={() => setDropoff(!dropoff)}
                        className={cn('w-10 h-5 rounded-full transition-colors', dropoff ? 'bg-blue-600' : 'bg-gray-200')}>
                        <div className={cn('w-4 h-4 bg-white rounded-full shadow mx-0.5 transition-transform', dropoff ? 'translate-x-5' : '')} />
                      </button>
                      <span className="text-xs font-semibold text-gray-600">Drop-off</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Courier preference */}
              <div>
                <h4 className="text-sm font-bold text-gray-800 mb-2">Courier Preference <span className="text-gray-400 font-normal">(ranked 1st choice = best)</span></h4>
                <div className="flex flex-wrap gap-2">
                  {ALL_COURIERS.map(c => (
                    <button key={c} type="button" onClick={() => toggleCourier(c)}
                      className={cn('text-xs font-semibold px-3 py-1.5 rounded-full border-2 transition-all',
                        couriers.includes(c)
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-400')}>
                      {couriers.includes(c) && <span className="mr-1 text-xs">{couriers.indexOf(c) + 1}.</span>}
                      {c}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">System uses the first available courier from your list.</p>
              </div>
            </>
          )}

          {/* ── Rates ────────────────────────────────────────── */}
          {step === 'rates' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-800">{rates.length} rates available</h4>
                <span className="text-xs text-gray-400">{weight}kg · {settings.sender_postcode} → {addr.postcode}</span>
              </div>
              {rates.map((rate, i) => (
                <RateCard key={i} rate={rate} />
              ))}
              <div className="bg-blue-50 rounded-xl p-3 flex gap-2">
                <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Click "Book & Pay" to auto-book using your courier preference order. The system selects the first available courier from your list.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'done' && (
          <div className="px-5 py-4 border-t border-gray-100 flex gap-2 shrink-0">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            {step === 'details' && (
              <Button className="flex-1" onClick={checkRates} disabled={loading || !settings.sender_postcode}>
                {loading ? <Loader2 size={13} className="animate-spin mr-1.5" /> : null}
                Check Rates <ChevronRight size={14} />
              </Button>
            )}
            {step === 'rates' && (
              <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={bookShipment} disabled={loading || !content.trim()}>
                {loading ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <Truck size={14} className="mr-1.5" />}
                Book & Pay Now
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function EasyParcelClient({ merchantId, merchant, initialSettings, initialShipments, pendingOrders }: {
  merchantId: string; merchant: any
  initialSettings: any; initialShipments: any[]; pendingOrders: any[]
}) {
  const router   = useRouter()
  const [tab,       setTab]       = useState('overview')
  const [settings,  setSettings]  = useState(initialSettings)
  const [shipments, setShipments] = useState(initialShipments)
  const [pending,   setPending]   = useState(pendingOrders)
  const [balance,   setBalance]   = useState<string | null>(null)
  const [loadBal,   setLoadBal]   = useState(false)
  const [bookOrder, setBookOrder] = useState<any | null>(null)
  const [trackShip, setTrackShip] = useState<any | null>(null)

  const isConfigured = !!(settings?.api_key && settings?.sender_postcode)

  // ── Load credit balance ───────────────────────────────────────────────────
  const fetchBalance = async () => {
    setLoadBal(true)
    const res = await fetch('/api/easyparcel/balance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId }),
    })
    const json = await res.json()
    if (json.api_status === 'Success') setBalance(json.result)
    else toast.error(json.error_remark ?? 'Failed to fetch balance')
    setLoadBal(false)
  }

  // ── Refresh shipment status ───────────────────────────────────────────────
  const refreshStatus = async (ship: any) => {
    if (!ship.ep_order_number) return
    const res = await fetch('/api/easyparcel/status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantId,
        orderNumbers: [ship.ep_order_number],
        shipmentIds:  [ship.id],
      }),
    })
    const json = await res.json()
    if (json.api_status === 'Success') {
      toast.success('Status refreshed')
      router.refresh()
    } else {
      toast.error(json.error_remark ?? 'Refresh failed')
    }
  }

  const onBookSuccess = (shipment: any) => {
    setBookOrder(null)
    setPending(p => p.filter(o => o.id !== bookOrder?.id))
    router.refresh()
  }

  // ─── Settings tab ─────────────────────────────────────────────────────────
  const SettingsTab = () => {
    const [form,     setForm]     = useState({ ...settings })
    const [saving,   setSaving]   = useState(false)
    const [testing,  setTesting]  = useState(false)
    const [showKeys, setShowKeys] = useState({ api: false, auth: false })
    const sf = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }))

    const save = async () => {
      setSaving(true)
      const res = await fetch('/api/easyparcel/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, merchantId }),
      })
      if (res.ok) { toast.success('Settings saved'); setSettings(form) }
      else toast.error('Save failed')
      setSaving(false)
    }

    const testConnection = async () => {
      if (!form.api_key) { toast.error('Enter API key first'); return }
      setTesting(true)
      const res = await fetch('/api/easyparcel/balance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId }),
      })
      const json = await res.json()
      if (json.api_status === 'Success') {
        toast.success(`✅ Connected! Balance: RM ${json.result}`)
        setBalance(json.result)
      } else {
        toast.error(`❌ ${json.error_remark ?? 'Connection failed'}`)
      }
      setTesting(false)
    }

    const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-1.5">{label}</label>
        {children}
        {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      </div>
    )

    return (
      <div className="space-y-5 max-w-2xl">
        {/* API Keys */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900">API Credentials</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Mode:</span>
              <button type="button"
                onClick={() => sf('is_demo', !form.is_demo)}
                className={cn('text-xs font-bold px-3 py-1 rounded-full transition-colors',
                  form.is_demo ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700')}>
                {form.is_demo ? '🔧 Demo' : '🚀 Live'}
              </button>
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl p-3 flex gap-2">
            <Info size={13} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">
              Get your <strong>API Key</strong> from your EasyParcel account settings, and your <strong>Authentication Key</strong> from the EasyParcel IT administrator.
              {form.is_demo && ' Currently using the Demo environment — switch to Live for real transactions.'}
            </p>
          </div>

          <Field label="API Key" hint="From your EasyParcel account · Settings → API">
            <div className="relative">
              <Input type={showKeys.api ? 'text' : 'password'} value={form.api_key ?? ''}
                onChange={e => sf('api_key', e.target.value)}
                placeholder="EP API key" className="pr-10 font-mono" />
              <button type="button"
                onClick={() => setShowKeys(p => ({ ...p, api: !p.api }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                {showKeys.api ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>

          <Field label="Authentication Key" hint="Obtain from EasyParcel IT administrator">
            <div className="relative">
              <Input type={showKeys.auth ? 'text' : 'password'} value={form.auth_key ?? ''}
                onChange={e => sf('auth_key', e.target.value)}
                placeholder="EP Auth key" className="pr-10 font-mono" />
              <button type="button"
                onClick={() => setShowKeys(p => ({ ...p, auth: !p.auth }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                {showKeys.auth ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={testConnection} disabled={testing}
              className="flex items-center gap-1.5">
              {testing ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              Test Connection
            </Button>
            {balance !== null && (
              <div className="flex items-center gap-1.5 bg-green-50 text-green-700 text-sm font-bold px-3 py-1.5 rounded-xl">
                <Wallet size={13} /> Balance: RM {Number(balance).toFixed(2)}
              </div>
            )}
          </div>
        </div>

        {/* Default sender address */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h3 className="font-bold text-gray-900">Default Sender Address</h3>
          <p className="text-xs text-gray-400 -mt-2">Pre-fills all booking forms. Make sure this matches your EasyParcel pickup address.</p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Sender Name *">
              <Input value={form.sender_name ?? ''} onChange={e => sf('sender_name', e.target.value)}
                placeholder="Your name / company" />
            </Field>
            <Field label="Company">
              <Input value={form.sender_company ?? ''} onChange={e => sf('sender_company', e.target.value)}
                placeholder="Optional" />
            </Field>
            <Field label="Phone *">
              <Input value={form.sender_phone ?? ''} onChange={e => sf('sender_phone', e.target.value)}
                placeholder="+601X-XXXXXXXX" />
            </Field>
            <Field label="Postcode *">
              <Input value={form.sender_postcode ?? ''} onChange={e => sf('sender_postcode', e.target.value)}
                placeholder="e.g. 47500" className="font-mono" />
            </Field>
          </div>
          <Field label="Address Line 1 *">
            <Input value={form.sender_addr1 ?? ''} onChange={e => sf('sender_addr1', e.target.value)}
              placeholder="Street address" />
          </Field>
          <Field label="Address Line 2">
            <Input value={form.sender_addr2 ?? ''} onChange={e => sf('sender_addr2', e.target.value)}
              placeholder="Building, unit, etc." />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City *">
              <Input value={form.sender_city ?? ''} onChange={e => sf('sender_city', e.target.value)}
                placeholder="e.g. Petaling Jaya" />
            </Field>
            <Field label="State *">
              <select value={form.sender_state ?? 'sgr'} onChange={e => sf('sender_state', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                {MY_STATE_OPTIONS.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="w-full max-w-sm">
          {saving ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
          Save Settings
        </Button>
      </div>
    )
  }

  // ─── Rate calculator tab ──────────────────────────────────────────────────
  const RateCalculatorTab = () => {
    const [fromPostcode, setFromPostcode] = useState(settings?.sender_postcode ?? '')
    const [fromState,    setFromState]    = useState(settings?.sender_state    ?? 'sgr')
    const [toPostcode,   setToPostcode]   = useState('')
    const [toState,      setToState]      = useState('kul')
    const [weight,       setWeight]       = useState('1')
    const [date,         setDate]         = useState(format(new Date(), 'yyyy-MM-dd'))
    const [loading,      setLoading]      = useState(false)
    const [results,      setResults]      = useState<any[]>([])

    const check = async () => {
      if (!fromPostcode || !toPostcode || !weight) { toast.error('Fill in all required fields'); return }
      setLoading(true)
      const res = await fetch('/api/easyparcel/rates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId,
          bulk: [{ pick_code:fromPostcode, pick_state:fromState, pick_country:'MY',
            send_code:toPostcode, send_state:toState, send_country:'MY',
            weight:Number(weight), date_coll:date }],
        }),
      })
      const json = await res.json()
      if (json.api_status !== 'Success') { toast.error(json.error_remark); setLoading(false); return }
      const rates = json.result?.[^0]?.rates ?? []
      setResults(rates.sort((a: any, b: any) => n(a.price) - n(b.price)))
      setLoading(false)
    }

    return (
      <div className="space-y-5 max-w-2xl">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-4">Check Shipping Rates</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">From Postcode *</label>
              <Input value={fromPostcode} onChange={e => setFromPostcode(e.target.value)}
                placeholder="e.g. 47500" className="font-mono" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">From State *</label>
              <select value={fromState} onChange={e => setFromState(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                {MY_STATE_OPTIONS.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">To Postcode *</label>
              <Input value={toPostcode} onChange={e => setToPostcode(e.target.value)}
                placeholder="e.g. 50450" className="font-mono" />
            </div>
            <div>
              <label className="text-xs font-semibold


<div align="center">⁂</div>

[^1]: Malaysia_MarketPlace_1.4.0.0.pdf```

