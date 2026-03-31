<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# I think we missing an option for customer to choose delivery method

Good catch. Right now delivery booking is merchant-side only — customers never see delivery options or prices at checkout. Here's the complete fix: a pre-order quote lookup and a full delivery picker inside the checkout screen.

***

## What's Changing

```
BEFORE:
  Checkout → Place Order → Merchant sees order → Merchant books delivery

AFTER:
  Checkout → Customer picks delivery method + sees live price
           → Total updates in real time
           → Order is created with delivery_fee already set
           → Merchant just confirms the booking
```


***

## File 1 — New Edge Function: `supabase/functions/get-delivery-quotes/index.ts`

This takes raw address data instead of an order ID, so it works **before** the order exists.

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildLalamoveHeaders, getLalamoveBaseUrl } from '../_shared/lalamove-auth.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const STATE_CODES: Record<string, string> = {
  'Johor': 'jhr', 'Kedah': 'kd', 'Kelantan': 'ktn', 'Melaka': 'mlk',
  'Negeri Sembilan': 'nsn', 'Pahang': 'phg', 'Perak': 'prk', 'Perlis': 'pls',
  'Pulau Pinang': 'png', 'Sabah': 'sbh', 'Sarawak': 'srw', 'Selangor': 'sgr',
  'Terengganu': 'trg', 'W.P. Kuala Lumpur': 'kul', 'W.P. Labuan': 'lbn',
  'W.P. Putrajaya': 'pjy',
}
function stateCode(s: string) { return STATE_CODES[s] ?? s.toLowerCase().slice(0, 3) }

