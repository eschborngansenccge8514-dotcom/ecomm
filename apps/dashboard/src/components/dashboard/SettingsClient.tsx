'use client'
import { useState } from 'react'
import { useRouter }   from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { cn }       from '@/lib/utils'
import toast        from 'react-hot-toast'
import {
  STORE_TYPES, DEFAULT_APPEARANCE,
  DEFAULT_CONFIG, cssVarsFromAppearance,
  type StoreType, type StoreAppearance, type StoreConfig,
} from '@/lib/store-types'
import { 
  Save, Globe, Palette, Clock, Truck, Megaphone, FileText, 
  Eye, Loader2, Plus, Trash2, GripVertical, MapPin, CreditCard, ShoppingBag
} from 'lucide-react'

// Providers
import { LalamoveSettings }  from './settings/LalamoveSettings'
import { EasyParcelSettings } from './settings/EasyParcelSettings'
import { RazorpaySettings }   from './settings/RazorpaySettings'
import { BillplzSettings }   from './settings/BillplzSettings'
import { EInvoiceSettings } from './settings/EInvoiceSettings'

// ─── Constants ───────────────────────────────────────────────────────────────
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MY_STATES = ['Johor','Kedah','Kelantan','Melaka','Negeri Sembilan','Pahang','Perak','Perlis',
  'Pulau Pinang','Sabah','Sarawak','Selangor','Terengganu','Kuala Lumpur','Putrajaya','Labuan']
const ANNOUNCEMENT_TYPES = [
  { value:'info',    label:'ℹ️ Info',     bg:'#2563eb' },
  { value:'promo',   label:'🎉 Promo',    bg:'#7c3aed' },
  { value:'warning', label:'⚠️ Warning',  bg:'#d97706' },
  { value:'holiday', label:'🎊 Holiday',  bg:'#059669' },
]
const PALETTE = [
  '#2563eb','#7c3aed','#059669','#dc2626','#d97706','#0891b2',
  '#be185d','#111827','#65a30d','#ea580c','#ec4899','#8b5cf6',
]

// ─── UI Components ──────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
      <div>
        <h3 className="font-bold text-gray-900">{title}</h3>
        {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {PALETTE.map(c => (
        <button key={c} onClick={() => onChange(c)} title={c}
          className={cn('w-7 h-7 rounded-full border-2 transition-transform hover:scale-110',
            value === c ? 'border-gray-900 scale-110' : 'border-transparent')}>
          <div className="w-full h-full rounded-full" style={{ backgroundColor: c }} />
        </button>
      ))}
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        className="w-8 h-8 rounded-full border-2 border-gray-200 cursor-pointer overflow-hidden p-0.5"
        title="Custom colour" />
      <span className="text-xs font-mono text-gray-400">{value}</span>
    </div>
  )
}

