'use client'
import { useState } from 'react'
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
import { invokeWorker } from '@/lib/worker'

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
    is_enabled:              initial?.is_enabled            ?? false,
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
  const webhookUrl = `https://functions-worker.jjooi1707.workers.dev/webhooks/lalamove`

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

    const { data, error } = await invokeWorker('lalamove-test-connection', {
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

  const handleSave = async () => {
    if (!form.pickup_contact_name || !form.pickup_contact_phone || !form.pickup_address_text) {
      toast.error('Pickup contact name, phone, and address are required')
      return
    }
    const hasCredentials = !!(form.api_key && form.api_secret)
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
        api_key:                  form.api_key || null,
        api_secret:               form.api_secret || null,
        is_enabled:               hasCredentials,
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
        subtitle="Choose between using the platform's account or your own Lalamove account."
      >
        {/* Custom Account Toggle Removed - logic handled by presence of keys */}

        {/* Environment toggle */}
        <div>
          <Label>Environment (Diagnostic Only)</Label>
          <div className="flex gap-2 mt-1.5">
            {(['sandbox', 'production'] as const).map(env => (
              <button key={env}
                onClick={() => set('environment', env)}
                className={cn(
                  'flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-colors capitalize',
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
        </div>

        {/* Market */}
        <div>
          <Label>Market / City</Label>
          <select value={form.market} onChange={e => set('market', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
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
              placeholder="System default used if empty"
              className="pr-10 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
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
              placeholder="System default used if empty"
              className="pr-10 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowSecret(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
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
                type="button"
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-colors',
                  form.default_service_type === s.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-100 hover:border-gray-200'
                )}
              >
                <span className="text-xl leading-none mt-0.5">{s.label.split('  ')[0]}</span>
                <div>
                  <p className={cn('text-sm font-semibold',
                    form.default_service_type === s.value ? 'text-blue-700' : 'text-gray-800')}>
                    {s.label.split('  ')[1]}
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