const LALAMOVE_SERVICES = [
  { id: 'MOTORCYCLE', label: 'Motorbike',   emoji: '🏍️', maxKg: 10,   description: 'Up to 10 kg · 15–45 min' },
  { id: 'SEDAN',      label: 'Sedan',       emoji: '🚗', maxKg: 200,  description: 'Up to 200 kg · 20–60 min' },
  { id: 'VAN',        label: 'Van',         emoji: '🚐', maxKg: 500,  description: 'Up to 500 kg · 30–75 min' },
]

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // Accepts raw pickup + dropoff details — no order ID needed yet
    const {
      merchantId,
      deliveryAddress,   // { line1, line2, city, state, postcode, lat?, lng? }
      totalWeightKg,     // pre-calculated from cart
      parcelValue,       // order subtotal
    } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: merchant } = await supabase
      .from('merchants')
      .select('address_line1, city, state, postcode, phone, lat, lng')
      .eq('id', merchantId)
      .single()

    if (!merchant) throw new Error('Merchant not found')

    const weightKg  = Math.max(Number(totalWeightKg) || 0.5, 0.1)
    const isProd    = Deno.env.get('DELIVERY_ENV') === 'production'

    // ── Lalamove quotes (run in parallel per service type) ──────────────────
    const apiKey    = Deno.env.get('LALAMOVE_API_KEY')!
    const apiSecret = Deno.env.get('LALAMOVE_API_SECRET')!
    const lalaBase  = getLalamoveBaseUrl()
    const lalaPath  = '/v3/quotations'

    const lalamoveQuotes = await Promise.all(
      LALAMOVE_SERVICES.map(async (svc) => {
        const body = JSON.stringify({
          data: {
            serviceType: svc.id,
            language:    'en_MY',
            stops: [
              {
                coordinates: {
                  lat: merchant.lat ?? '3.1390',
                  lng: merchant.lng ?? '101.6869',
                },
                address: `${merchant.address_line1}, ${merchant.city}, ${merchant.state} ${merchant.postcode}, Malaysia`,
              },
              {
                coordinates: {
                  lat: deliveryAddress.lat ?? '3.1390',
                  lng: deliveryAddress.lng ?? '101.6869',
                },
                address: `${deliveryAddress.line1}${deliveryAddress.line2 ? ', ' + deliveryAddress.line2 : ''}, ${deliveryAddress.city}, ${deliveryAddress.state} ${deliveryAddress.postcode}, Malaysia`,
              },
            ],
          },
        })

        const headers = buildLalamoveHeaders(apiKey, apiSecret, 'POST', lalaPath, body)
        try {
          const res  = await fetch(`${lalaBase}${lalaPath}`, { method: 'POST', headers, body })
          const data = await res.json()
          if (!res.ok) return null

          const priceRaw = data.data?.priceBreakdown?.total ?? '0'
          return {
            type:        'instant' as const,
            provider:    'lalamove' as const,
            serviceType: svc.id,
            label:       svc.label,
            emoji:       svc.emoji,
            description: svc.description,
            maxKg:       svc.maxKg,
            priceRM:     Number(priceRaw) / 100,   // Lalamove returns amount in sen
            quotationId: data.data?.quotationId,
            expiresAt:   data.data?.expiresAt,
          }
        } catch { return null }
      })
    )

    // ── EasyParcel rates ────────────────────────────────────────────────────
    const epKey     = Deno.env.get('EASYPARCEL_API_KEY')!
    const epBaseUrl = isProd
      ? 'https://connect.easyparcel.my/?ac=EPRateCheckingBulk'
      : 'https://demo.connect.easyparcel.my/?ac=EPRateCheckingBulk'

    const epParams = new URLSearchParams({ api: epKey })
    epParams.append('bulk[0][pick_code]',    merchant.postcode)
    epParams.append('bulk[0][pick_state]',   stateCode(merchant.state))
    epParams.append('bulk[0][pick_country]', 'MY')
    epParams.append('bulk[0][send_code]',    deliveryAddress.postcode)
    epParams.append('bulk[0][send_state]',   stateCode(deliveryAddress.state))
    epParams.append('bulk[0][send_country]', 'MY')
    epParams.append('bulk[0][weight]',       String(weightKg))
    epParams.append('bulk[0][parcel_value]', String(parcelValue ?? 10))

    let courierRates: any[] = []
    try {
      const epRes  = await fetch(epBaseUrl, { method: 'POST', body: epParams })
      const epData = await epRes.json()
      if (epData.api_status === 'Success') {
        courierRates = (epData.result?.[0]?.rates ?? [])
          .slice(0, 5)
          .map((r: any) => ({
            type:          'courier' as const,
            provider:      'easyparcel' as const,
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
      }
    } catch (_) {}

    // ── Self pickup (always available) ─────────────────────────────────────
    const selfPickup = {
      type:        'self_pickup' as const,
      provider:    'self' as const,
      label:       'Self Pickup',
      emoji:       '🏃',
      description: 'Collect from the store yourself',
      priceRM:     0,
    }

    return new Response(
      JSON.stringify({
        instant:     lalamoveQuotes.filter(Boolean),
        courier:     courierRates,
        selfPickup,
        weightKg,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
```

Deploy it:

```bash
supabase functions deploy get-delivery-quotes
```


***

## File 2 — `src/types/app.types.ts` (add delivery types)

Add these to your existing types file:

```typescript
export type DeliveryType = 'instant' | 'courier' | 'self_pickup'

export type DeliveryOption =
  | {
      type:        'instant'
      provider:    'lalamove'
      serviceType: string
      label:       string
      emoji:       string
      description: string
      maxKg:       number
      priceRM:     number
      quotationId: string
      expiresAt:   string
    }
  | {
      type:        'courier'
      provider:    'easyparcel'
      serviceId:   string
      rateId:      string
      courierName: string
      courierLogo: string
      serviceName: string
      serviceDetail: string
      priceRM:     number
      delivery:    string
      weightKg:    number
    }
  | {
      type:     'self_pickup'
      provider: 'self'
      label:    string
      emoji:    string
      description: string
      priceRM:  0
    }
```


***

## File 3 — `src/components/customer/DeliveryMethodPicker.tsx`

This is the full picker component that lives inside the checkout screen.

```typescript
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  ScrollView,
} from 'react-native'
import { Image } from 'expo-image'
import { useEffect, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import type { DeliveryOption } from '@/types/app.types'
import type { Address } from '@/types/app.types'

interface Props {
  merchantId:      string
  selectedAddress: Address | null
  cartSubtotal:    number
  totalWeightKg:   number
  selected:        DeliveryOption | null
  onSelect:        (option: DeliveryOption) => void
}

// ─── Option row ────────────────────────────────────────────────────────────────
function OptionRow({
  option,
  selected,
  onSelect,
}: {
  option:   DeliveryOption
  selected: boolean
  onSelect: () => void
}) {
  const isInstant  = option.type === 'instant'
  const isCourier  = option.type === 'courier'
  const isPickup   = option.type === 'self_pickup'

  return (
    <TouchableOpacity
      onPress={onSelect}
      activeOpacity={0.8}
      className={`flex-row items-center gap-3 p-3.5 rounded-2xl border-2 mb-2
        ${selected ? 'border-primary-500 bg-primary-50' : 'border-gray-100 bg-white'}`}
    >
      {/* Icon / Logo */}
      {isCourier ? (
        <Image
          source={{ uri: (option as any).courierLogo }}
          style={{ width: 44, height: 44, borderRadius: 8 }}
          contentFit="contain"
        />
      ) : (
        <View
          className={`w-11 h-11 rounded-xl items-center justify-center
            ${selected ? 'bg-primary-100' : 'bg-gray-100'}`}
        >
          <Text style={{ fontSize: 22 }}>
            {isInstant ? (option as any).emoji : '🏃'}
          </Text>
        </View>
      )}

      {/* Details */}
      <View className="flex-1">
        <Text className="font-bold text-gray-900 text-sm">
          {isInstant  ? (option as any).label
           : isCourier ? (option as any).courierName
           : 'Self Pickup'}
        </Text>
        <Text className="text-gray-400 text-xs mt-0.5" numberOfLines={1}>
          {isInstant  ? (option as any).description
           : isCourier ? `${(option as any).serviceName} · ${(option as any).delivery}`
           : 'Collect at the store. No delivery fee.'}
        </Text>
        {isCourier && (
          <View className="flex-row items-center gap-1 mt-0.5">
            <Ionicons name="cube-outline" size={11} color="#9ca3af" />
            <Text className="text-gray-400 text-xs">
              {(option as any).serviceDetail}
            </Text>
          </View>
        )}
      </View>

      {/* Price */}
      <View className="items-end">
        <Text className={`font-bold text-base ${option.priceRM === 0 ? 'text-green-600' : 'text-primary-600'}`}>
          {option.priceRM === 0 ? 'Free' : formatCurrency(option.priceRM)}
        </Text>
        {isInstant && (
          <View className="bg-green-100 rounded-full px-1.5 py-0.5 mt-0.5">
            <Text className="text-green-700 text-[10px] font-semibold">Instant</Text>
          </View>
        )}
      </View>

      {/* Radio */}
      <View
        className={`w-5 h-5 rounded-full border-2 ml-1
          ${selected ? 'border-primary-500' : 'border-gray-300'}`}
      >
        {selected && <View className="flex-1 m-0.5 rounded-full bg-primary-500" />}
      </View>
    </TouchableOpacity>
  )
}

// ─── Tab button ────────────────────────────────────────────────────────────────
function TabBtn({
  label, active, onPress,
}: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-1 py-2 rounded-xl items-center
        ${active ? 'bg-white shadow' : ''}`}
    >
      <Text className={`text-sm font-semibold
        ${active ? 'text-gray-900' : 'text-gray-400'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export function DeliveryMethodPicker({
  merchantId, selectedAddress, cartSubtotal,
  totalWeightKg, selected, onSelect,
}: Props) {
  type Tab = 'instant' | 'courier' | 'pickup'
  const [tab, setTab]         = useState<Tab>('instant')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [instant, setInstant]     = useState<DeliveryOption[]>([])
  const [courier, setCourier]     = useState<DeliveryOption[]>([])
  const [selfPickup, setSelfPickup] = useState<DeliveryOption | null>(null)
  const [quotesLoaded, setQuotesLoaded] = useState(false)

  // Fetch quotes when address is set
  useEffect(() => {
    if (!selectedAddress || !merchantId) return

    const fetchQuotes = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const { data, error: fnError } = await supabase.functions.invoke('get-delivery-quotes', {
          body: {
            merchantId,
            deliveryAddress: {
              line1:    selectedAddress.address_line1,
              line2:    selectedAddress.address_line2 ?? '',
              city:     selectedAddress.city,
              state:    selectedAddress.state,
              postcode: selectedAddress.postcode,
            },
            totalWeightKg,
            parcelValue: cartSubtotal,
          },
        })
        if (fnError) throw new Error(fnError.message)
        setInstant(data.instant ?? [])
        setCourier(data.courier ?? [])
        setSelfPickup(data.selfPickup ?? null)
        setQuotesLoaded(true)

        // Auto-select cheapest instant option as default
        if (data.instant?.[0] && !selected) {
          onSelect(data.instant[0])
        }
      } catch (err: any) {
        setError(err.message)
      }
      setIsLoading(false)
    }

    fetchQuotes()
  }, [selectedAddress?.id, merchantId]) // re-fetch when address changes

  // Address not selected yet
  if (!selectedAddress) {
    return (
      <View className="flex-row items-center gap-2 p-3 bg-amber-50 rounded-xl">
        <Ionicons name="information-circle-outline" size={18} color="#d97706" />
        <Text className="text-amber-700 text-sm flex-1">
          Select a delivery address above to see delivery options.
        </Text>
      </View>
    )
  }

  // Loading
  if (isLoading) {
    return (
      <View className="items-center py-6 gap-3">
        <ActivityIndicator size="small" color="#2563eb" />
        <Text className="text-gray-400 text-sm">Finding best rates for your area...</Text>
      </View>
    )
  }

  // Error
  if (error) {
    return (
      <View className="bg-red-50 rounded-xl p-3 flex-row items-start gap-2">
        <Ionicons name="warning-outline" size={16} color="#ef4444" />
        <View className="flex-1">
          <Text className="text-red-600 font-semibold text-sm">Could not load delivery rates</Text>
          <Text className="text-red-400 text-xs mt-0.5">{error}</Text>
        </View>
      </View>
    )
  }

  const tabOptions = [
    { key: 'instant' as Tab, label: `🏍️  Instant (${instant.length})` },
    { key: 'courier' as Tab, label: `📦  Courier (${courier.length})` },
    { key: 'pickup'  as Tab, label: '🏃  Pickup' },
  ]

  const visibleOptions: DeliveryOption[] =
    tab === 'instant' ? instant :
    tab === 'courier' ? courier :
    selfPickup ? [selfPickup] : []

  return (
    <View>
      {/* Tab selector */}
      <View className="flex-row bg-gray-100 rounded-2xl p-1 mb-3">
        {tabOptions.map(t => (
          <TabBtn
            key={t.key}
            label={t.label}
            active={tab === t.key}
            onPress={() => setTab(t.key)}
          />
        ))}
      </View>

      {/* Lalamove quote expiry notice */}
      {tab === 'instant' && instant.length > 0 && (
        <View className="flex-row items-center gap-1.5 mb-2 px-1">
          <Ionicons name="time-outline" size={13} color="#9ca3af" />
          <Text className="text-gray-400 text-xs">
            Instant prices are live quotes · valid for ~10 minutes
          </Text>
        </View>
      )}

      {/* Options */}
      {visibleOptions.length === 0 ? (
        <View className="items-center py-6">
          <Text className="text-gray-400 text-sm">
            {tab === 'instant'
              ? 'No instant delivery available for this route.'
              : tab === 'courier'
              ? 'No courier services found for this postcode.'
              : ''}
          </Text>
        </View>
      ) : (
        visibleOptions.map((opt, idx) => {
          const key =
            opt.type === 'instant'    ? (opt as any).serviceType :
            opt.type === 'courier'    ? (opt as any).rateId :
            'self_pickup'

          return (
            <OptionRow
              key={key}
              option={opt}
              selected={
                selected?.type === opt.type &&
                (opt.type === 'self_pickup'
                  ? true
                  : opt.type === 'instant'
                  ? (selected as any).serviceType === (opt as any).serviceType
                  : (selected as any).rateId === (opt as any).rateId)
              }
              onSelect={() => onSelect(opt)}
            />
          )
        })
      )}

      {/* Weight note */}
      <Text className="text-gray-400 text-xs text-right mt-1">
        Estimated parcel weight: {totalWeightKg.toFixed(2)} kg
      </Text>
    </View>
  )
}
```


***

## File 4 — Updated `app/(customer)/(cart)/checkout.tsx`

Replace the entire file with this updated version that wires everything together:

```typescript
import {
  View, Text, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useCartStore } from '@/stores/cartStore'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { DeliveryMethodPicker } from '@/components/customer/DeliveryMethodPicker'
import Toast from 'react-native-toast-message'
import type { Address, DeliveryOption } from '@/types/app.types'

// ─── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-white rounded-2xl p-4 mb-3"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
      <Text className="font-bold text-gray-900 mb-3">{title}</Text>
      {children}
    </View>
  )
}

// ─── Address picker ────────────────────────────────────────────────────────────
function AddressPicker({
  addresses, selected, onSelect,
}: { addresses: Address[]; selected: Address | null; onSelect: (a: Address) => void }) {
  if (addresses.length === 0) {
    return (
      <TouchableOpacity
        onPress={() => router.push('/(customer)/(profile)/addresses')}
        className="flex-row items-center gap-3 p-3 border-2 border-dashed border-gray-200 rounded-xl"
      >
        <Ionicons name="add-circle-outline" size={20} color="#2563eb" />
        <Text className="text-primary-600 font-medium">Add delivery address</Text>
      </TouchableOpacity>
    )
  }
  return (
    <View className="gap-2">
      {addresses.map(addr => (
        <TouchableOpacity key={addr.id} onPress={() => onSelect(addr)}
          className={`flex-row items-start gap-3 p-3 rounded-xl border-2
            ${selected?.id === addr.id ? 'border-primary-500 bg-primary-50' : 'border-gray-100'}`}
        >
          <View className={`w-5 h-5 rounded-full border-2 mt-0.5 items-center justify-center
            ${selected?.id === addr.id ? 'border-primary-500' : 'border-gray-300'}`}>
            {selected?.id === addr.id && (
              <View className="w-2.5 h-2.5 rounded-full bg-primary-500" />
            )}
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="font-semibold text-gray-900 text-sm">{addr.label}</Text>
              {addr.is_default && (
                <View className="bg-primary-100 rounded-full px-1.5 py-0.5">
                  <Text className="text-primary-700 text-[10px] font-semibold">Default</Text>
                </View>
              )}
            </View>
            <Text className="text-gray-600 text-xs mt-0.5">
              {addr.recipient_name} · {addr.phone}
            </Text>
            <Text className="text-gray-500 text-xs mt-0.5" numberOfLines={2}>
              {addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ''},
              {' '}{addr.city}, {addr.state} {addr.postcode}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        onPress={() => router.push('/(customer)/(profile)/addresses')}
        className="flex-row items-center gap-2 pt-1"
      >
        <Ionicons name="add-circle-outline" size={16} color="#2563eb" />
        <Text className="text-primary-600 text-sm font-medium">Add new address</Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── Payment picker ────────────────────────────────────────────────────────────
type PaymentMethod = 'razorpay' | 'billplz' | 'cod'

const PAYMENT_OPTIONS: {
  id: PaymentMethod; label: string; subtitle: string; emoji: string
}[] = [
  { id: 'razorpay', emoji: '💳', label: 'Card / E-wallet',      subtitle: 'Visa, Mastercard, Touch \'n Go, GrabPay' },
  { id: 'billplz',  emoji: '🏦', label: 'Online Banking (FPX)', subtitle: 'Maybank, CIMB, RHB, Public Bank & more'   },
  { id: 'cod',      emoji: '💵', label: 'Cash on Delivery',     subtitle: 'Pay when your order arrives'              },
]

function PaymentPicker({
  selected, onSelect,
}: { selected: PaymentMethod | null; onSelect: (m: PaymentMethod) => void }) {
  return (
    <View className="gap-2">
      {PAYMENT_OPTIONS.map(opt => (
        <TouchableOpacity key={opt.id} onPress={() => onSelect(opt.id)}
          className={`flex-row items-center gap-3 p-3 rounded-xl border-2
            ${selected === opt.id ? 'border-primary-500 bg-primary-50' : 'border-gray-100'}`}
        >
          <Text style={{ fontSize: 22 }}>{opt.emoji}</Text>
          <View className="flex-1">
            <Text className="font-semibold text-gray-900 text-sm">{opt.label}</Text>
            <Text className="text-gray-400 text-xs mt-0.5">{opt.subtitle}</Text>
          </View>
          <View className={`w-5 h-5 rounded-full border-2
            ${selected === opt.id ? 'border-primary-500' : 'border-gray-300'}`}>
            {selected === opt.id && (
              <View className="flex-1 m-0.5 rounded-full bg-primary-500" />
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  )
}

// ─── Order summary ─────────────────────────────────────────────────────────────
function OrderSummary({
  subtotal, deliveryFee, isSelfPickup,
}: { subtotal: number; deliveryFee: number; isSelfPickup: boolean }) {
  const total = subtotal + deliveryFee

  return (
    <View className="gap-2">
      <View className="flex-row justify-between">
        <Text className="text-gray-500 text-sm">Subtotal</Text>
        <Text className="text-gray-900 font-semibold text-sm">{formatCurrency(subtotal)}</Text>
      </View>
      <View className="flex-row justify-between">
        <Text className="text-gray-500 text-sm">Delivery fee</Text>
        {deliveryFee > 0 ? (
          <Text className="text-gray-900 font-semibold text-sm">{formatCurrency(deliveryFee)}</Text>
        ) : (
          <Text className="text-green-600 font-semibold text-sm">
            {isSelfPickup ? 'Self pickup' : 'Select delivery'}
          </Text>
        )}
      </View>
      <View className="border-t border-gray-100 pt-2 mt-1">
        <View className="flex-row justify-between">
          <Text className="font-bold text-gray-900">Total</Text>
          <Text className="font-bold text-primary-600 text-lg">{formatCurrency(total)}</Text>
        </View>
      </View>
    </View>
  )
}

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function CheckoutScreen() {
  const insets  = useSafeAreaInsets()
  const { user } = useAuthStore()
  const { items, merchantId, getTotal, clearCart } = useCartStore()

  const [selectedAddress, setSelectedAddress]   = useState<Address | null>(null)
  const [deliveryOption, setDeliveryOption]     = useState<DeliveryOption | null>(null)
  const [paymentMethod, setPaymentMethod]       = useState<PaymentMethod | null>(null)
  const [isPlacing, setIsPlacing]               = useState(false)

  // Total weight from cart items (product.weight_grams stored in cart item)
  const totalWeightKg = useMemo(() => {
    const grams = items.reduce((sum, i) => sum + ((i.weightGrams ?? 500) * i.quantity), 0)
    return Math.max(grams / 1000, 0.1)
  }, [items])

  const deliveryFee    = deliveryOption?.priceRM ?? 0
  const grandTotal     = getTotal() + deliveryFee
  const isSelfPickup   = deliveryOption?.type === 'self_pickup'
  const hasDelivery    = !!deliveryOption
  const canPlace       = !!selectedAddress && hasDelivery && !!paymentMethod && items.length > 0

  // Fetch saved addresses
  const { data: addresses = [] } = useQuery<Address[]>({
    queryKey: ['addresses', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user!.id)
        .order('is_default', { ascending: false })
      const def = data?.find(a => a.is_default)
      if (def) setSelectedAddress(def)
      return data ?? []
    },
    enabled: !!user?.id,
  })

  // Reset delivery option when address changes
  const handleAddressSelect = (addr: Address) => {
    setSelectedAddress(addr)
    setDeliveryOption(null) // force re-selection with new quotes
  }

  const handlePlaceOrder = async () => {
    if (!canPlace || !deliveryOption) return
    setIsPlacing(true)
    try {
      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          merchant_id:         merchantId!,
          customer_id:         user!.id,
          status:              'pending',
          subtotal:            getTotal(),
          delivery_fee:        deliveryFee,
          discount_amount:     0,
          total_amount:        grandTotal,
          payment_method:      paymentMethod,
          payment_status:      'unpaid',
          // Delivery info snapshotted at time of order
          delivery_type:       deliveryOption.type,
          delivery_provider:   deliveryOption.provider,
          delivery_service_id: (deliveryOption as any).serviceType
                                ?? (deliveryOption as any).serviceId
                                ?? null,
          delivery_quote_id:   (deliveryOption as any).quotationId ?? null,
          delivery_address: {
            name:     selectedAddress!.recipient_name,
            phone:    selectedAddress!.phone,
            line1:    selectedAddress!.address_line1,
            line2:    selectedAddress!.address_line2 ?? null,
            city:     selectedAddress!.city,
            state:    selectedAddress!.state,
            postcode: selectedAddress!.postcode,
          },
        })
        .select()
        .single()

      if (error) throw error

      await supabase.from('order_items').insert(
        items.map(i => ({
          order_id:     order.id,
          product_id:   i.productId,
          variant_id:   i.variantId ?? null,
          product_name: i.productName,
          variant_name: i.variantName ?? null,
          unit_price:   i.price,
          quantity:     i.quantity,
          line_total:   i.price * i.quantity,
        }))
      )

      clearCart()

      if (paymentMethod === 'cod' || isSelfPickup) {
        await supabase
          .from('orders')
          .update({ status: 'confirmed', payment_status: isSelfPickup ? 'unpaid' : 'unpaid' })
          .eq('id', order.id)
        Toast.show({ type: 'success', text1: 'Order placed! 🎉', text2: order.order_number })
        router.replace(`/(customer)/(orders)/${order.id}`)
      } else {
        router.replace({
          pathname: '/(customer)/(cart)/payment-webview',
          params:   { orderId: order.id, paymentMethod },
        })
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed to place order', text2: err.message })
    }
    setIsPlacing(false)
  }

  // Validation message
  const validationMsg = !selectedAddress
    ? 'Select a delivery address'
    : !hasDelivery
    ? 'Select a delivery method'
    : !paymentMethod
    ? 'Select a payment method'
    : null

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="bg-white px-5 pt-4 pb-3 flex-row items-center gap-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Checkout</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Step 1: Delivery Address */}
        <Section title="1️⃣  Delivery Address">
          <AddressPicker
            addresses={addresses}
            selected={selectedAddress}
            onSelect={handleAddressSelect}
          />
        </Section>

        {/* Step 2: Delivery Method */}
        <Section title="2️⃣  Delivery Method">
          <DeliveryMethodPicker
            merchantId={merchantId!}
            selectedAddress={selectedAddress}
            cartSubtotal={getTotal()}
            totalWeightKg={totalWeightKg}
            selected={deliveryOption}
            onSelect={setDeliveryOption}
          />
        </Section>

        {/* Step 3: Payment */}
        <Section title="3️⃣  Payment Method">
          <PaymentPicker selected={paymentMethod} onSelect={setPaymentMethod} />
        </Section>

        {/* Step 4: Order summary */}
        <Section title="📋  Order Summary">
          <OrderSummary
            subtotal={getTotal()}
            deliveryFee={deliveryFee}
            isSelfPickup={isSelfPickup}
          />
        </Section>

        <Text className="text-gray-400 text-xs text-center px-4 mt-1 leading-relaxed">
          By placing your order you agree to our Terms of Service and Privacy Policy.
        </Text>
      </ScrollView>

      {/* Sticky CTA */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 pt-3"
        style={{ paddingBottom: insets.bottom + 8 }}
      >
        <View className="flex-row justify-between items-baseline mb-3">
          <Text className="text-gray-500 text-sm">Grand Total</Text>
          <Text className="text-2xl font-bold text-gray-900">
            {formatCurrency(grandTotal)}
          </Text>
        </View>
        <Button onPress={handlePlaceOrder} disabled={!canPlace} loading={isPlacing}>
          {paymentMethod === 'cod' || isSelfPickup
            ? 'Place Order'
            : 'Continue to Payment →'}
        </Button>
        {validationMsg && (
          <Text className="text-gray-400 text-xs text-center mt-2">
            ⚠️ {validationMsg}
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}
```


***

## File 5 — Add `weightGrams` to `cartStore.ts`

Add the field to your cart item type and populate it when adding to cart:

```typescript
// In src/stores/cartStore.ts, update the CartItem type:
export type CartItem = {
  productId:   string
  variantId?:  string
  productName: string
  variantName?: string
  price:       number
  quantity:    number
  imageUrl?:   string
  weightGrams: number   // ← add this
}
```

And in your `addItem` action, pass `weightGrams` from the product:

```typescript
// When calling addItem from a product page:
cartStore.addItem({
  productId:   product.id,
  productName: product.name,
  price:       selectedVariant ? product.price + selectedVariant.price_modifier : product.price,
  quantity:    1,
  imageUrl:    product.images?.[0],
  weightGrams: product.weight_grams ?? 500,  // ← default 500g if not set
})
```


***

## Deploy \& Verify

```bash
supabase functions deploy get-delivery-quotes
npx expo start
```

| Test | Expected result |
| :-- | :-- |
| Open checkout, no address set | Step 2 shows amber "Select address above" message, Step 3 payment still visible |
| Select a delivery address | Step 2 spinner appears → Lalamove instant quotes load automatically with live MYR prices |
| Switch to Courier tab | EasyParcel rates load (PosLaju, Skynet, etc.) sorted cheapest first |
| Switch to Pickup tab | Single "Self Pickup — Free" card |
| Select motorbike instant delivery | Grand total in footer updates to include delivery fee in real time |
| Switch address to different postcode | Delivery option resets, new quotes fetched for new route |
| Select courier + COD | "Place Order" button (not "Continue to Payment") appears |
| Select instant delivery + Billplz | "Continue to Payment →" appears; `delivery_type: 'instant'` saved to order |
| Check order in Supabase | `delivery_fee`, `delivery_type`, `delivery_provider`, `delivery_quote_id` all populated |
| Merchant opens order | "Book Delivery" section shows the customer's chosen provider pre-highlighted |

