<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Missing easyparcel configuration in merchant dashboard

Here is the complete EasyParcel configuration — same depth as Lalamove: database migration, test-connection Edge Function, and the full settings component.[^1][^2][^3]

***

## Step 1 — Database Migration

```sql
-- Per-merchant EasyParcel configuration
CREATE TABLE IF NOT EXISTS merchant_easyparcel_config (
  merchant_id               uuid PRIMARY KEY REFERENCES merchants(id) ON DELETE CASCADE,

  -- API credentials
  api_key                   text,
  environment               text    NOT NULL DEFAULT 'sandbox',  -- 'sandbox' | 'production'

  -- Sender details (required for every shipment)
  sender_name               text,
  sender_phone              text,   -- 10-digit MY format e.g. 0123456789
  sender_email              text,
  sender_company            text,

  -- Sender address
  sender_address1           text,
  sender_address2           text,
  sender_city               text,
  sender_state              text    DEFAULT 'sgr',   -- see state codes below
  sender_postcode           text,
  sender_country            text    DEFAULT 'MY',

  -- Parcel defaults (used when product weight not set)
  default_weight_kg         numeric NOT NULL DEFAULT 0.5,
  default_width_cm          numeric NOT NULL DEFAULT 15,
  default_height_cm         numeric NOT NULL DEFAULT 10,
  default_length_cm         numeric NOT NULL DEFAULT 20,

  -- Service preferences
  preferred_courier         text    DEFAULT NULL,   -- NULL = cheapest available
  collection_type           text    NOT NULL DEFAULT 'pickup',  -- 'pickup' | 'dropoff'
  preferred_pickup_date     text    DEFAULT NULL,   -- 'tomorrow' | 'today'
  auto_book_on_ready        boolean NOT NULL DEFAULT false,

  -- Status
  last_tested_at            timestamptz,
  last_test_result          text,
  wallet_balance            numeric,               -- cached from last test
  wallet_updated_at         timestamptz,

  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

ALTER TABLE merchant_easyparcel_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merchant reads own easyparcel config"
  ON merchant_easyparcel_config FOR SELECT TO authenticated
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "merchant writes own easyparcel config"
  ON merchant_easyparcel_config FOR ALL TO authenticated
  USING  (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()))
  WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

INSERT INTO merchant_easyparcel_config (merchant_id)
SELECT id FROM merchants
ON CONFLICT (merchant_id) DO NOTHING;
```


***

## Step 2 — `supabase/functions/easyparcel-test-connection/index.ts`

Calls `EPRateChecker` with a dummy route to validate the API key and returns the wallet balance:[^1]

```typescript
import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BASE = {
  sandbox:    'https://demo.connect.easyparcel.my',
  production: 'https://connect.easyparcel.my',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const { merchantId, apiKey, environment } = await req.json()

  if (!apiKey || !merchantId) {
    return new Response(JSON.stringify({ success: false, error: 'Missing apiKey or merchantId' }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const base = BASE[environment as keyof typeof BASE] ?? BASE.sandbox

  try {
    // ── 1. Validate key via EPRateChecker (KL → KL test route) ────────────
    const rateBody = new URLSearchParams({
      api_key: apiKey,
      bulk:    JSON.stringify([{
        weight:        '0.5',
        width:         '15',
        height:        '10',
        length:        '20',
        content:       'Test parcel',
        value:         '10',
        send_postcode: '55100',
        send_state:    'kul',
        send_country:  'MY',
        rec_postcode:  '47810',
        rec_state:     'sgr',
        rec_country:   'MY',
      }]),
    })

    const rateRes = await fetch(`${base}/?ac=EPRateChecker`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    rateBody.toString(),
      signal:  AbortSignal.timeout(10000),
    })

    const rateData = await rateRes.json()

    // EasyParcel returns error_code "3" for invalid API key
    if (rateData?.error_code === '3' || rateData?.api_status === 'Error') {
      const msg = rateData?.error_remark ?? 'Invalid API key'
      await supabase.from('merchant_easyparcel_config')
        .update({ last_tested_at: new Date().toISOString(), last_test_result: `failed: ${msg}` })
        .eq('merchant_id', merchantId)
      return new Response(JSON.stringify({ success: false, error: msg }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    // ── 2. Fetch wallet balance ────────────────────────────────────────────
    let walletBalance: number | null = null
    try {
      const walletBody = new URLSearchParams({ api_key: apiKey })
      const walletRes  = await fetch(`${base}/?ac=EPWalletBalance`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    walletBody.toString(),
        signal:  AbortSignal.timeout(5000),
      })
      const walletData = await walletRes.json()
      if (walletData?.api_status === 'Success') {
        walletBalance = parseFloat(walletData?.result?.[^0]?.wallet_balance ?? '0')
      }
    } catch { /* wallet check is optional */ }

    // Save verified key + wallet balance
    await supabase.from('merchant_easyparcel_config')
      .update({
        api_key:           apiKey,
        environment,
        last_tested_at:    new Date().toISOString(),
        last_test_result:  'success',
        wallet_balance:    walletBalance,
        wallet_updated_at: walletBalance !== null ? new Date().toISOString() : null,
        updated_at:        new Date().toISOString(),
      })
      .eq('merchant_id', merchantId)

    // Extract sample couriers from rate check
    const couriers = (rateData?.result ?? []).map((r: any) => ({
      id:    r.courier_id,
      name:  r.courier_name,
      price: r.price,
    })).slice(0, 5)

    return new Response(JSON.stringify({ success: true, walletBalance, couriers }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    await supabase.from('merchant_easyparcel_config')
      .update({ last_tested_at: new Date().toISOString(), last_test_result: `error: ${err.message}` })
      .eq('merchant_id', merchantId)
    return new Response(JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
```

