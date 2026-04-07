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

export function EasyParcelSettings({ config: initial, merchantId, merchant }: {
  config: any; merchantId: string; merchant: any
}) {
  const supabase = createClient()
  const [form, setForm] = useState({
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
    is_enabled:           initial?.is_enabled          ?? false,
    api_key:              initial?.api_key             ?? '',
    auth_key:             initial?.auth_key            ?? '',
  })

  const [saving, setSaving] = useState(false)
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const handleSyncFromStore = () => {
    if (!merchant) return
    setForm(p => ({
      ...p,
      sender_name:     merchant.store_name     || p.sender_name,
      sender_phone:    merchant.phone          || p.sender_phone,
      sender_email:    merchant.email          || p.sender_email,
      sender_address1: merchant.address_line1  || p.sender_address1,
      sender_address2: merchant.address_line2  || p.sender_address2,
      sender_city:     merchant.city           || p.sender_city,
      sender_state:    merchant.state          || p.sender_state,
      sender_postcode: merchant.postcode       || p.sender_postcode,
    }))
    toast.success('Synced from store profile!')
  }

  const handleSave = async () => {
    if (form.is_enabled && (!form.api_key || !form.auth_key)) {
      toast.error('API Key and Auth Key are required to use your own EasyParcel account')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('merchant_easyparcel_config')
      .upsert({
        merchant_id:         merchantId,
        ...form,
        updated_at:          new Date().toISOString(),
      }, { onConflict: 'merchant_id' })

    if (error) toast.error(error.message)
    else toast.success('EasyParcel settings saved!')
    setSaving(false)
  }

  return (
    <div className="space-y-4 pt-1">
      <Section
        title="Custom Account"
        subtitle="Choose between using the platform's account or your own EasyParcel account."
      >
        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-2xl border border-blue-100">
          <div className="space-y-0.5">
            <Label className="text-base font-bold text-blue-900">Use Custom EasyParcel Account</Label>
            <p className="text-xs text-blue-700">Enable this to use your own API Key and Auth Key. Otherwise, the platform's account will be used.</p>
          </div>
          <Switch
            checked={form.is_enabled}
            onCheckedChange={v => set('is_enabled', v)}
          />
        </div>

        {!form.is_enabled && (
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex gap-2.5 items-start">
            <AlertTriangle size={15} className="text-gray-400 mt-0.5 shrink-0" />
            <p className="text-xs text-gray-500 leading-relaxed">
              <strong>Platform Managed:</strong> Shipments are currently processed using the platform's global EasyParcel account. 
              You do not need to provide credentials unless you want to use your own account for billing.
            </p>
          </div>
        )}

        {form.is_enabled && (
          <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>API Key</Label>
                <Input
                  value={form.api_key}
                  onChange={e => set('api_key', e.target.value)}
                  placeholder="ep-..."
                  className="mt-1.5 font-mono text-sm"
                />
              </div>
              <div>
                <Label>Auth Key</Label>
                <Input
                  value={form.auth_key}
                  onChange={e => set('auth_key', e.target.value)}
                  placeholder="Paste your EasyParcel Auth Key"
                  className="mt-1.5 font-mono text-sm"
                />
              </div>
            </div>
            <a
              href="https://easyparcel.com/my/en/integration/api-key/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
            >
              <ExternalLink size={12} />
              Find your keys in EasyParcel Dashboard
            </a>
          </div>
        )}
      </Section>

      <Section
        title="Sender Details"
        subtitle="These appear on the AWB (airway bill) as the sender. Must match your EasyParcel account details."
      >
        <div className="flex justify-end -mt-1">
          <Button variant="ghost" size="xs" onClick={handleSyncFromStore} className="text-blue-600 hover:text-blue-700 h-7 px-2">
            <RefreshCw size={12} className="mr-1" /> Sync from Store Profile
          </Button>
        </div>
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
