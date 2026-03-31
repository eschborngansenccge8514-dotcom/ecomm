<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Missing lalamove configuration in merchant dashboard

Here is the complete Lalamove configuration section for the merchant dashboard — 4 files covering the database migration, test-connection Edge Function, settings page, and the full `LalamoveSettings` component.[^1][^2][^3]

***

## Step 1 — Database Migration

```sql
-- Per-merchant Lalamove configuration
CREATE TABLE IF NOT EXISTS merchant_lalamove_config (
  merchant_id               uuid PRIMARY KEY REFERENCES merchants(id) ON DELETE CASCADE,

  -- API credentials (stored with RLS — only merchant can read)
  api_key                   text,
  api_secret                text,

  -- Environment
  environment               text    NOT NULL DEFAULT 'sandbox',  -- 'sandbox' | 'production'
  market                    text    NOT NULL DEFAULT 'MY_KUL',   -- see market codes below

  -- Pickup location
  pickup_contact_name       text,
  pickup_contact_phone      text,   -- E.164 format e.g. +60123456789
  pickup_address_text       text,   -- human-readable full address
  pickup_lat                double precision,
  pickup_lng                double precision,
  pickup_instructions       text,   -- special instructions for driver at pickup

  -- Service defaults
  default_service_type      text    NOT NULL DEFAULT 'MOTORCYCLE',
  default_priority_fee_rm   numeric NOT NULL DEFAULT 0,

  -- Automation
  auto_book_on_ready        boolean NOT NULL DEFAULT false,  -- auto-book when order reaches ready_for_pickup

  -- Webhook
  webhook_verified          boolean NOT NULL DEFAULT false,
  last_tested_at            timestamptz,
  last_test_result          text,   -- 'success' | error message

  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

-- RLS: only the owning merchant can read/write
ALTER TABLE merchant_lalamove_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merchant reads own lalamove config"
  ON merchant_lalamove_config FOR SELECT TO authenticated
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "merchant writes own lalamove config"
  ON merchant_lalamove_config FOR ALL TO authenticated
  USING  (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()))
  WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

-- Seed a blank row for every existing merchant
INSERT INTO merchant_lalamove_config (merchant_id)
SELECT id FROM merchants
ON CONFLICT (merchant_id) DO NOTHING;
```


***

## Step 2 — `supabase/functions/lalamove-test-connection/index.ts`

Validates API credentials and geocodes the pickup address on save:[^1]