```bash
supabase functions deploy easyparcel-test-connection
```


***

## Step 3 — Add EasyParcel tab to `SettingsClient.tsx`

```typescript
// Add to TABS array in SettingsClient.tsx:
{ key: 'easyparcel', label: '📦  EasyParcel' },

// Add to tab body:
import { EasyParcelSettings } from './settings/EasyParcelSettings'
// ...
{tab === 'easyparcel' && <EasyParcelSettings config={easyparcelConfig} merchantId={merchant.id} />}
```

Update `settings/page.tsx` to also fetch EasyParcel config:

```typescript
const [{ data: lalamoveConfig }, { data: easyparcelConfig }] = await Promise.all([
  supabase.from('merchant_lalamove_config')  .select('*').eq('merchant_id', merchant.id).single(),
  supabase.from('merchant_easyparcel_config').select('*').eq('merchant_id', merchant.id).single(),
])

// Pass to SettingsClient:
<SettingsClient
  merchant={merchant}
  user={user}
  lalamoveConfig={lalamoveConfig}
  easyparcelConfig={easyparcelConfig}
/>
```


***

## File 4 — `src/components/dashboard/settings/EasyParcelSettings.tsx`

```typescript
'use client'
import { useState } from 'react'
import { createClient }  from '@/lib/supabase/client'
import { Button }        from '@/components/ui/button'
import { Input }         from '@/components/ui/input'
import { Label }         from '@/components/ui/label'
import { Switch }        from '@/components/ui/switch'
import toast             from 'react-hot-toast'
import { cn }            from '@/lib/utils'
import {
  Eye, EyeOff, CheckCircle2, XCircle,
  Loader2, ExternalLink, AlertTriangle,
  RefreshCw, Wallet,
} from 'lucide-react'

// ─── Reference data ────────────────────────────────────────────────────────

const MY_STATES = [
  { value: 'jhr', label: 'Johor'          },
  { value: 'kdh', label: 'Kedah'          },
  { value: 'ktn', label: 'Kelantan'       },
  { value: 'kul', label: 'Kuala Lumpur'   },
  { value: 'lbn', label: 'Labuan'         },
  { value: 'mlk', label: 'Melaka'         },
  { value: 'nsn', label: 'Negeri Sembilan'},
  { value: 'phg', label: 'Pahang'         },
  { value: 'prk', label: 'Perak'          },
  { value: 'pls', label: 'Perlis'         },
  { value: 'png', label: 'Pulau Pinang'   },
  { value: 'pjy', label: 'Putrajaya'      },
  { value: 'sbh', label: 'Sabah'          },
  { value: 'swk', label: 'Sarawak'        },
  { value: 'sgr', label: 'Selangor'       },
  { value: 'trg', label: 'Terengganu'     },
]

const COURIERS = [
  { value: '',          label: '⭐  Cheapest Available (Auto)'   },
  { value: 'POSLAJU',   label: '🇲🇾  Poslaju'                   },
  { value: 'GDEX',      label: '📦  GDex'                       },
  { value: 'DHL',       label: '🟡  DHL eCommerce'              },
  { value: 'CITYLINK',  label: '🔵  City-Link Express'          },
  { value: 'ABX',       label: '🟠  ABX Express'                },
  { value: 'SKYNET',    label: '🌐  Skynet'                     },
  { value: 'JANDT',     label: '🔴  J&T Express'                },
  { value: 'NINJAVAN',  label: '🥷  Ninja Van'                  },
  { value: 'FLASH',     label: '⚡  Flash Express'              },
  { value: 'ARAMEX',    label: '🟤  Aramex'                     },
]

// ─── Sub-components ────────────────────────────────────────────────────────

function Section({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
      <div>
        <h3 className="font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function ToggleRow({ label, desc, checked, onChange }: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

export function EasyParcelSettings({ config: initial, merchantId }: {
  config: any; merchantId: string
}) {
  const supabase = createClient()

  const [form, setForm] = useState({
    api_key:              initial?.api_key             ?? '',
    environment:          initial?.environment         ?? 'sandbox',
    sender_name:          initial?.sender_name         ?? '',
    sender_phone:         initial?.sender_phone        ?? '',
    sender_email:         initial?.sender_email        ?? '',
    sender_company:       initial?.sender_company      ?? '',
    sender_address1:      initial?.sender_address1     ?? '',
    sender_address2:      initial?.sender_address2     ?? '',
    sender_city:          initial?.sender_city         ?? '',
    sender_state:         initial?.sender_state        ?? 'sgr',
    sender_postcode:      initial?.sender_postcode     ?? '',
    sender_country:       initial?.sender_country      ?? 'MY',
    default_weight_kg:    initial?.default_weight_kg   ?? 0.5,
    default_width_cm:     initial?.default_width_cm    ?? 15,
    default_height_cm:    initial?.default_height_cm   ?? 10,
    default_length_cm:    initial?.default_length_cm   ?? 20,
    preferred_courier:    initial?.preferred_courier   ?? '',
    collection_type:      initial?.collection_type     ?? 'pickup',
    auto_book_on_ready:   initial?.auto_book_on_ready  ?? false,
  })

  const [showKey,     setShowKey]     = useState(false)
  const [testing,     setTesting]     = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [testResult,  setTestResult]  = useState<{ ok: boolean; message: string; walletBalance?: number | null; couriers?: any[] } | null>(
    initial?.last_test_result
      ? {
          ok:            initial.last_test_result === 'success',
          message:       initial.last_test_result,
          walletBalance: initial.wallet_balance,
        }
      : null
  )

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))
  const isProduction = form.environment === 'production'

  // ── Test connection ──────────────────────────────────────────────────────
  const handleTest = async () => {
    if (!form.api_key) { toast.error('Enter your API key first'); return }
    setTesting(true)
    setTestResult(null)

    const { data, error } = await supabase.functions.invoke('easyparcel-test-connection', {
      body: { merchantId, apiKey: form.api_key, environment: form.environment },
    })

    if (error || !data?.success) {
      const msg = data?.error ?? error?.message ?? 'Connection failed'
      setTestResult({ ok: false, message: msg })
      toast.error(`Connection failed: ${msg}`)
    } else {
      setTestResult({ ok: true, message: 'Connected', walletBalance: data.walletBalance, couriers: data.couriers })
      toast.success('EasyParcel API key verified ✅')
    }
    setTesting(false)
  }

  // ── Save settings ────────────────────────────────────────────────────────
  const handleSave = async () => {
    const required = ['sender_name', 'sender_phone', 'sender_address1', 'sender_city', 'sender_postcode']
    const missing  = required.filter(k => !form[k as keyof typeof form])
    if (missing.length > 0) {
      toast.error(`Required: ${missing.map(k => k.replace(/_/g, ' ')).join(', ')}`)
      return
    }
    setSaving(true)

    const { error } = await supabase
      .from('merchant_easyparcel_config')
      .upsert({
        merchant_id:         merchantId,
        environment:         form.environment,
        sender_name:         form.sender_name,
        sender_phone:        form.sender_phone,
        sender_email:        form.sender_email,
        sender_company:      form.sender_company,
        sender_address1:     form.sender_address1,
        sender_address2:     form.sender_address2,
        sender_city:         form.sender_city,
        sender_state:        form.sender_state,
        sender_postcode:     form.sender_postcode,
        sender_country:      form.sender_country,
        default_weight_kg:   Number(form.default_weight_kg),
        default_width_cm:    Number(form.default_width_cm),
        default_height_cm:   Number(form.default_height_cm),
        default_length_cm:   Number(form.default_length_cm),
        preferred_courier:   form.preferred_courier || null,
        collection_type:     form.collection_type,
        auto_book_on_ready:  form.auto_book_on_ready,
        updated_at:          new Date().toISOString(),
      }, { onConflict: 'merchant_id' })

    if (error) toast.error(error.message)
    else toast.success('EasyParcel settings saved!')
    setSaving(false)
  }

  return (
    <div className="space-y-4">

      {/* ── API Credentials ───────────────────────────────────────────── */}
      <Section
        title="API Credentials"
        subtitle="Get your API key from EasyParcel → Integrations → Add New Store → API Key."
      >
        {/* Environment */}
        <div>
          <Label>Environment</Label>
          <div className="flex gap-2 mt-1.5">
            {(['sandbox', 'production'] as const).map(env => (
              <button key={env}
                onClick={() => set('environment', env)}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors capitalize',
                  form.environment === env
                    ? env === 'production'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-100 text-gray-400 hover:border-gray-200'
                )}
              >
                {env === 'production' ? '🟢' : '🧪'} {env}
              </button>
            ))}
          </div>
          {isProduction && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-2">
              <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">
                Production uses real EasyParcel credits. Ensure your{' '}
                <a href="https://www.easyparcel.my" target="_blank" rel="noreferrer" className="underline font-medium">
                  EasyParcel wallet
                </a>{' '}
                has sufficient balance before auto-booking.
              </p>
            </div>
          )}
        </div>

        {/* API Key */}
        <div>
          <Label>API Key</Label>
          <div className="relative mt-1.5">
            <Input
              type={showKey ? 'text' : 'password'}
              value={form.api_key}
              onChange={e => set('api_key', e.target.value)}
              placeholder="Paste your EasyParcel API key"
              className="pr-10 font-mono text-sm"
            />
            <button type="button" onClick={() => setShowKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Test result */}
        {testResult && (
          <div className={cn(
            'rounded-xl border px-4 py-3 space-y-2',
            testResult.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          )}>
            <div className="flex items-center gap-2">
              {testResult.ok
                ? <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                : <XCircle      size={16} className="text-red-500   shrink-0" />}
              <p className={cn('text-sm font-semibold',
                testResult.ok ? 'text-green-800' : 'text-red-700')}>
                {testResult.ok ? 'API key verified' : 'Connection failed'}
              </p>
            </div>

            {/* Wallet balance */}
            {testResult.ok && testResult.walletBalance !== null && testResult.walletBalance !== undefined && (
              <div className="flex items-center gap-2 bg-white/60 rounded-lg px-3 py-2">
                <Wallet size={14} className="text-green-600" />
                <span className="text-sm text-green-800">
                  Wallet Balance:{' '}
                  <span className={cn('font-bold',
                    testResult.walletBalance < 10 ? 'text-red-600' : 'text-green-700')}>
                    RM {testResult.walletBalance?.toFixed(2)}
                  </span>
                  {testResult.walletBalance < 10 && (
                    <span className="text-red-500 text-xs ml-2">⚠️ Low balance — top up soon</span>
                  )}
                </span>
              </div>
            )}

            {/* Sample courier rates */}
            {testResult.ok && (testResult.couriers ?? []).length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-green-700">Sample rates (KL → Selangor, 0.5kg):</p>
                <div className="grid grid-cols-2 gap-1">
                  {(testResult.couriers ?? []).map((c: any) => (
                    <div key={c.id} className="flex justify-between bg-white/60 rounded-lg px-2.5 py-1.5 text-xs">
                      <span className="text-gray-700 truncate max-w-[120px]">{c.name}</span>
                      <span className="font-bold text-green-700 ml-2">RM {parseFloat(c.price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!testResult.ok && (
              <p className="text-xs text-red-600">{testResult.message}</p>
            )}

            {initial?.last_tested_at && (
              <p className="text-xs text-gray-400">
                Last tested: {new Date(initial.last_tested_at).toLocaleString('en-MY')}
              </p>
            )}
          </div>
        )}

        <Button onClick={handleTest} disabled={testing || !form.api_key} variant="outline" className="w-full">
          {testing
            ? <><Loader2 size={15} className="animate-spin mr-2" />Testing...</>
            : <><RefreshCw size={15} className="mr-2" />Test Connection & Check Wallet</>}
        </Button>

        <div className="flex items-center justify-between">
          <a href="https://www.easyparcel.my/en/home/integrations" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
            <ExternalLink size={13} /> Get API key from EasyParcel
          </a>
          <a href="https://demo.connect.easyparcel.my" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:underline">
            <ExternalLink size={11} /> Sandbox portal
          </a>
        </div>
      </Section>

      {/* ── Sender Details ────────────────────────────────────────────── */}
      <Section
        title="Sender Details"
        subtitle="These appear on the AWB (airway bill) as the sender. Must match your EasyParcel account details."
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Full Name *</Label>
            <Input value={form.sender_name} onChange={e => set('sender_name', e.target.value)}
              placeholder="e.g. Ahmad bin Abu" className="mt-1.5" />
          </div>
          <div>
            <Label>Phone Number *</Label>
            <Input value={form.sender_phone} onChange={e => set('sender_phone', e.target.value)}
              placeholder="e.g. 0123456789" className="mt-1.5 font-mono" />
            <p className="text-xs text-gray-400 mt-1">10 digits, no spaces or dashes</p>
          </div>
          <div>
            <Label>Email <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input type="email" value={form.sender_email} onChange={e => set('sender_email', e.target.value)}
              placeholder="you@store.com" className="mt-1.5" />
          </div>
          <div>
            <Label>Company Name <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input value={form.sender_company} onChange={e => set('sender_company', e.target.value)}
              placeholder="e.g. My Store Sdn Bhd" className="mt-1.5" />
          </div>
        </div>
      </Section>

      {/* ── Sender Address ────────────────────────────────────────────── */}
      <Section
        title="Pickup Address"
        subtitle="Where EasyParcel or the courier collects parcels from."
      >
        <div>
          <Label>Address Line 1 *</Label>
          <Input value={form.sender_address1} onChange={e => set('sender_address1', e.target.value)}
            placeholder="e.g. No. 12, Jalan Kenanga 3" className="mt-1.5" />
        </div>
        <div>
          <Label>Address Line 2 <span className="text-gray-400 font-normal">(optional)</span></Label>
          <Input value={form.sender_address2} onChange={e => set('sender_address2', e.target.value)}
            placeholder="e.g. Taman Kenanga" className="mt-1.5" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1">
            <Label>Postcode *</Label>
            <Input value={form.sender_postcode} onChange={e => set('sender_postcode', e.target.value)}
              placeholder="e.g. 47500" className="mt-1.5 font-mono" maxLength={5} />
          </div>
          <div className="col-span-2">
            <Label>City *</Label>
            <Input value={form.sender_city} onChange={e => set('sender_city', e.target.value)}
              placeholder="e.g. Subang Jaya" className="mt-1.5" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>State *</Label>
            <select value={form.sender_state} onChange={e => set('sender_state', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mt-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {MY_STATES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Country</Label>
            <Input value={form.sender_country} readOnly className="mt-1.5 bg-gray-50 text-gray-500" />
          </div>
        </div>
      </Section>

      {/* ── Parcel Defaults ───────────────────────────────────────────── */}
      <Section
        title="Default Parcel Dimensions"
        subtitle="Used for rate checking and booking when a product has no weight set. Per-order weight overrides this."
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <Label>Weight (kg)</Label>
            <Input type="number" min="0.1" step="0.1" value={form.default_weight_kg}
              onChange={e => set('default_weight_kg', e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Length (cm)</Label>
            <Input type="number" min="1" value={form.default_length_cm}
              onChange={e => set('default_length_cm', e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Width (cm)</Label>
            <Input type="number" min="1" value={form.default_width_cm}
              onChange={e => set('default_width_cm', e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Height (cm)</Label>
            <Input type="number" min="1" value={form.default_height_cm}
              onChange={e => set('default_height_cm', e.target.value)} className="mt-1.5" />
          </div>
        </div>
        <p className="text-xs text-gray-400">
          Volumetric weight = (L × W × H) / 5000.
          EasyParcel charges whichever is greater: actual or volumetric weight.
        </p>
      </Section>

      {/* ── Service Preferences ───────────────────────────────────────── */}
      <Section
        title="Service Preferences"
        subtitle="Controls which courier is selected and how parcels are handed over."
      >
        {/* Preferred courier */}
        <div>
          <Label>Preferred Courier</Label>
          <select value={form.preferred_courier} onChange={e => set('preferred_courier', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mt-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
            {COURIERS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">
            "Cheapest Available" automatically picks the lowest-rate courier at booking time.
          </p>
        </div>

        {/* Collection type */}
        <div>
          <Label>Collection Method</Label>
          <div className="grid grid-cols-2 gap-2 mt-1.5">
            {[
              {
                value: 'pickup',
                label: '🚗  Pickup',
                desc:  'Courier comes to your address',
              },
              {
                value: 'dropoff',
                label: '📍  Drop-off',
                desc:  'You deliver to a courier outlet',
              },
            ].map(opt => (
              <button key={opt.value}
                onClick={() => set('collection_type', opt.value)}
                className={cn(
                  'p-3 rounded-xl border-2 text-left transition-colors',
                  form.collection_type === opt.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-100 hover:border-gray-200'
                )}
              >
                <p className={cn('text-sm font-semibold',
                  form.collection_type === opt.value ? 'text-blue-700' : 'text-gray-800')}>
                  {opt.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
          {form.collection_type === 'pickup' && (
            <div className="flex items-start gap-2 bg-blue-50 rounded-xl p-3 mt-2">
              <AlertTriangle size={13} className="text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-600">
                Pickup collection incurs an additional courier pickup fee which is added to the shipping cost at checkout.
              </p>
            </div>
          )}
        </div>
      </Section>

      {/* ── Automation ────────────────────────────────────────────────── */}
      <Section title="Automation" subtitle="Reduce manual steps for your team.">
        <ToggleRow
          label="Auto-book courier when order is ready"
          desc="Automatically submits a shipment to EasyParcel when you mark an order as Ready for Pickup. Deducts from your EasyParcel wallet."
          checked={form.auto_book_on_ready}
          onChange={v => set('auto_book_on_ready', v)}
        />
        {form.auto_book_on_ready && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">
              Each auto-booked shipment immediately deducts the shipping fee from your EasyParcel wallet.
              Keep a minimum balance of RM 50 to avoid booking failures.
            </p>
          </div>
        )}
      </Section>

      {/* ── Save ──────────────────────────────────────────────────────── */}
      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving
          ? <><Loader2 size={15} className="animate-spin mr-2" />Saving...</>
          : 'Save EasyParcel Settings'}
      </Button>
    </div>
  )
}
```