function StorePreview({ appearance, storeName, storeType }: {
  appearance: StoreAppearance; storeName: string; storeType: StoreType
}) {
  const meta = STORE_TYPES[storeType]
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm max-w-xs bg-white">
      {/* Banner */}
      <div className="h-16 flex items-center justify-center text-2xl relative bg-gray-50"
        style={{ backgroundColor: appearance.primaryColor + '15' }}>
        {appearance.bannerUrl
          ? (
            <div className="relative w-full h-full">
              <Image src={appearance.bannerUrl} fill className="object-cover" alt="" />
            </div>
          ) : <span className="opacity-40">{meta.icon}</span>}
      </div>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-100">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 relative overflow-hidden"
          style={{ backgroundColor: appearance.primaryColor }}>
          {appearance.logoUrl
            ? (
              <div className="relative w-full h-full">
                <Image src={appearance.logoUrl} fill className="object-cover" alt="" />
              </div>
            ) : storeName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-gray-900 text-sm truncate" style={{ fontFamily: appearance.fontFamily }}>{storeName}</p>
          <p className="text-[10px] text-gray-400 truncate">{appearance.tagline || meta.desc}</p>
        </div>
      </div>
      {/* Sample content */}
      <div className="p-3 bg-gray-50/50">
        <div className="grid grid-cols-2 gap-2">
          {[1,2].map(i => (
            <div key={i} className="bg-white rounded-xl overflow-hidden border border-gray-100 p-2">
              <div className="aspect-square rounded-lg mb-2 flex items-center justify-center text-lg"
                style={{ backgroundColor: appearance.accentColor + '10' }}>
                {meta.icon}
              </div>
              <div className="h-2 bg-gray-100 rounded-full w-3/4 mb-1" />
              <div className="h-2 bg-gray-100 rounded-full w-1/2" />
            </div>
          ))}
        </div>
        <button className="w-full mt-3 py-2 rounded-xl text-white text-[10px] font-bold transition-all shadow-sm"
          style={{ backgroundColor: appearance.primaryColor }}>
          View Menu
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function SettingsClient({ 
  merchant, 
  lalamoveConfig, 
  easyparcelConfig, 
  razorpayConfig, 
  billplzConfig,
  einvoiceConfig,
  operatingHours: initHours = [],
  announcements: initAnn = []
}: {
  merchant: any; 
  lalamoveConfig: any; 
  easyparcelConfig: any; 
  razorpayConfig: any; 
  billplzConfig: any;
  einvoiceConfig: any;
  operatingHours: any[];
  announcements: any[];
}) {
  const router   = useRouter()
  const supabase = createClient()

  // ── State ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'store'|'appearance'|'ops'|'logistics'|'payments'|'einvoice'|'delivery'|'announcements'|'policies'>('store')
  const [subTab, setSubTab] = useState('lalamove') // for logistics/payments
  const [saving, setSaving] = useState(false)

  // Core Data State
  const [storeType]  = useState<StoreType>((merchant.store_type as StoreType) ?? 'general')
  const [storeName, setStoreName] = useState(merchant.store_name ?? '')
  const [slug,      setSlug]      = useState(merchant.store_slug ?? '')
  const [appearance, setAppearance] = useState<StoreAppearance>({ ...DEFAULT_APPEARANCE, ...(merchant.appearance ?? {}) })
  const [config,     setConfig]     = useState<StoreConfig>({ 
    ...DEFAULT_CONFIG, 
    ...(merchant.store_config ?? {}),
    // Fallback to top-level columns if jsonb is missing
    address: (merchant.store_config?.address ?? merchant.address_line1) ?? '',
    city: (merchant.store_config?.city ?? merchant.city) ?? '',
    state: (merchant.store_config?.state ?? merchant.state) ?? '',
    postcode: (merchant.store_config?.postcode ?? merchant.postcode) ?? '',
    lat: (merchant.store_config?.lat ?? merchant.lat) ?? null,
    lng: (merchant.store_config?.lng ?? merchant.lng) ?? null,
    phone: (merchant.store_config?.phone ?? merchant.phone) ?? '',
    email: (merchant.store_config?.email ?? merchant.email) ?? '',
    minOrderAmount: (merchant.store_config?.minOrderAmount ?? merchant.min_order_amount) ?? 0,
    delivery_radius_km: (merchant.store_config?.delivery_radius_km ?? merchant.delivery_radius_km) ?? 10,
  })

  // Hours & Announcements
  const [hours, setHours] = useState(
    DAYS.map((_, d) => (initHours || []).find((h: any) => h.day_of_week === d) ?? { 
      day_of_week: d, open_time: '09:00', close_time: '22:00', is_closed: d === 0 
    })
  )
  const [announcements, setAnnouncements] = useState(initAnn)
  const [newAnn, setNewAnn] = useState({ message:'', type:'info', bg_color:'#2563eb', text_color:'#ffffff', link_url:'', link_text:'' })

  const setApp = (k: keyof StoreAppearance, v: any) => setAppearance(p => ({ ...p, [k]: v }))
  const setCfg = (k: keyof StoreConfig,     v: any) => setConfig(p => ({ ...p, [k]: v }))

  // ── Save Logic ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    try {
      // 1. Update Merchant Table
      const { error: merr } = await supabase.from('merchants')
        .update({
          store_name:   storeName,
          store_slug:   slug || (storeName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')),
          appearance:   appearance,
          store_config: config,
          // Sync top-level columns for backwards support
          address_line1: config.address,
          city: config.city,
          state: config.state,
          postcode: config.postcode,
          lat: config.lat,
          lng: config.lng,
          phone: config.phone,
          email: config.email,
          min_order_amount: config.minOrderAmount,
          delivery_radius_km: config.delivery_radius_km,
        })
        .eq('id', merchant.id)
      if (merr) throw merr

      // 2. Save Operating Hours
      const { error: herr } = await supabase.from('merchant_operating_hours')
        .upsert(hours.map(h => ({ ...h, merchant_id: merchant.id })),
          { onConflict: 'merchant_id,day_of_week' })
      if (herr) throw herr

      toast.success('Settings saved successfully!')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Announcements Logic ────────────────────────────────────────────────────
  const addAnnouncement = async () => {
    if (!newAnn.message.trim()) { toast.error('Message is required'); return }
    const { data, error } = await supabase.from('store_announcements')
      .insert({ ...newAnn, merchant_id: merchant.id, is_active: true })
      .select().single()
    if (error) { toast.error(error.message); return }
    setAnnouncements(p => [...p, data])
    setNewAnn({ message:'', type:'info', bg_color:'#2563eb', text_color:'#ffffff', link_url:'', link_text:'' })
    toast.success('Announcement added')
  }

  const deleteAnnouncement = async (id: string) => {
    await supabase.from('store_announcements').delete().eq('id', id)
    setAnnouncements(p => p.filter(a => a.id !== id))
    toast.success('Deleted')
  }

  const toggleAnnouncement = async (id: string, current: boolean) => {
    await supabase.from('store_announcements').update({ is_active: !current }).eq('id', id)
    setAnnouncements(p => p.map(a => a.id === id ? { ...a, is_active: !current } : a))
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const TABS = [
    { key: 'store',        label: 'Store',        icon: <Globe size={14} /> },
    { key: 'appearance',   label: 'Appearance',   icon: <Palette size={14} /> },
    { key: 'ops',          label: 'Operations',   icon: <Clock size={14} /> },
    { key: 'logistics',    label: 'Logistics',    icon: <Truck size={14} /> },
    { key: 'payments',     label: 'Payments',     icon: <CreditCard size={14} /> },
    { key: 'einvoice',     label: 'E-Invoice',    icon: <FileText size={14} /> },
    { key: 'delivery',     label: 'Fulfillment',   icon: <ShoppingBag size={14} /> },
    { key: 'announcements', label: 'Announcements', icon: <Megaphone size={14} /> },
    { key: 'policies',     label: 'Policies',     icon: <FileText size={14} /> },
  ] as const

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Settings</h1>
          <p className="text-sm text-gray-400 mt-1">Manage your store identity, look and feel, and business operations.</p>
        </div>
        <div className="flex items-center gap-3">
          {slug && (
            <a href={`/store/${slug}`} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="rounded-xl text-gray-500 hover:text-gray-900">
                <Eye size={16} className="mr-2" /> Preview Store
              </Button>
            </a>
          )}
          <Button onClick={handleSave} disabled={saving} className="rounded-xl px-6 h-11 bg-gray-900 hover:bg-black text-white shadow-lg active:scale-95 transition-all">
            {saving ? <Loader2 size={18} className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
            Save All
          </Button>
        </div>
      </div>

      {/* Main Layout: Sidebar Tabs + Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Sidebar Tabs */}
        <div className="lg:col-span-3 space-y-2">
          <div className="bg-white p-2 rounded-3xl border border-gray-100 shadow-sm flex lg:flex-col overflow-x-auto lg:overflow-visible no-scrollbar gap-1">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); if (t.key === 'logistics') setSubTab('lalamove'); if (t.key === 'payments') setSubTab('razorpay'); }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all whitespace-nowrap",
                  tab === t.key 
                    ? "bg-gray-900 text-white shadow-md lg:translate-x-1" 
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <span className={cn("shrink-0", tab === t.key ? "text-white" : "text-gray-400")}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-9 space-y-6 min-h-[600px]">
          
          {/* STORE TAB */}
          {tab === 'store' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-6">
                <Section title="Store Identity" desc="How customer identifies your brand and finds your link.">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Store Name *">
                      <Input value={storeName} 
                        onChange={e => { setStoreName(e.target.value); if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')) }}
                        className="rounded-xl h-11" placeholder="e.g. Mama's Kitchen" />
                    </Field>
                    <Field label="URL Slug" hint={`store/${slug || '...'}`}>
                      <Input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))}
                        className="rounded-xl h-11" placeholder="mamas-kitchen" />
                    </Field>
                  </div>
                  <Field label="Tagline" hint="A short sentence shown under your store name">
                    <Input value={appearance.tagline} onChange={e => setApp('tagline', e.target.value)}
                      className="rounded-xl h-11" placeholder="e.g. Fresh homemade food, delivered daily" />
                  </Field>
                </Section>

                <Section title="Location & Address" desc="Provide your physical address for logistics and map identification.">
                  <Field label="Street Address">
                    <Input value={config.address} onChange={e => setCfg('address', e.target.value)} className="rounded-xl h-11" placeholder="No. 12, Jalan..." />
                  </Field>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="City"><Input value={config.city} onChange={e => setCfg('city', e.target.value)} className="rounded-xl h-11" placeholder="KL" /></Field>
                    <Field label="State">
                      <select value={config.state} onChange={e => setCfg('state', e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 h-11 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none bg-white">
                        <option value="">Select state</option>
                        {MY_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </Field>
                    <Field label="Postcode"><Input value={config.postcode} onChange={e => setCfg('postcode', e.target.value)} className="rounded-xl h-11" placeholder="47500" /></Field>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <div className="flex-1"><Input type="number" step="any" value={config.lat ?? ''} onChange={e => setCfg('lat', parseFloat(e.target.value))} placeholder="Latitude" className="rounded-xl h-11" /></div>
                    <div className="flex-1"><Input type="number" step="any" value={config.lng ?? ''} onChange={e => setCfg('lng', parseFloat(e.target.value))} placeholder="Longitude" className="rounded-xl h-11" /></div>
                    <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl shrink-0" 
                      onClick={() => {
                        if ('geolocation' in navigator) {
                          navigator.geolocation.getCurrentPosition((pos) => {
                            setCfg('lat', pos.coords.latitude)
                            setCfg('lng', pos.coords.longitude)
                            toast.success('Location updated!')
                          })
                        }
                      }}>
                      <MapPin size={18} className="text-blue-600" />
                    </Button>
                  </div>
                </Section>

                <Section title="SEO" desc="Improve your store's ranking on search engines.">
                  <div className="space-y-4">
                    <Field label="Meta Title"><Input value={config.metaTitle} onChange={e => setCfg('metaTitle', e.target.value)} className="rounded-xl h-11" placeholder="Title..." /></Field>
                    <Field label="Meta Description"><Input value={config.metaDescription} onChange={e => setCfg('metaDescription', e.target.value)} className="rounded-xl h-11" placeholder="Short summary..." /></Field>
                  </div>
                </Section>

                <Section title="Tax & POS" desc="Configure transactional settings for your Point of Sale.">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="SST Tax Rate (%)" hint="Current standard is 8%. Set to 0 if not registered.">
                      <Input type="number" min="0" max="100" step="1" 
                        value={config.taxRate ?? 8} 
                        onChange={e => setCfg('taxRate', parseInt(e.target.value) || 0)} 
                        className="rounded-xl h-11 font-bold" />
                    </Field>
                  </div>
                </Section>
              </div>

              {/* Preview */}
              <div className="hidden xl:block">
                <div className="sticky top-6">
                   <p className="text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Storefront Preview</p>
                   <StorePreview appearance={appearance} storeName={storeName || 'Your Store'} storeType={storeType} />
                </div>
              </div>
            </div>
          )}

          {/* APPEARANCE TAB */}
          {tab === 'appearance' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-6">
                <Section title="Visual Branding" desc="Upload your logo and banners to define your store's personality.">
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Logo URL"><Input value={appearance.logoUrl} onChange={e => setApp('logoUrl', e.target.value)} className="rounded-xl h-11" placeholder="https://..." /></Field>
                      <Field label="Favicon URL"><Input value={appearance.favicon} onChange={e => setApp('favicon', e.target.value)} className="rounded-xl h-11" placeholder="https://..." /></Field>
                      <Field label="Desktop Banner"><Input value={appearance.bannerUrl} onChange={e => setApp('bannerUrl', e.target.value)} className="rounded-xl h-11" placeholder="https://..." /></Field>
                      <Field label="Mobile Banner"><Input value={appearance.bannerMobileUrl} onChange={e => setApp('bannerMobileUrl', e.target.value)} className="rounded-xl h-11" placeholder="https://..." /></Field>
                   </div>
                </Section>

                <Section title="Colors" desc="Select your primary and accent colors for buttons and highlights.">
                  <div className="space-y-6">
                    <Field label="Primary Theme Color">
                      <ColorPicker value={appearance.primaryColor} onChange={v => setApp('primaryColor', v)} />
                    </Field>
                    <Field label="Accent Color">
                      <ColorPicker value={appearance.accentColor} onChange={v => setApp('accentColor', v)} />
                    </Field>
                  </div>
                </Section>

                <Section title="Layout Styles">
                   <Field label="Product Grid Layout">
                      <div className="flex gap-2 p-1 bg-gray-50 rounded-2xl">
                        {(['grid','masonry','list'] as const).map(l => (
                          <button key={l} onClick={() => setApp('layout', l)}
                             className={cn("flex-1 py-3 rounded-xl text-sm font-bold capitalize transition-all",
                             appearance.layout === l ? "bg-white shadow-sm text-gray-900" : "text-gray-400 hover:text-gray-600")}>
                             {l}
                          </button>
                        ))}
                      </div>
                   </Field>
                   <Field label="Corner Roundness">
                      <div className="flex gap-2 p-1 bg-gray-50 rounded-2xl">
                        {(['sharp','rounded','pill'] as const).map(r => (
                          <button key={r} onClick={() => setApp('borderRadius', r)}
                             className={cn("flex-1 py-3 rounded-xl text-sm font-bold capitalize transition-all",
                             appearance.borderRadius === r ? "bg-white shadow-sm text-gray-900" : "text-gray-400 hover:text-gray-600")}>
                             {r}
                          </button>
                        ))}
                      </div>
                   </Field>
                </Section>
              </div>

              {/* Preview */}
              <div className="hidden xl:block">
                <div className="sticky top-6">
                   <p className="text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Storefront Preview</p>
                   <StorePreview appearance={appearance} storeName={storeName} storeType={storeType} />
                </div>
              </div>
            </div>
          )}

          {/* OPERATIONS TAB */}
          {tab === 'ops' && (
            <div className="space-y-6">
              <Section title="Contact Info" desc="How customers and the system can reach your business.">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Business Phone"><Input value={config.phone} onChange={e => setCfg('phone', e.target.value)} className="rounded-xl h-11" placeholder="012-..." /></Field>
                  <Field label="WhatsApp Link"><Input value={config.whatsapp} onChange={e => setCfg('whatsapp', e.target.value)} className="rounded-xl h-11" placeholder="+60..." /></Field>
                  <Field label="Public Email"><Input value={config.email} onChange={e => setCfg('email', e.target.value)} className="rounded-xl h-11" placeholder="hello@store.com" /></Field>
                  <Field label="Official Website"><Input value={config.website} onChange={e => setCfg('website', e.target.value)} className="rounded-xl h-11" placeholder="https://..." /></Field>
                </div>
              </Section>

              <Section title="Social Media Presence">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Instagram"><Input value={config.instagram} onChange={e => setCfg('instagram', e.target.value)} className="rounded-xl h-11" placeholder="@username" /></Field>
                    <Field label="Facebook"><Input value={config.facebook} onChange={e => setCfg('facebook', e.target.value)} className="rounded-xl h-11" placeholder="fb.com/..." /></Field>
                    <Field label="TikTok"><Input value={config.tiktok} onChange={e => setCfg('tiktok', e.target.value)} className="rounded-xl h-11" placeholder="@username" /></Field>
                    <Field label="Twitter / X"><Input value={config.twitter} onChange={e => setCfg('twitter', e.target.value)} className="rounded-xl h-11" placeholder="@username" /></Field>
                 </div>
              </Section>

              <Section title="Store Operating Hours" desc="Control when your store is shown as 'Open' for orders.">
                 <div className="space-y-3 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                    {DAYS.map((day, d) => {
                      const h = hours[d]
                      return (
                        <div key={d} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white rounded-xl border border-gray-100">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-black text-gray-400">{day.substring(0,3)}</div>
                             <button onClick={() => setHours(prev => prev.map((x,i) => i === d ? { ...x, is_closed: !x.is_closed } : x))}
                                className={cn("px-4 py-2 rounded-lg text-xs font-black transition-all", h.is_closed ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600")}>
                                {h.is_closed ? 'CLOSED' : 'OPEN'}
                             </button>
                          </div>
                          {!h.is_closed && (
                            <div className="flex items-center gap-2">
                               <Input type="time" value={h.open_time ?? '09:00'} onChange={e => setHours(prev => prev.map((x,i) => i === d ? { ...x, open_time: e.target.value } : x))} className="w-28 h-9 rounded-lg text-xs font-bold" />
                               <span className="text-gray-300">to</span>
                               <Input type="time" value={h.close_time ?? '22:00'} onChange={e => setHours(prev => prev.map((x,i) => i === d ? { ...x, close_time: e.target.value } : x))} className="w-28 h-9 rounded-lg text-xs font-bold" />
                            </div>
                          )}
                        </div>
                      )
                    })}
                 </div>
              </Section>
            </div>
          )}

          {/* LOGISTICS TAB */}
          {tab === 'logistics' && (
            <div className="space-y-6">
               <div className="flex gap-2 p-1 bg-gray-200/50 rounded-2xl w-fit">
                  <button onClick={() => setSubTab('lalamove')} className={cn("px-6 py-2.5 rounded-xl text-xs font-black transition-all", subTab === 'lalamove' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>LALAMOVE</button>
                  <button onClick={() => setSubTab('easyparcel')} className={cn("px-6 py-2.5 rounded-xl text-xs font-black transition-all", subTab === 'easyparcel' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>EASYPARCEL</button>
               </div>
               <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-2">
                  {subTab === 'lalamove' && <LalamoveSettings config={lalamoveConfig} merchantId={merchant.id} />}
                  {subTab === 'easyparcel' && <EasyParcelSettings config={easyparcelConfig} merchantId={merchant.id} merchant={merchant} />}
               </div>
            </div>
          )}

          {/* PAYMENTS TAB */}
          {tab === 'payments' && (
            <div className="space-y-6">
               <div className="flex gap-2 p-1 bg-gray-200/50 rounded-2xl w-fit">
                  <button onClick={() => setSubTab('razorpay')} className={cn("px-6 py-2.5 rounded-xl text-xs font-black transition-all", subTab === 'razorpay' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>RAZORPAY</button>
                  <button onClick={() => setSubTab('billplz')} className={cn("px-6 py-2.5 rounded-xl text-xs font-black transition-all", subTab === 'billplz' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>BILLPLZ</button>
               </div>
               <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4">
                  {subTab === 'razorpay' && <RazorpaySettings config={razorpayConfig} merchantId={merchant.id} />}
                  {subTab === 'billplz' && <BillplzSettings config={billplzConfig} merchantId={merchant.id} />}
               </div>
            </div>
          )}

          {/* E-INVOICE TAB */}
          {tab === 'einvoice' && (
            <div className="max-w-2xl">
              <EInvoiceSettings config={einvoiceConfig} merchantId={merchant.id} />
            </div>
          )}

          {/* FULFILLMENT TAB */}
          {tab === 'delivery' && (
             <div className="space-y-6">
                <Section title="Delivery Rules" desc="Set global constraints for your delivery options.">
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Minimum Order Amount (RM)" hint="Customers can't checkout if order is below this.">
                        <Input type="number" min="0" step="0.01" value={config.minOrderAmount} onChange={e => setCfg('minOrderAmount', parseFloat(e.target.value))} className="rounded-xl h-11 font-bold" />
                      </Field>
                      <Field label="Free Delivery Above (RM)" hint="Set to 0 to disable free delivery promo.">
                        <Input type="number" min="0" step="0.01" value={config.freeDeliveryAbove} onChange={e => setCfg('freeDeliveryAbove', parseFloat(e.target.value))} className="rounded-xl h-11 font-bold" />
                      </Field>
                      <Field label="Max Delivery Radius (km)" hint="Only applicable for internal Lalamove delivery.">
                         <Input type="number" value={config.delivery_radius_km ?? 10} onChange={e => setCfg('delivery_radius_km', parseInt(e.target.value))} className="rounded-xl h-11 font-bold" />
                      </Field>
                   </div>
                </Section>
             </div>
          )}

          {/* ANNOUNCEMENTS TAB */}
          {tab === 'announcements' && (
             <div className="space-y-6">
                <Section title="Manage Announcements" desc="Promote offers or alert customers at the top of your shop.">
                   {announcements.length > 0 && (
                      <div className="space-y-2 mb-6">
                        {announcements.map(a => (
                          <div key={a.id} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-2xl group transition-all">
                             <div className="flex items-center gap-3">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.bg_color }} />
                                <div>
                                   <p className="text-sm font-bold text-gray-900">{a.message}</p>
                                   {a.link_url && <p className="text-[10px] text-blue-600 font-bold">{a.link_text || 'View Link'}</p>}
                                </div>
                             </div>
                             <div className="flex items-center gap-3 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => toggleAnnouncement(a.id, a.is_active)} className={cn("px-3 py-1 rounded-lg text-[10px] font-black", a.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500")}>{a.is_active ? 'LIVE' : 'IDLE'}</button>
                                <button onClick={() => deleteAnnouncement(a.id)} className="p-2 text-red-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                             </div>
                          </div>
                        ))}
                      </div>
                   )}

                   <div className="bg-gray-50 rounded-3xl p-6 border border-dashed border-gray-200 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                         <Field label="Type">
                            <select value={newAnn.type} onChange={e => setNewAnn(p => ({ ...p, type: e.target.value, bg_color: ANNOUNCEMENT_TYPES.find(t => t.value === e.target.value)?.bg ?? p.bg_color }))} className="w-full h-11 rounded-xl border-gray-200 text-sm font-bold appearance-none bg-white px-3">
                               {ANNOUNCEMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                         </Field>
                         <Field label="Background">
                            <ColorPicker value={newAnn.bg_color} onChange={v => setNewAnn(p => ({ ...p, bg_color: v }))} />
                         </Field>
                      </div>
                      <Field label="Message *">
                         <Input value={newAnn.message} onChange={e => setNewAnn(p => ({ ...p, message: e.target.value }))} className="rounded-xl h-11" placeholder="Free delivery on your first order!" />
                      </Field>
                      <div className="grid grid-cols-2 gap-4">
                         <Field label="Link URL"><Input value={newAnn.link_url} onChange={e => setNewAnn(p => ({ ...p, link_url: e.target.value }))} className="rounded-xl h-11" placeholder="https://..." /></Field>
                         <Field label="Link Text"><Input value={newAnn.link_text} onChange={e => setNewAnn(p => ({ ...p, link_text: e.target.value }))} className="rounded-xl h-11" placeholder="Shop Now" /></Field>
                      </div>
                      <Button onClick={addAnnouncement} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 px-6 font-bold shadow-lg shadow-blue-200">Add Live Announcement</Button>
                   </div>
                </Section>
             </div>
          )}

          {/* POLICIES TAB */}
          {tab === 'policies' && (
             <div className="space-y-6">
                {[
                  { key:'returnPolicy',   label:'Return & Refund Policy' },
                  { key:'shippingPolicy', label:'Shipping & Delivery Policy' },
                  { key:'privacyPolicy',  label:'Privacy Policy' },
                ].map(p => (
                  <Section key={p.key} title={p.label}>
                    <textarea
                      value={(config as any)[p.key] || ''}
                      onChange={e => setCfg(p.key as any, e.target.value)}
                      rows={6}
                      className="w-full border border-gray-200 rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-gray-900 focus:outline-none bg-gray-50 focus:bg-white transition-all"
                      placeholder={`Draft your ${p.label.toLowerCase()} here...`}
                    />
                  </Section>
                ))}
             </div>
          )}

        </div>
      </div>
      
      {/* Footer padding for mobile */}
      <div className="h-24 lg:hidden" />
    </div>
  )
}