```typescript
import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac }   from 'https://deno.land/std@0.177.0/node/crypto.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BASE_URL = {
  sandbox:    'https://rest.sandbox.lalamove.com',
  production: 'https://rest.lalamove.com',
}

function buildSignature(apiSecret: string, method: string, path: string, body: string): string {
  const ts   = Date.now().toString()
  const raw  = `${ts}\r\n${method}\r\n${path}\r\n\r\n${body}`
  const sig  = createHmac('sha256', apiSecret).update(raw).digest('hex')
  return `hmac ${ts}:${sig}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { merchantId, apiKey, apiSecret, environment, market } = await req.json()

  if (!apiKey || !apiSecret || !merchantId) {
    return new Response(JSON.stringify({ success: false, error: 'Missing credentials' }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  const base = BASE_URL[environment as keyof typeof BASE_URL] ?? BASE_URL.sandbox
  const path = '/v3/cities'
  const sig  = buildSignature(apiSecret, 'GET', path, '')

  try {
    const res = await fetch(`${base}${path}`, {
      headers: {
        'Authorization': `${apiKey} ${sig}`,
        'Market':         market ?? 'MY_KUL',
        'Content-Type':  'application/json',
      },
      signal: AbortSignal.timeout(8000),
    })

    const data = await res.json()

    if (!res.ok) {
      const msg = data?.message ?? data?.error ?? `HTTP ${res.status}`
      // Update last_test_result
      await supabase.from('merchant_lalamove_config')
        .update({ last_tested_at: new Date().toISOString(), last_test_result: `failed: ${msg}` })
        .eq('merchant_id', merchantId)
      return new Response(JSON.stringify({ success: false, error: msg }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    // Save verified credentials + result
    await supabase.from('merchant_lalamove_config')
      .update({
        api_key:          apiKey,
        api_secret:       apiSecret,
        environment,
        market,
        webhook_verified: false,   // must re-verify webhook separately
        last_tested_at:   new Date().toISOString(),
        last_test_result: 'success',
        updated_at:       new Date().toISOString(),
      })
      .eq('merchant_id', merchantId)

    return new Response(JSON.stringify({ success: true, cities: data?.data ?? [] }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    await supabase.from('merchant_lalamove_config')
      .update({ last_tested_at: new Date().toISOString(), last_test_result: `error: ${err.message}` })
      .eq('merchant_id', merchantId)
    return new Response(JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
```

```bash
supabase functions deploy lalamove-test-connection
```


***

## Step 3 — Updated `src/app/(dashboard)/settings/page.tsx`

```typescript
import { getMerchant } from '@/lib/utils.server'
import { SettingsClient } from '@/components/dashboard/SettingsClient'

export default async function SettingsPage() {
  const { supabase, merchant, user } = await getMerchant()

  const { data: lalamoveConfig } = await supabase
    .from('merchant_lalamove_config')
    .select('*')
    .eq('merchant_id', merchant.id)
    .single()

  return (
    <SettingsClient
      merchant={merchant}
      user={user}
      lalamoveConfig={lalamoveConfig}
    />
  )
}
```


***

## Step 4 — `src/components/dashboard/SettingsClient.tsx`

Tabbed settings shell — swap in your existing store/address tabs here:

```typescript
'use client'
import { useState }          from 'react'
import { cn }                from '@/lib/utils'
import { StoreSettings }     from './settings/StoreSettings'
import { LalamoveSettings }  from './settings/LalamoveSettings'

const TABS = [
  { key: 'store',    label: '🏪  Store Info'  },
  { key: 'lalamove', label: '🏍️  Lalamove'   },
  { key: 'hours',    label: '🕐  Hours'       },
  { key: 'payments', label: '💳  Payments'    },
]

export function SettingsClient({ merchant, user, lalamoveConfig }: {
  merchant: any; user: any; lalamoveConfig: any
}) {
  const [tab, setTab] = useState('store')

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap',
              tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'store'    && <StoreSettings    merchant={merchant} />}
      {tab === 'lalamove' && <LalamoveSettings config={lalamoveConfig} merchantId={merchant.id} />}
    </div>
  )
}
```


***

## File 5 — `src/components/dashboard/settings/LalamoveSettings.tsx`

The full Lalamove configuration panel:[^2][^3]

```typescript
'use client'
import { useState, useCallback } from 'react'
import { createClient }  from '@/lib/supabase/client'
import { Button }        from '@/components/ui/button'
import { Input }         from '@/components/ui/input'
import { Label }         from '@/components/ui/label'
import { Textarea }      from '@/components/ui/textarea'
import { Switch }        from '@/components/ui/switch'
import toast             from 'react-hot-toast'
import { cn }            from '@/lib/utils'
import {
  Eye, EyeOff, Copy, CheckCircle2, XCircle,
  Loader2, ExternalLink, AlertTriangle, RefreshCw,
} from 'lucide-react'

// ─── Reference data ────────────────────────────────────────────────────────

const MARKETS = [
  { value: 'MY_KUL', label: '🇲🇾  Kuala Lumpur'  },
  { value: 'MY_JHB', label: '🇲🇾  Johor Bahru'    },
  { value: 'MY_PNG', label: '🇲🇾  Penang'          },
  { value: 'MY_IPH', label: '🇲🇾  Ipoh'            },
  { value: 'MY_KCH', label: '🇲🇾  Kuching'         },
  { value: 'MY_BKI', label: '🇲🇾  Kota Kinabalu'   },
  { value: 'SG_SIN', label: '🇸🇬  Singapore'       },
]

const SERVICE_TYPES = [
  { value: 'MOTORCYCLE', label: '🏍️  Motorcycle',   desc: 'Up to 10 kg, fastest'       },
  { value: 'CAR',        label: '🚗  Car',           desc: 'Up to 20 kg, medium items'  },
  { value: 'VAN',        label: '🚐  Van',           desc: 'Up to 500 kg, bulky items'  },
  { value: 'TRUCK550',   label: '🚛  Truck (1.5T)',  desc: 'Up to 550 kg'               },
  { value: 'TRUCK1300',  label: '🚛  Truck (3T)',    desc: 'Up to 1300 kg'              },
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

export function LalamoveSettings({ config: initial, merchantId }: {
  config: any; merchantId: string
}) {
  const supabase = createClient()

  const [form, setForm] = useState({
    api_key:                 initial?.api_key               ?? '',
    api_secret:              initial?.api_secret            ?? '',
    environment:             initial?.environment           ?? 'sandbox',
    market:                  initial?.market                ?? 'MY_KUL',
    pickup_contact_name:     initial?.pickup_contact_name   ?? '',
    pickup_contact_phone:    initial?.pickup_contact_phone  ?? '',
    pickup_address_text:     initial?.pickup_address_text   ?? '',
    pickup_instructions:     initial?.pickup_instructions   ?? '',
    default_service_type:    initial?.default_service_type  ?? 'MOTORCYCLE',
    default_priority_fee_rm: initial?.default_priority_fee_rm ?? 0,
    auto_book_on_ready:      initial?.auto_book_on_ready    ?? false,
  })

  const [showKey,    setShowKey]    = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [testing,    setTesting]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(
    initial?.last_test_result
      ? { ok: initial.last_test_result === 'success', message: initial.last_test_result }
      : null
  )
  const [copied, setCopied] = useState(false)

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  // Webhook URL — the endpoint Lalamove calls
  const webhookUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/lalamove-webhook`

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Test connection — calls Edge Function
  const handleTestConnection = async () => {
    if (!form.api_key || !form.api_secret) {
      toast.error('Enter your API Key and API Secret first')
      return
    }
    setTesting(true)
    setTestResult(null)

    const { data, error } = await supabase.functions.invoke('lalamove-test-connection', {
      body: {
        merchantId,
        apiKey:      form.api_key,
        apiSecret:   form.api_secret,
        environment: form.environment,
        market:      form.market,
      },
    })

    if (error || !data?.success) {
      const msg = data?.error ?? error?.message ?? 'Connection failed'
      setTestResult({ ok: false, message: msg })
      toast.error(`Connection failed: ${msg}`)
    } else {
      setTestResult({ ok: true, message: 'Connected successfully' })
      toast.success('Lalamove credentials verified ✅')
    }
    setTesting(false)
  }

  // Save all other settings (non-credential fields)
  const handleSave = async () => {
    if (!form.pickup_contact_name || !form.pickup_contact_phone || !form.pickup_address_text) {
      toast.error('Pickup contact name, phone, and address are required')
      return
    }
    setSaving(true)

    const { error } = await supabase
      .from('merchant_lalamove_config')
      .upsert({
        merchant_id:              merchantId,
        pickup_contact_name:      form.pickup_contact_name,
        pickup_contact_phone:     form.pickup_contact_phone,
        pickup_address_text:      form.pickup_address_text,
        pickup_instructions:      form.pickup_instructions,
        default_service_type:     form.default_service_type,
        default_priority_fee_rm:  Number(form.default_priority_fee_rm),
        auto_book_on_ready:       form.auto_book_on_ready,
        environment:              form.environment,
        market:                   form.market,
        updated_at:               new Date().toISOString(),
      }, { onConflict: 'merchant_id' })

    if (error) toast.error(error.message)
    else toast.success('Lalamove settings saved!')
    setSaving(false)
  }

  const isProduction  = form.environment === 'production'
  const lastTested    = initial?.last_tested_at

  return (
    <div className="space-y-4">

      {/* ── Credentials ──────────────────────────────────────────────────── */}
      <Section
        title="API Credentials"
        subtitle="Get your API Key and Secret from the Lalamove Partner Portal → Developers tab."
      >
        {/* Environment toggle */}
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
                Production mode uses real Lalamove credits and dispatches real drivers.
                Ensure your wallet is topped up at{' '}
                <a href="https://partnerportal.lalamove.com" target="_blank" rel="noreferrer"
                  className="underline font-medium">partnerportal.lalamove.com</a>.
              </p>
            </div>
          )}
        </div>

        {/* Market */}
        <div>
          <Label>Market / City</Label>
          <select value={form.market} onChange={e => set('market', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mt-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
            {MARKETS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* API Key */}
        <div>
          <Label>API Key</Label>
          <div className="relative mt-1.5">
            <Input
              type={showKey ? 'text' : 'password'}
              value={form.api_key}
              onChange={e => set('api_key', e.target.value)}
              placeholder="Paste your Lalamove API Key"
              className="pr-10 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* API Secret */}
        <div>
          <Label>API Secret</Label>
          <div className="relative mt-1.5">
            <Input
              type={showSecret ? 'text' : 'password'}
              value={form.api_secret}
              onChange={e => set('api_secret', e.target.value)}
              placeholder="Paste your Lalamove API Secret"
              className="pr-10 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowSecret(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Test result badge */}
        {testResult && (
          <div className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2.5',
            testResult.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          )}>
            {testResult.ok
              ? <CheckCircle2 size={16} className="text-green-600 shrink-0" />
              : <XCircle      size={16} className="text-red-500   shrink-0" />}
            <div>
              <p className={cn('text-sm font-semibold',
                testResult.ok ? 'text-green-800' : 'text-red-700')}>
                {testResult.ok ? 'Credentials verified' : 'Connection failed'}
              </p>
              {!testResult.ok && (
                <p className="text-xs text-red-600 mt-0.5">{testResult.message}</p>
              )}
              {lastTested && (
                <p className="text-xs opacity-60 mt-0.5">
                  Last tested: {new Date(lastTested).toLocaleString('en-MY')}
                </p>
              )}
            </div>
          </div>
        )}

        <Button
          onClick={handleTestConnection}
          disabled={testing || !form.api_key || !form.api_secret}
          variant="outline"
          className="w-full"
        >
          {testing
            ? <><Loader2 size={15} className="animate-spin mr-2" />Testing connection...</>
            : <><RefreshCw size={15} className="mr-2" />Test Connection</>}
        </Button>

        <a
          href="https://partnerportal.lalamove.com"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 text-sm text-blue-600 hover:underline w-full"
        >
          <ExternalLink size={13} />
          Open Lalamove Partner Portal
        </a>
      </Section>

      {/* ── Webhook ───────────────────────────────────────────────────────── */}
      <Section
        title="Webhook Configuration"
        subtitle="Paste this URL into Lalamove Partner Portal → Developers → Webhooks. Required for real-time driver and status updates."
      >
        <div>
          <Label>Your Webhook URL</Label>
          <div className="flex gap-2 mt-1.5">
            <Input
              readOnly
              value={webhookUrl}
              className="font-mono text-xs bg-gray-50 text-gray-600 flex-1"
            />
            <Button variant="outline" size="sm" onClick={handleCopyWebhook} className="shrink-0">
              {copied ? <CheckCircle2 size={15} className="text-green-600" /> : <Copy size={15} />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </div>

        <div className="bg-blue-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-blue-800">Setup Instructions</p>
          <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
            <li>Go to <a href="https://partnerportal.lalamove.com" target="_blank" rel="noreferrer" className="underline font-medium">partnerportal.lalamove.com</a></li>
            <li>Navigate to <strong>Developers → Webhooks</strong></li>
            <li>Paste the URL above into the Webhook URL field</li>
            <li>Set Webhook Version to <strong>3</strong></li>
            <li>Click <strong>Save</strong></li>
          </ol>
        </div>

        {/* Webhook verified indicator */}
        <div className={cn('flex items-center gap-2 rounded-xl px-3 py-2',
          initial?.webhook_verified ? 'bg-green-50' : 'bg-gray-50')}>
          {initial?.webhook_verified
            ? <CheckCircle2 size={14} className="text-green-500" />
            : <AlertTriangle size={14} className="text-amber-500" />}
          <p className="text-xs text-gray-600">
            {initial?.webhook_verified
              ? 'Webhook has received at least one event ✓'
              : 'Webhook not yet verified — no events received. Complete setup above.'}
          </p>
        </div>
      </Section>

      {/* ── Pickup location ───────────────────────────────────────────────── */}
      <Section
        title="Pickup Location"
        subtitle="The address Lalamove drivers will come to collect orders."
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Contact Name *</Label>
            <Input
              value={form.pickup_contact_name}
              onChange={e => set('pickup_contact_name', e.target.value)}
              placeholder="e.g. Ali Hassan"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Contact Phone * <span className="text-gray-400 font-normal">(E.164)</span></Label>
            <Input
              value={form.pickup_contact_phone}
              onChange={e => set('pickup_contact_phone', e.target.value)}
              placeholder="+60123456789"
              className="mt-1.5 font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">Must start with +60 for Malaysia</p>
          </div>
        </div>

        <div>
          <Label>Pickup Address *</Label>
          <Textarea
            value={form.pickup_address_text}
            onChange={e => set('pickup_address_text', e.target.value)}
            placeholder="Full address e.g. 12, Jalan Bukit Bintang, 55100 Kuala Lumpur"
            rows={2}
            className="mt-1.5"
          />
          <p className="text-xs text-gray-400 mt-1">
            This is sent to Lalamove as the pickup stop. Make sure it's precise enough to geocode correctly.
          </p>
        </div>

        <div>
          <Label>Driver Instructions at Pickup <span className="text-gray-400 font-normal">(optional)</span></Label>
          <Input
            value={form.pickup_instructions}
            onChange={e => set('pickup_instructions', e.target.value)}
            placeholder="e.g. Call when arrived, enter from side gate"
            className="mt-1.5"
          />
        </div>
      </Section>

      {/* ── Service defaults ──────────────────────────────────────────────── */}
      <Section
        title="Service Defaults"
        subtitle="Applied when creating new Lalamove orders unless overridden per order."
      >
        <div>
          <Label>Default Vehicle Type</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5">
            {SERVICE_TYPES.map(s => (
              <button key={s.value}
                onClick={() => set('default_service_type', s.value)}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-colors',
                  form.default_service_type === s.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-100 hover:border-gray-200'
                )}
              >
                <span className="text-xl leading-none mt-0.5">{s.label.split('  ')[^0]}</span>
                <div>
                  <p className={cn('text-sm font-semibold',
                    form.default_service_type === s.value ? 'text-blue-700' : 'text-gray-800')}>
                    {s.label.split('  ')[^1]}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Default Priority Fee (RM)</Label>
          <Input
            type="number"
            min="0"
            max="50"
            step="0.5"
            value={form.default_priority_fee_rm}
            onChange={e => set('default_priority_fee_rm', e.target.value)}
            className="mt-1.5 w-32"
          />
          <p className="text-xs text-gray-400 mt-1">
            Added to every order to attract drivers faster. RM 0 = no priority fee.
          </p>
        </div>
      </Section>

      {/* ── Automation ────────────────────────────────────────────────────── */}
      <Section
        title="Automation"
        subtitle="Reduce manual steps for your team."
      >
        <ToggleRow
          label="Auto-book driver when order is ready"
          desc="Automatically calls Lalamove to find a driver the moment you mark an order as Ready for Pickup. You won't need to tap Book on each order individually."
          checked={form.auto_book_on_ready}
          onChange={v => set('auto_book_on_ready', v)}
        />
        {form.auto_book_on_ready && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">
              Auto-booking will immediately charge your Lalamove wallet when an order is marked ready.
              Make sure your wallet always has sufficient balance.
            </p>
          </div>
        )}
      </Section>

      {/* ── Save button ───────────────────────────────────────────────────── */}
      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving
          ? <><Loader2 size={15} className="animate-spin mr-2" />Saving...</>
          : 'Save Lalamove Settings'}
      </Button>

    </div>
  )
}
```


***

## Step 6 — Use saved config in `lalamove-create-order`

Pull the merchant's pickup location and service defaults from the config table instead of hardcoding:[^3]

```typescript
// In supabase/functions/lalamove-create-order/index.ts
// Replace hardcoded pickup with DB lookup:

const { data: llConfig } = await supabase
  .from('merchant_lalamove_config')
  .select('*')
  .eq('merchant_id', order.merchant_id)
  .single()

if (!llConfig?.api_key || !llConfig?.api_secret) {
  return err('Lalamove not configured — go to Dashboard → Settings → Lalamove')
}

const BASE = llConfig.environment === 'production'
  ? 'https://rest.lalamove.com'
  : 'https://rest.sandbox.lalamove.com'

// Pickup stop built from config:
const pickupStop = {
  coordinates:  { lat: String(llConfig.pickup_lat ?? '3.1486'), lng: String(llConfig.pickup_lng ?? '101.6942') },
  address:      llConfig.pickup_address_text,
  name:         llConfig.pickup_contact_name,
  phone:        llConfig.pickup_contact_phone,
  remarks:      llConfig.pickup_instructions ?? '',
}

// Service type from order, falling back to merchant default:
const serviceType = order.delivery_service_id ?? llConfig.default_service_type ?? 'MOTORCYCLE'

// Priority fee from config (can be overridden per-order):
const priorityFee = llConfig.default_priority_fee_rm > 0
  ? Math.round(llConfig.default_priority_fee_rm * 100)  // convert to sen
  : 0
```


***

## What's now fully configurable

| Setting | Where used |
| :-- | :-- |
| Environment (sandbox/production) | All Lalamove Edge Functions |
| Market / city | Quote + order creation headers |
| API Key + Secret | HMAC signature in every API call |
| Pickup contact name + phone | Pickup stop in every order |
| Pickup address | Geocoded pickup coordinates |
| Pickup driver instructions | `remarks` field on pickup stop |
| Default vehicle type | Fallback when no service selected at checkout |
| Default priority fee | Added to every order automatically |
| Auto-book on ready | Triggers booking in `lalamove-webhook` status update handler |
| Webhook URL | Copy-paste into Lalamove Partner Portal [^2] |

<span style="display:none">[^10][^11][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://www.lalamove.com/en-my/business/api-solutions

[^2]: https://lalamove.jomdesign.my/how-to-setup-webhook/

[^3]: https://help.papaya.co.th/en/articles/9144202-delivery-order-fulfilment-with-lalamove-a-quick-guide

[^4]: https://www.lalamove.com/en-my/blog/tag/2025-income-target

[^5]: https://github.com/lalamove/api-examples

[^6]: https://www.lalamove.com/en-my/terms-and-conditions

[^7]: https://www.lalamove.com/en-vn/faq

[^8]: https://www.lalamove.com/en-my/business/e-commerce-api-monthly-treats

[^9]: https://my.justorder.today/en/docs/integrate-with-lalamove/

[^10]: https://oneship.io/hk/en/how-to-integrate-your-lalamove-account/

[^11]: https://help.take.app/en/articles/10632152-lalamove-integration