***

## Step 5 — Use saved config in `easyparcel-create-order`

Pull sender details and service preferences from DB instead of hardcoding:[^4]

```typescript
// In supabase/functions/easyparcel-create-order/index.ts

const { data: epConfig } = await supabase
  .from('merchant_easyparcel_config')
  .select('*')
  .eq('merchant_id', order.merchant_id)
  .single()

if (!epConfig?.api_key) {
  return err('EasyParcel not configured — go to Dashboard → Settings → EasyParcel')
}

const BASE = epConfig.environment === 'production'
  ? 'https://connect.easyparcel.my'
  : 'https://demo.connect.easyparcel.my'

// Calculate total order weight (sum of items × product weight, fallback to config default)
const totalWeightKg = order.items?.reduce((sum: number, item: any) =>
  sum + (Number(item.weight_grams ?? (epConfig.default_weight_kg * 1000)) / 1000) * item.quantity, 0
) ?? epConfig.default_weight_kg

const addr = order.delivery_address as any

const shipmentPayload = {
  api_key: epConfig.api_key,
  bulk: [{
    // Sender
    send_name:       epConfig.sender_name,
    send_phone:      epConfig.sender_phone,
    send_email:      epConfig.sender_email  ?? '',
    send_company:    epConfig.sender_company ?? '',
    send_addr1:      epConfig.sender_address1,
    send_addr2:      epConfig.sender_address2 ?? '',
    send_city:       epConfig.sender_city,
    send_state:      epConfig.sender_state,
    send_postcode:   epConfig.sender_postcode,
    send_country:    epConfig.sender_country,

    // Receiver
    rec_name:        addr.name,
    rec_phone:       addr.phone?.replace(/\D/g, ''),
    rec_email:       addr.email ?? '',
    rec_addr1:       addr.line1,
    rec_addr2:       addr.line2 ?? '',
    rec_city:        addr.city,
    rec_state:       addr.state_code ?? 'sgr',
    rec_postcode:    addr.postcode,
    rec_country:     'MY',

    // Parcel
    weight:          String(Math.max(totalWeightKg, 0.1).toFixed(1)),
    width:           String(epConfig.default_width_cm),
    height:          String(epConfig.default_height_cm),
    length:          String(epConfig.default_length_cm),
    content:         order.items?.map((i: any) => i.product_name).join(', ').slice(0, 100) ?? 'Order',
    value:           String(Number(order.subtotal).toFixed(2)),

    // Service
    service_id:      order.easyparcel_service_id ?? epConfig.preferred_courier ?? '',
    collection_date: order.collection_date ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    collect_by:      epConfig.collection_type,
  }],
}
```


***

## What's now configurable vs before

| Setting | Before | Now |
| :-- | :-- | :-- |
| API key | Hardcoded env var | Per-merchant, stored securely with RLS |
| Environment | Fixed | Sandbox / Production toggle |
| Sender name / phone | Hardcoded | Configurable per merchant |
| Sender address | Hardcoded | Full address with state selector |
| Default weight | Hardcoded `0.5` | Configurable + per-product override |
| Default dimensions | Hardcoded | Configurable L × W × H |
| Preferred courier | Always cheapest | Choose specific courier or keep auto |
| Collection method | Hardcoded pickup | Pickup or drop-off |
| Auto-book | Never | Toggle — fires on `ready_for_pickup` |
| Wallet balance | Never shown | Shown after every test connection [^2] |
| Sample rates | Never shown | Displayed live after test [^1] |

<span style="display:none">[^10][^11][^12][^13][^14][^15][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://developers.easyparcel.com

[^2]: https://helpcentre-sg.easyparcel.com/support/solutions/articles/9000207700-how-to-get-easyparcel-api-key-

[^3]: https://helpcentre-my.easyparcel.com/support/solutions/articles/9000188829-how-to-get-easyparcel-api-key-

[^4]: https://developers.easyparcel.com/?ac=DocAPI\&file=Malaysia_Individual_1.4.0.0

[^5]: https://documenter.getpostman.com/view/10519343/TVRpz4zC

[^6]: https://developers.easyparcel.com/?pg=DocAPI\&c=Malaysia\&type=MarketPlace

[^7]: https://developers.easyparcel.com/?ac=DocAPI\&file=Malaysia_Individual_1.1.0.0

[^8]: https://developers.easyparcel.com/?pg=DocAPI\&c=Thailand\&type=MarketPlace

[^9]: https://developers.easyparcel.com/?ac=DocAPI\&file=Malaysia_Individual_1.3.0.0

[^10]: https://developers.easyparcel.com/?ac=DocAPI\&file=Malaysia_Individual_1.0.0.0

[^11]: https://developers.easyparcel.com/?pg=DocAPI\&c=Singapore\&type=MarketPlace

[^12]: https://developers.easyparcel.com/?ac=DocAPI\&file=Malaysia_MarketPlace_1.0.0.0

[^13]: https://developers.easyparcel.com/?pg=Demo\&c=Malaysia

[^14]: https://helpcentre-my.easyparcel.com/support/solutions/folders/9000192728

[^15]: https://api.easyparcel.com

