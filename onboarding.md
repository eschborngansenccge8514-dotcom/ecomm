<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Add merchant sign up and full onboarding

Here is the full merchant sign-up and onboarding system — application form, status pages, post-approval wizard, and a persistent dashboard checklist.[^1][^2][^3]

***

## Step 1 — Database Migration

```sql
-- ── Merchant application table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS merchant_applications (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name             text NOT NULL,
  store_type             text NOT NULL DEFAULT 'general',
  tagline                text,
  description            text,
  phone                  text,
  whatsapp               text,
  city                   text,
  state                  text,
  business_reg_number    text,              -- SSM number (optional)
  bank_name              text,
  bank_account_number    text,
  bank_account_name      text,
  expected_orders        text,             -- '<50'|'50-200'|'200-500'|'>500'
  how_heard              text,             -- 'instagram'|'google'|'friend'|'other'
  agree_terms            boolean DEFAULT false,
  status                 text NOT NULL DEFAULT 'pending', -- pending|approved|rejected
  rejection_reason       text,
  reviewed_by            uuid REFERENCES auth.users(id),
  reviewed_at            timestamptz,
  created_at             timestamptz DEFAULT now()
);
ALTER TABLE merchant_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own application"
  ON merchant_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "user creates own application"
  ON merchant_applications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin manages applications"
  ON merchant_applications FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'platform_admin');

-- ── Onboarding progress on merchants ─────────────────────────────────────
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS onboarding_step      int     DEFAULT 0,  -- 0-5
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS bank_name            text,
  ADD COLUMN IF NOT EXISTS bank_account_number  text,
  ADD COLUMN IF NOT EXISTS bank_account_name    text;

-- ── RPC: get_onboarding_checklist ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_onboarding_checklist(p_merchant_id uuid)
RETURNS TABLE (
  has_logo          boolean,
  has_banner        boolean,
  has_phone         boolean,
  has_hours         boolean,
  has_delivery_zone boolean,
  has_product       boolean,
  is_published      boolean,
  product_count     bigint,
  completion_pct    int
)
LANGUAGE sql STABLE AS $$
  WITH m AS (SELECT * FROM merchants WHERE id = p_merchant_id),
  checks AS (
    SELECT
      (m.appearance->>'logoUrl') IS NOT NULL AND (m.appearance->>'logoUrl') != ''  AS has_logo,
      (m.appearance->>'bannerUrl') IS NOT NULL AND (m.appearance->>'bannerUrl') != '' AS has_banner,
      (m.store_config->>'phone') IS NOT NULL AND (m.store_config->>'phone') != ''  AS has_phone,
      EXISTS(SELECT 1 FROM merchant_operating_hours h WHERE h.merchant_id = m.id)  AS has_hours,
      EXISTS(SELECT 1 FROM delivery_zones z WHERE z.merchant_id = m.id AND z.is_active) AS has_zone,
      EXISTS(SELECT 1 FROM products p WHERE p.merchant_id = m.id AND p.is_active)  AS has_product,
      m.is_published
    FROM m
  )
  SELECT
    has_logo, has_banner, has_phone, has_hours, has_zone, has_product, is_published,
    (SELECT COUNT(*) FROM products p WHERE p.merchant_id = p_merchant_id AND p.is_active),
    (
      (CASE WHEN has_logo    THEN 14 ELSE 0 END) +
      (CASE WHEN has_banner  THEN 14 ELSE 0 END) +
      (CASE WHEN has_phone   THEN 14 ELSE 0 END) +
      (CASE WHEN has_hours   THEN 14 ELSE 0 END) +
      (CASE WHEN has_zone    THEN 14 ELSE 0 END) +
      (CASE WHEN has_product THEN 15 ELSE 0 END) +
      (CASE WHEN is_published THEN 15 ELSE 0 END)
    )
  FROM checks;
$$;
```


***

## Step 2 — `src/app/(auth)/apply/page.tsx`

```typescript
import { createClient }  from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import { MerchantApplicationClient } from '@/components/auth/MerchantApplicationClient'

export default async function ApplyPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/apply')

  // Already a merchant?
  const { data: merchant } = await supabase.from('merchants').select('id, status, onboarding_completed').eq('user_id', user.id).single()
  if (merchant) {
    if (merchant.status === 'pending') redirect('/apply/pending')
    if (merchant.status === 'active' && !merchant.onboarding_completed) redirect('/onboarding')
    if (merchant.status === 'active') redirect('/')
  }

  // Already submitted application?
  const { data: existing } = await supabase.from('merchant_applications').select('id, status').eq('user_id', user.id).single()
  if (existing) {
    if (existing.status === 'pending')  redirect('/apply/pending')
    if (existing.status === 'rejected') redirect('/apply/rejected')
  }

  const { data: profile } = await supabase.from('profiles').select('full_name, email, phone').eq('id', user.id).single()

  return <MerchantApplicationClient userId={user.id} profile={profile ?? {}} />
}
```


***

## Step 3 — `src/components/auth/MerchantApplicationClient.tsx`

```typescript
'use client'
import { useState } from 'react'
import { useRouter }  from 'next/navigation'
import { Input }      from '@/components/ui/input'
import { Button }     from '@/components/ui/button'
import { cn }         from '@/lib/utils'
import toast          from 'react-hot-toast'
import { STORE_TYPES, type StoreType } from '@/lib/store-types'
import { CheckCircle2, ChevronRight, ChevronLeft, Loader2, Store, Shield, Zap } from 'lucide-react'

const MY_STATES = ['Johor','Kedah','Kelantan','Melaka','Negeri Sembilan','Pahang','Perak','Perlis',
  'Pulau Pinang','Sabah','Sarawak','Selangor','Terengganu','Kuala Lumpur','Putrajaya','Labuan']

const BANKS = ['Maybank','CIMB Bank','Public Bank','RHB Bank','AmBank','Hong Leong Bank',
  'Alliance Bank','Bank Islam','Bank Rakyat','BSN','Affin Bank','OCBC Bank','Standard Chartered','HSBC','UOB']

const ORDER_RANGES = [
  { value:'<50',     label:'Less than 50 orders/month',   icon:'🌱' },
  { value:'50-200',  label:'50–200 orders/month',         icon:'🚀' },
  { value:'200-500', label:'200–500 orders/month',        icon:'💫' },
  { value:'>500',    label:'500+ orders/month',           icon:'🏆' },
]

const HOW_HEARD = [
  { value:'instagram', label:'Instagram'     },
  { value:'facebook',  label:'Facebook'      },
  { value:'tiktok',    label:'TikTok'        },
  { value:'google',    label:'Google Search' },
  { value:'friend',    label:'Friend / Word of Mouth' },
  { value:'other',     label:'Other'         },
]

// ─── Step components ──────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={cn('h-1.5 rounded-full flex-1 transition-all duration-500',
          i < step ? 'bg-blue-600' : i === step ? 'bg-blue-300' : 'bg-gray-100')} />
      ))}
    </div>
  )
}

function StepLabel({ step, total }: { step: number; total: number }) {
  return <p className="text-xs text-gray-400 mb-2">Step {step + 1} of {total}</p>
}

function FieldGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('space-y-4', className)}>{children}</div>
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-semibold text-gray-700 block mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface FormData {
  storeType:         StoreType
  storeName:         string
  tagline:           string
  description:       string
  fullName:          string
  phone:             string
  whatsapp:          string
  city:              string
  state:             string
  businessRegNumber: string
  bankName:          string
  bankAccountNumber: string
  bankAccountName:   string
  expectedOrders:    string
  howHeard:          string
  agreeTerms:        boolean
}

export function MerchantApplicationClient({ userId, profile }: {
  userId: string; profile: { full_name?: string; email?: string; phone?: string }
}) {
  const router  = useRouter()
  const STEPS   = 4
  const [step,    setStep]    = useState(0)
  const [saving,  setSaving]  = useState(false)
  const [form,    setForm]    = useState<FormData>({
    storeType:          'general',
    storeName:          '',
    tagline:            '',
    description:        '',
    fullName:           profile.full_name ?? '',
    phone:              profile.phone ?? '',
    whatsapp:           '',
    city:               '',
    state:              '',
    businessRegNumber:  '',
    bankName:           '',
    bankAccountNumber:  '',
    bankAccountName:    profile.full_name ?? '',
    expectedOrders:     '',
    howHeard:           '',
    agreeTerms:         false,
  })

  const set = (k: keyof FormData, v: any) => setForm(p => ({ ...p, [k]: v }))

  // ── Validation per step ───────────────────────────────────────────────────
  const canProceed = (): boolean => {
    if (step === 0) return !!form.storeName.trim() && !!form.storeType
    if (step === 1) return !!form.fullName.trim() && !!form.phone.trim() && !!form.state
    if (step === 2) return !!form.bankName && !!form.bankAccountNumber.trim() && !!form.bankAccountName.trim()
    if (step === 3) return !!form.expectedOrders && !!form.howHeard && form.agreeTerms
    return true
  }

  const next = () => {
    if (!canProceed()) { toast.error('Please fill in all required fields'); return }
    if (step < STEPS - 1) setStep(s => s + 1)
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const submit = async () => {
    if (!canProceed()) { toast.error('Please fill in all required fields'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/merchant/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...form }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      router.push('/apply/pending')
    } catch (e: any) {
      toast.error(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <Store size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Start Selling Today</h1>
          <p className="text-gray-500 mt-1 text-sm">Join thousands of merchants growing their business</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
          <ProgressBar step={step} total={STEPS} />
          <StepLabel step={step} total={STEPS} />

          {/* ── Step 0: Store identity ─────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Tell us about your store</h2>
                <p className="text-sm text-gray-400 mt-1">What kind of products or services will you sell?</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {(Object.entries(STORE_TYPES) as [StoreType, typeof STORE_TYPES[StoreType]][]).map(([key, meta]) => (
                  <button key={key} type="button" onClick={() => set('storeType', key)}
                    className={cn('flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all',
                      form.storeType === key
                        ? 'border-blue-600 bg-blue-50 shadow-sm'
                        : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50')}>
                    <span className="text-2xl">{meta.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-800 leading-tight">{meta.label}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{meta.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              <FieldGroup>
                <Field label="Store Name" required hint="This is what customers will see">
                  <Input value={form.storeName} onChange={e => set('storeName', e.target.value)}
                    placeholder="e.g. Mama's Kitchen" className="text-base" autoFocus />
                </Field>
                <Field label="Tagline" hint="One sentence that describes your store">
                  <Input value={form.tagline} onChange={e => set('tagline', e.target.value)}
                    placeholder="e.g. Fresh homemade food, delivered daily" />
                </Field>
                <Field label="What do you sell?" hint="Brief description for our review team">
                  <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
                    placeholder="Tell us more about your products or services..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </Field>
              </FieldGroup>
            </div>
          )}

          {/* ── Step 1: Personal & location details ────────────────── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Your details</h2>
                <p className="text-sm text-gray-400 mt-1">We need this to verify your identity and process payouts.</p>
              </div>
              <FieldGroup>
                <Field label="Full Name" required>
                  <Input value={form.fullName} onChange={e => set('fullName', e.target.value)}
                    placeholder="As per IC / Passport" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone Number" required>
                    <Input value={form.phone} onChange={e => set('phone', e.target.value)}
                      placeholder="+60 1X-XXXXXXXX" type="tel" />
                  </Field>
                  <Field label="WhatsApp" hint="For order notifications">
                    <Input value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)}
                      placeholder="+60 1X-XXXXXXXX" type="tel" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="State" required>
                    <select value={form.state} onChange={e => set('state', e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                      <option value="">Select state</option>
                      {MY_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="City">
                    <Input value={form.city} onChange={e => set('city', e.target.value)}
                      placeholder="e.g. Petaling Jaya" />
                  </Field>
                </div>
                <Field label="SSM / Business Registration No." hint="Optional — required for business accounts">
                  <Input value={form.businessRegNumber} onChange={e => set('businessRegNumber', e.target.value)}
                    placeholder="e.g. 202301234567" className="font-mono" />
                </Field>
              </FieldGroup>
            </div>
          )}

          {/* ── Step 2: Bank details ────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Payout details</h2>
                <p className="text-sm text-gray-400 mt-1">Your earnings will be transferred here on a regular schedule.</p>
              </div>
              <div className="flex items-start gap-3 bg-blue-50 rounded-2xl p-4">
                <Shield size={18} className="text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 leading-relaxed">
                  Your bank details are encrypted and stored securely. They are only used for processing merchant payouts and are never shared with third parties.
                </p>
              </div>
              <FieldGroup>
                <Field label="Bank Name" required>
                  <select value={form.bankName} onChange={e => set('bankName', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    <option value="">Select bank</option>
                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </Field>
                <Field label="Account Number" required>
                  <Input value={form.bankAccountNumber}
                    onChange={e => set('bankAccountNumber', e.target.value.replace(/\D/g,''))}
                    placeholder="e.g. 1234567890" className="font-mono tracking-widest" />
                </Field>
                <Field label="Account Holder Name" required hint="Must match exactly as shown on your bank account">
                  <Input value={form.bankAccountName} onChange={e => set('bankAccountName', e.target.value)}
                    placeholder="Full name as per bank records" />
                </Field>
              </FieldGroup>
            </div>
          )}

          {/* ── Step 3: Business info + terms ──────────────────────── */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Almost there!</h2>
                <p className="text-sm text-gray-400 mt-1">Help us understand your business better.</p>
              </div>

              <FieldGroup>
                <Field label="Expected monthly orders" required>
                  <div className="grid grid-cols-2 gap-2">
                    {ORDER_RANGES.map(r => (
                      <button key={r.value} type="button" onClick={() => set('expectedOrders', r.value)}
                        className={cn('flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all',
                          form.expectedOrders === r.value
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-100 hover:border-gray-300')}>
                        <span className="text-xl">{r.icon}</span>
                        <span className="text-xs font-semibold text-gray-700 leading-tight">{r.label}</span>
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="How did you hear about us?" required>
                  <div className="flex flex-wrap gap-2">
                    {HOW_HEARD.map(h => (
                      <button key={h.value} type="button" onClick={() => set('howHeard', h.value)}
                        className={cn('px-3.5 py-1.5 rounded-xl border-2 text-sm font-medium transition-all',
                          form.howHeard === h.value
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-gray-100 text-gray-600 hover:border-gray-300')}>
                        {h.label}
                      </button>
                    ))}
                  </div>
                </Field>
              </FieldGroup>

              {/* Terms */}
              <div className="border border-gray-100 rounded-2xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-gray-800">Terms & Conditions</h3>
                <div className="h-28 overflow-y-auto text-xs text-gray-500 leading-relaxed pr-2">
                  <p className="mb-2">By applying to become a merchant on this platform, you agree to the following:</p>
                  <p className="mb-2"><strong>1. Commission:</strong> Platform earns a commission on each sale as specified in your merchant agreement. Default rate is 10% per transaction.</p>
                  <p className="mb-2"><strong>2. Product Quality:</strong> You are responsible for the quality and accuracy of all product listings. Misleading descriptions or counterfeit goods will result in immediate suspension.</p>
                  <p className="mb-2"><strong>3. Fulfilment:</strong> You commit to fulfilling orders within the timeframe specified on your storefront. Repeated late fulfilments may result in account suspension.</p>
                  <p className="mb-2"><strong>4. Payouts:</strong> Payouts are processed monthly, after deducting platform commission. Minimum payout threshold is RM 50.</p>
                  <p className="mb-2"><strong>5. Privacy:</strong> Customer data accessed through this platform may only be used to fulfil orders and must be handled in accordance with Malaysian PDPA.</p>
                  <p><strong>6. Platform Rights:</strong> The platform reserves the right to suspend or terminate merchant accounts for violations of these terms with or without prior notice.</p>
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <div className="mt-0.5">
                    <input type="checkbox" checked={form.agreeTerms}
                      onChange={e => set('agreeTerms', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  </div>
                  <span className="text-sm text-gray-700">
                    I have read and agree to the <span className="text-blue-600 underline">Terms & Conditions</span> and <span className="text-blue-600 underline">Merchant Agreement</span>
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-50">
            {step > 0 ? (
              <button type="button" onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors">
                <ChevronLeft size={16} /> Back
              </button>
            ) : <div />}

            {step < STEPS - 1 ? (
              <Button onClick={next} disabled={!canProceed()}
                className="flex items-center gap-1.5 rounded-xl px-6">
                Continue <ChevronRight size={15} />
              </Button>
            ) : (
              <Button onClick={submit} disabled={!canProceed() || saving}
                className="flex items-center gap-2 rounded-xl px-8 bg-blue-600 hover:bg-blue-700">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                Submit Application
              </Button>
            )}
          </div>
        </div>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-6 mt-6 text-xs text-gray-400">
          <span className="flex items-center gap-1.5"><Shield size={12} /> Secure & encrypted</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 size={12} /> Review within 24 hours</span>
          <span className="flex items-center gap-1.5"><Zap size={12} /> Start selling immediately</span>
        </div>
      </div>
    </div>
  )
}
```


***

## Step 4 — `src/app/(auth)/apply/pending/page.tsx`

```typescript
import Link           from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect }   from 'next/navigation'
import { Clock, CheckCircle2, Mail, MessageCircle } from 'lucide-react'

export default async function ApplicationPendingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase.from('merchants').select('status').eq('user_id', user.id).single()
  if (merchant?.status === 'active') redirect('/')

  const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('id', user.id).single()

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg text-center">

        {/* Animation */}
        <div className="relative inline-flex items-center justify-center mb-8">
          <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center animate-pulse">
            <Clock size={42} className="text-amber-500" />
          </div>
          <div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-amber-200 animate-ping opacity-20" />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-3">Application Under Review</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Thanks for applying, <strong>{profile?.full_name?.split(' ')[^0] ?? 'there'}</strong>! Our team is reviewing your application. You'll receive an email at <strong>{profile?.email}</strong> within 24 hours.
        </p>

        {/* Timeline */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm mb-8 text-left">
          <h3 className="font-bold text-gray-900 mb-4 text-sm">What happens next?</h3>
          <div className="space-y-4">
            {[
              { icon:'✅', title:'Application submitted',    desc:'Your details have been received',          done:true  },
              { icon:'🔍', title:'Under review',             desc:'Our team is verifying your information',   done:false, active:true },
              { icon:'📧', title:'Decision via email',       desc:'You\'ll be notified within 24 hours',      done:false },
              { icon:'🚀', title:'Set up your store',        desc:'Complete onboarding and start selling',    done:false },
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0',
                  s.done ? 'bg-green-100' : s.active ? 'bg-amber-100 animate-pulse' : 'bg-gray-100')}>
                  {s.icon}
                </div>
                <div>
                  <p className={cn('text-sm font-semibold', s.done || s.active ? 'text-gray-900' : 'text-gray-400')}>{s.title}</p>
                  <p className="text-xs text-gray-400">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="flex gap-3">
          <a href="mailto:support@platform.com"
            className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-2xl py-3 text-sm font-semibold text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors">
            <Mail size={15} /> Email Support
          </a>
          <a href="https://wa.me/601234567890" target="_blank"
            className="flex-1 flex items-center justify-center gap-2 bg-green-50 border border-green-200 rounded-2xl py-3 text-sm font-semibold text-green-700 hover:bg-green-100 transition-colors">
            <MessageCircle size={15} /> WhatsApp Us
          </a>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          Changed your mind? <Link href="/apply" className="text-blue-500 hover:underline">Edit application</Link>
        </p>
      </div>
    </div>
  )
}

function cn(...cls: (string | boolean | undefined)[]): string {
  return cls.filter(Boolean).join(' ')
}
```


***

## Step 5 — `src/app/api/merchant/apply/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId, storeName, storeType, tagline, description, fullName, phone, whatsapp,
    city, state, businessRegNumber, bankName, bankAccountNumber, bankAccountName,
    expectedOrders, howHeard, agreeTerms } = body

  if (!userId || !storeName || !storeType || !agreeTerms)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

  // Update profile
  await supabaseAdmin.from('profiles').update({ full_name: fullName, phone }).eq('id', userId)

  // Save application
  const { error: appErr } = await supabaseAdmin.from('merchant_applications').upsert({
    user_id: userId, store_name: storeName, store_type: storeType, tagline, description,
    phone, whatsapp, city, state, business_reg_number: businessRegNumber,
    bank_name: bankName, bank_account_number: bankAccountNumber, bank_account_name: bankAccountName,
    expected_orders: expectedOrders, how_heard: howHeard, agree_terms: agreeTerms,
    status: 'pending',
  }, { onConflict: 'user_id' })
  if (appErr) return NextResponse.json({ error: appErr.message }, { status: 400 })

  // Create merchant record (status = pending)
  const slug = storeName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
  const { error: merchantErr } = await supabaseAdmin.from('merchants').upsert({
    user_id:         userId,
    store_name:      storeName,
    store_type:      storeType,
    store_slug:      slug,
    status:          'pending',
    is_published:    false,
    appearance:      { tagline },
    store_config:    { phone, whatsapp, city, state },
    bank_name:       bankName,
    bank_account_number: bankAccountNumber,
    bank_account_name:   bankAccountName,
    onboarding_step: 0,
    onboarding_completed: false,
  }, { onConflict: 'user_id' })
  if (merchantErr) return NextResponse.json({ error: merchantErr.message }, { status: 400 })

  // Notify admins (you'd add an email here via Resend/SendGrid)
  // await sendAdminNotification({ storeName, storeType, ownerEmail: ... })

  return NextResponse.json({ ok: true })
}
```


***

## Step 6 — `src/app/(dashboard)/onboarding/page.tsx`

```typescript
import { getMerchant }   from '@/lib/utils.server'
import { redirect }      from 'next/navigation'
import { OnboardingWizard } from '@/components/dashboard/OnboardingWizard'

export default async function OnboardingPage() {
  const { supabase, merchant } = await getMerchant()
  if (merchant.status !== 'active') redirect('/apply/pending')
  if (merchant.onboarding_completed) redirect('/')

  const [{ data: hours }, { data: zones }, { data: checklist }] = await Promise.all([
    supabase.from('merchant_operating_hours').select('*').eq('merchant_id', merchant.id).order('day_of_week'),
    supabase.from('delivery_zones').select('*').eq('merchant_id', merchant.id).order('sort_order'),
    supabase.rpc('get_onboarding_checklist', { p_merchant_id: merchant.id }),
  ])

  return (
    <OnboardingWizard
      merchant={merchant}
      hours={(hours    as any[]) ?? []}
      zones={(zones    as any[]) ?? []}
      checklist={(checklist as any[])?.[^0] ?? {}}
    />
  )
}
```


***

## Step 7 — `src/components/dashboard/OnboardingWizard.tsx`

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input }    from '@/components/ui/input'
import { Button }   from '@/components/ui/button'
import { cn }       from '@/lib/utils'
import toast        from 'react-hot-toast'
import Link         from 'next/link'
import { MultiImageUpload } from './MultiImageUpload'
import { STORE_TYPES }      from '@/lib/store-types'
import {
  Palette, Clock, Truck, Package, Rocket,
  ChevronRight, ChevronLeft, Check, Loader2, ExternalLink, Skip
} from 'lucide-react'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const BANKS = ['Maybank','CIMB Bank','Public Bank','RHB Bank','AmBank','Hong Leong Bank',
  'Alliance Bank','Bank Islam','Bank Rakyat','BSN','Affin Bank','OCBC Bank','Standard Chartered','HSBC','UOB']
const MY_STATES = ['Johor','Kedah','Kelantan','Melaka','Negeri Sembilan','Pahang','Perak','Perlis',
  'Pulau Pinang','Sabah','Sarawak','Selangor','Terengganu','Kuala Lumpur','Putrajaya','Labuan']
const PALETTE = ['#2563eb','#7c3aed','#059669','#dc2626','#d97706','#0891b2','#be185d','#111827','#65a30d','#ea580c']

const WIZARD_STEPS = [
  { id:'brand',    icon: <Palette size={18} />,  title:'Brand & Identity',     desc:'Logo, colours, and your store personality' },
  { id:'contact',  icon: <Clock size={18} />,    title:'Contact & Hours',       desc:'How customers reach you and when you\'re open' },
  { id:'delivery', icon: <Truck size={18} />,    title:'Delivery Setup',        desc:'Set your first delivery zone and fee' },
  { id:'product',  icon: <Package size={18} />,  title:'First Product',         desc:'Add one product to get started' },
  { id:'launch',   icon: <Rocket size={18} />,   title:'Launch Your Store!',    desc:'Review and go live' },
]

function WizardHeader({ step, storeName, storeType }: { step: number; storeName: string; storeType: string }) {
  const meta = STORE_TYPES[storeType as keyof typeof STORE_TYPES]
  return (
    <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shrink-0">
          {storeName.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-bold text-gray-900 text-sm leading-none">{storeName}</p>
          <p className="text-xs text-gray-400">{meta?.icon} Setting up your store</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {WIZARD_STEPS.map((s, i) => (
          <div key={s.id} className={cn('flex items-center gap-1',
            i < WIZARD_STEPS.length - 1 && 'after:content-[""] after:w-8 after:h-0.5 after:ml-1.5',
            i < step ? 'after:bg-blue-300' : 'after:bg-gray-100')}>
            <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
              i < step  ? 'bg-blue-600 text-white' :
              i === step ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
              'bg-gray-100 text-gray-400')}>
              {i < step ? <Check size={12} /> : i + 1}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function OnboardingWizard({ merchant, hours: initHours, zones: initZones, checklist }: {
  merchant: any; hours: any[]; zones: any[]; checklist: any
}) {
  const router   = useRouter()
  const supabase = createClient()
  const [step,    setStep]    = useState(merchant.onboarding_step ?? 0)
  const [saving,  setSaving]  = useState(false)
  const stMeta = STORE_TYPES[merchant.store_type as keyof typeof STORE_TYPES]

  // ── Brand state ────────────────────────────────────────────────────────
  const [images,       setImages]       = useState<any[]>(merchant.appearance?.logoUrl ? [{ url: merchant.appearance.logoUrl, is_primary: true, sort_order: 0 }] : [])
  const [bannerImages, setBannerImages] = useState<any[]>(merchant.appearance?.bannerUrl ? [{ url: merchant.appearance.bannerUrl, is_primary: true, sort_order: 0 }] : [])
  const [primaryColor, setPrimaryColor] = useState(merchant.appearance?.primaryColor ?? stMeta?.color ?? '#2563eb')
  const [tagline,      setTagline]      = useState(merchant.appearance?.tagline ?? '')

  // ── Contact state ──────────────────────────────────────────────────────
  const [phone,    setPhone]    = useState(merchant.store_config?.phone ?? '')
  const [whatsapp, setWhatsapp] = useState(merchant.store_config?.whatsapp ?? '')
  const [instagram, setInstagram] = useState(merchant.store_config?.instagram ?? '')
  const [hours,    setHours]    = useState(
    DAYS.map((_, d) => initHours.find((h: any) => h.day_of_week === d) ??
      { day_of_week: d, open_time: '09:00', close_time: '22:00', is_closed: d === 0 })
  )

  // ── Delivery state ─────────────────────────────────────────────────────
  const [zoneName,     setZoneName]     = useState('')
  const [zoneStates,   setZoneStates]   = useState<string[]>(['Kuala Lumpur','Selangor'])
  const [deliveryFee,  setDeliveryFee]  = useState('5')
  const [freeAbove,    setFreeAbove]    = useState('50')
  const [estDays,      setEstDays]      = useState('Same day')
  const [zonesSaved,   setZonesSaved]   = useState(initZones.length > 0)

  // ── Product state ──────────────────────────────────────────────────────
  const [prodName,   setProdName]   = useState('')
  const [prodPrice,  setProdPrice]  = useState('')
  const [prodDesc,   setProdDesc]   = useState('')
  const [prodStock,  setProdStock]  = useState('0')
  const [prodImages, setProdImages] = useState<any[]>([])
  const [prodSkipped, setProdSkipped] = useState(false)

  // ── Save helpers ───────────────────────────────────────────────────────
  const saveBrand = async () => {
    const logoUrl   = images[^0]?.url ?? ''
    const bannerUrl = bannerImages[^0]?.url ?? ''
    const { error } = await supabase.from('merchants').update({
      appearance: { ...merchant.appearance, logoUrl, bannerUrl, primaryColor, tagline },
      onboarding_step: 1,
    }).eq('id', merchant.id)
    if (error) throw error
    if (logoUrl) await supabase.from('products').update({ /* no-op placeholder */ }).eq('merchant_id', merchant.id).limit(0)
  }

  const saveContact = async () => {
    await supabase.from('merchants').update({
      store_config: { ...merchant.store_config, phone, whatsapp, instagram },
      onboarding_step: 2,
    }).eq('id', merchant.id)
    await supabase.from('merchant_operating_hours').upsert(
      hours.map(h => ({ ...h, merchant_id: merchant.id })),
      { onConflict: 'merchant_id,day_of_week' }
    )
  }

  const saveDelivery = async () => {
    if (!zoneName.trim()) { toast.error('Enter a zone name'); return false }
    const { error } = await supabase.from('delivery_zones').insert({
      merchant_id:         merchant.id,
      zone_name:           zoneName,
      states:              zoneStates,
      delivery_fee:        Number(deliveryFee) || 0,
      free_delivery_above: freeAbove ? Number(freeAbove) : null,
      estimated_days:      estDays,
      is_active:           true,
    })
    if (error) { toast.error(error.message); return false }
    await supabase.from('merchants').update({ onboarding_step: 3 }).eq('id', merchant.id)
    setZonesSaved(true)
    return true
  }

  const saveProduct = async () => {
    if (!prodSkipped && prodName.trim()) {
      const { data: prod } = await supabase.from('products').insert({
        merchant_id: merchant.id, name: prodName, description: prodDesc,
        price: Number(prodPrice) || 0, stock_quantity: Number(prodStock) || 0,
        status: 'active', is_active: true,
        image_url: prodImages[^0]?.url ?? null,
      }).select('id').single()
      if (prod && prodImages.length) {
        await supabase.from('product_images').insert(
          prodImages.map((img, i) => ({
            product_id: prod.id, merchant_id: merchant.id,
            url: img.url, sort_order: i, is_primary: i === 0,
          }))
        )
      }
    }
    await supabase.from('merchants').update({ onboarding_step: 4 }).eq('id', merchant.id)
  }

  const goLive = async () => {
    await supabase.from('merchants').update({
      is_published: true,
      onboarding_step: 5,
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
    }).eq('id', merchant.id)
  }

  const handleNext = async () => {
    setSaving(true)
    try {
      if (step === 0) await saveBrand()
      if (step === 1) await saveContact()
      if (step === 2) { const ok = await saveDelivery(); if (!ok) { setSaving(false); return } }
      if (step === 3) await saveProduct()
      if (step === 4) { await goLive(); toast.success('🎉 Your store is live!'); router.push('/'); return }
      setStep(s => s + 1)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col overflow-hidden z-40">
      <WizardHeader step={step} storeName={merchant.store_name} storeType={merchant.store_type} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-8">

          {/* Step header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
              {WIZARD_STEPS[step].icon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{WIZARD_STEPS[step].title}</h2>
              <p className="text-sm text-gray-400">{WIZARD_STEPS[step].desc}</p>
            </div>
          </div>

          {/* ── STEP 0: Brand ─────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-800 mb-3 text-sm">Store Logo</h3>
                <MultiImageUpload merchantId={merchant.id} initialImages={images} onChange={setImages} />
                <p className="text-xs text-gray-400 mt-2">Square image, min 300×300px recommended</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-800 mb-3 text-sm">Banner Image</h3>
                <MultiImageUpload merchantId={merchant.id} initialImages={bannerImages} onChange={setBannerImages} />
                <p className="text-xs text-gray-400 mt-2">1600×500px recommended (16:5 ratio)</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">Brand Colour</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {PALETTE.map(c => (
                      <button key={c} type="button" onClick={() => setPrimaryColor(c)}
                        className={cn('w-8 h-8 rounded-full border-2 transition-transform hover:scale-110',
                          primaryColor === c ? 'border-gray-800 scale-110' : 'border-transparent')}>
                        <div className="w-full h-full rounded-full" style={{ backgroundColor: c }} />
                      </button>
                    ))}
                    <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                      className="w-8 h-8 rounded-full cursor-pointer" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">Store Tagline</label>
                  <Input value={tagline} onChange={e => setTagline(e.target.value)}
                    placeholder="A short, catchy line about your store" />
                </div>
              </div>
              <div className="flex items-center justify-center gap-3 bg-gray-100 rounded-2xl p-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
                  style={{ backgroundColor: primaryColor }}>
                  {images[^0]?.url ? <img src={images[^0].url} className="w-full h-full object-cover rounded-xl" alt="" /> : merchant.store_name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{merchant.store_name}</p>
                  <p className="text-xs text-gray-500">{tagline || stMeta?.desc}</p>
                </div>
                <span className="ml-auto text-xs text-gray-400">Preview</span>
              </div>
            </div>
          )}

          {/* ── STEP 1: Contact & Hours ───────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                <h3 className="font-semibold text-gray-800 text-sm">Contact Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1.5">Phone *</label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+60 1X-XXXXXXXX" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1.5">WhatsApp</label>
                    <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+60 1X-XXXXXXXX" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">Instagram</label>
                  <Input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@yourstore" />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-800 text-sm mb-4">Operating Hours</h3>
                <div className="space-y-2">
                  {DAYS.map((day, d) => {
                    const h = hours[d]
                    return (
                      <div key={d} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                        <span className="text-sm text-gray-700 w-24 shrink-0">{day}</span>
                        <button type="button"
                          onClick={() => setHours(prev => prev.map((x, i) => i === d ? { ...x, is_closed: !x.is_closed } : x))}
                          className={cn('text-xs font-bold px-2.5 py-1 rounded-full shrink-0',
                            h.is_closed ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700')}>
                          {h.is_closed ? 'Closed' : 'Open'}
                        </button>
                        {!h.is_closed && (
                          <>
                            <Input type="time" value={h.open_time ?? '09:00'}
                              onChange={e => setHours(p => p.map((x, i) => i === d ? { ...x, open_time: e.target.value } : x))}
                              className="h-8 text-xs w-24" />
                            <span className="text-gray-400 text-xs">–</span>
                            <Input type="time" value={h.close_time ?? '22:00'}
                              onChange={e => setHours(p => p.map((x, i) => i === d ? { ...x, close_time: e.target.value } : x))}
                              className="h-8 text-xs w-24" />
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Delivery ─────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              {zonesSaved && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-sm text-green-700 font-semibold">
                  <Check size={16} className="text-green-600" /> Delivery zone saved! You can add more later in Settings → Delivery.
                </div>
              )}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                <h3 className="font-semibold text-gray-800 text-sm">Your First Delivery Zone</h3>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">Zone Name *</label>
                  <Input value={zoneName} onChange={e => setZoneName(e.target.value)}
                    placeholder="e.g. Klang Valley, Nationwide" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1.5">Delivery Fee (RM)</label>
                    <Input type="number" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1.5">Free Delivery Above (RM)</label>
                    <Input type="number" value={freeAbove} onChange={e => setFreeAbove(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">Estimated Delivery Time</label>
                  <select value={estDays} onChange={e => setEstDays(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm">
                    {['Same day','Next day','1-2 days','2-3 days','3-5 days','5-7 days'].map(d =>
                      <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">States Covered</label>
                  <div className="flex flex-wrap gap-1.5">
                    {MY_STATES.map(s => (
                      <button key={s} type="button"
                        onClick={() => setZoneStates(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])}
                        className={cn('text-xs font-medium px-2.5 py-1 rounded-full border transition-colors',
                          zoneStates.includes(s)
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400')}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center">You can add more zones and configure self-pickup later in Store Settings → Delivery.</p>
            </div>
          )}

          {/* ── STEP 3: First Product ─────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-5">
              {!prodSkipped ? (
                <>
                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <h3 className="font-semibold text-gray-800 text-sm mb-4">Product Images</h3>
                    <MultiImageUpload merchantId={merchant.id} initialImages={prodImages} onChange={setProdImages} />
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-1.5">Product Name *</label>
                      <Input value={prodName} onChange={e => setProdName(e.target.value)}
                        placeholder={`e.g. ${stMeta?.icon} Classic ${merchant.store_name} Bestseller`} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-1.5">Price (RM) *</label>
                        <Input type="number" value={prodPrice} onChange={e => setProdPrice(e.target.value)} placeholder="0.00" />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-1.5">Stock Quantity</label>
                        <Input type="number" value={prodStock} onChange={e => setProdStock(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-1.5">Description</label>
                      <textarea value={prodDesc} onChange={e => setProdDesc(e.target.value)} rows={3}
                        placeholder="What makes this product special?"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                    </div>
                  </div>
                  <button type="button" onClick={() => setProdSkipped(true)}
                    className="w-full text-center text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors">
                    Skip for now — I'll add products later →
                  </button>
                </>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
                  <p className="text-3xl mb-3">📦</p>
                  <p className="font-bold text-amber-800">You're skipping product setup</p>
                  <p className="text-sm text-amber-700 mt-1">No problem! You can add products anytime from your Products page.</p>
                  <button type="button" onClick={() => setProdSkipped(false)}
                    className="mt-4 text-sm text-amber-700 underline">
                    Actually, let me add one now
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 4: Launch ────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl p-8 text-white text-center">
                <p className="text-5xl mb-4">🎉</p>
                <h2 className="text-2xl font-bold mb-2">You're ready to launch!</h2>
                <p className="text-blue-100 text-sm">Your store is set up and ready to welcome customers.</p>
              </div>

              {/* Checklist summary */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-gray-900 mb-4">Setup Summary</h3>
                <div className="space-y-2">
                  {[
                    { label:'Brand & Logo',        done: !!images[^0]?.url           },
                    { label:'Banner Image',         done: !!bannerImages[^0]?.url     },
                    { label:'Contact Info',         done: !!phone.trim()             },
                    { label:'Operating Hours',      done: true                       },
                    { label:'Delivery Zone',        done: zonesSaved                 },
                    { label:'First Product',        done: !!prodName.trim() || prodSkipped },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-gray-700">{item.label}</span>
                      <span className={cn('text-xs font-bold px-2.5 py-0.5 rounded-full',
                        item.done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400')}>
                        {item.done ? '✓ Done' : 'Skipped'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-5 text-center space-y-2">
                <p className="text-sm text-gray-600">Your store URL will be:</p>
                <div className="flex items-center justify-center gap-2 bg-white rounded-xl border border-gray-200 px-4 py-2.5">
                  <span className="text-blue-600 font-mono text-sm font-bold">
                    yourplatform.com/store/{merchant.store_slug ?? 'your-store'}
                  </span>
                  <ExternalLink size={12} className="text-gray-400" />
                </div>
                <p className="text-xs text-gray-400">You can customise this URL in Store Settings.</p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
            {step > 0 ? (
              <button type="button" onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors">
                <ChevronLeft size={16} /> Back
              </button>
            ) : (
              <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                Save & continue later
              </Link>
            )}
            <Button onClick={handleNext} disabled={saving}
              className={cn('flex items-center gap-2 rounded-xl px-8 transition-all',
                step === 4 ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg shadow-blue-200' : 'bg-blue-600 hover:bg-blue-700')}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {step === 4 ? '🚀 Go Live Now!' : <>Continue <ChevronRight size={15} /></>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
```


***

## Step 8 — `src/components/dashboard/OnboardingChecklist.tsx`

```typescript
'use client'
import Link     from 'next/link'
import { cn }   from '@/lib/utils'
import { ChevronRight, X } from 'lucide-react'
import { useState } from 'react'

interface ChecklistData {
  has_logo: boolean; has_banner: boolean; has_phone: boolean
  has_hours: boolean; has_delivery_zone: boolean; has_product: boolean
  is_published: boolean; product_count: number; completion_pct: number
}

const ITEMS = [
  { key:'has_logo',          label:'Upload your store logo',       href:'/settings/store?tab=appearance', icon:'🖼️' },
  { key:'has_banner',        label:'Add a banner image',            href:'/settings/store?tab=appearance', icon:'🎨' },
  { key:'has_phone',         label:'Add contact info',             href:'/settings/store?tab=business',   icon:'📞' },
  { key:'has_hours',         label:'Set operating hours',          href:'/settings/store?tab=business',   icon:'🕐' },
  { key:'has_delivery_zone', label:'Configure delivery zones',     href:'/settings/store?tab=delivery',   icon:'🚚' },
  { key:'has_product',       label:'Add your first product',       href:'/products/new',                  icon:'📦' },
  { key:'is_published',      label:'Publish your store',           href:'/settings/store',                icon:'🚀' },
] as const

export function OnboardingChecklist({ data, merchantId }: { data: ChecklistData; merchantId: string }) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || data.completion_pct >= 100) return null

  const remaining = ITEMS.filter(item => !data[item.key as keyof ChecklistData]).length

  return (
    <div className="bg-white rounded-2xl border border-blue-100 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-white font-bold text-sm">Complete Your Setup</p>
          <p className="text-blue-200 text-xs mt-0.5">{remaining} step{remaining !== 1 ? 's' : ''} remaining</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Circular progress */}
          <div className="relative w-10 h-10">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#ffffff30" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="white" strokeWidth="3"
                strokeDasharray={`${data.completion_pct} 100`} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
              {data.completion_pct}%
            </span>
          </div>
          <button onClick={() => setDismissed(true)}
            className="text-blue-300 hover:text-white transition-colors">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div className="h-full bg-blue-500 transition-all duration-700"
          style={{ width: `${data.completion_pct}%` }} />
      </div>

      {/* Checklist items */}
      <div className="divide-y divide-gray-50">
        {ITEMS.map(item => {
          const done = !!data[item.key as keyof ChecklistData]
          return (
            <Link key={item.key} href={done ? '#' : item.href}
              className={cn('flex items-center gap-3 px-5 py-3 transition-colors group',
                done ? 'opacity-50 cursor-default' : 'hover:bg-blue-50/50')}>
              <div className={cn('w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                done ? 'bg-green-500 border-green-500' : 'border-gray-200 group-hover:border-blue-400')}>
                {done && <svg viewBox="0 0 12 12" className="w-3 h-3 text-white fill-current"><path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>}
              </div>
              <span className="text-sm text-gray-700 flex-1">{item.icon} {item.label}</span>
              {!done && <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />}
            </Link>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-50">
        <Link href="/onboarding"
          className="text-xs text-blue-600 font-semibold hover:underline">
          Open setup wizard →
        </Link>
      </div>
    </div>
  )
}
```


***

## Step 9 — Middleware Update

```typescript
// Add to your existing src/middleware.ts — inside the existing middleware function

// ── Merchant status gates ─────────────────────────────────────────────────
if (pathname.startsWith('/(dashboard)') || pathname === '/') {
  if (user) {
    const { data: merchant } = await supabase
      .from('merchants')
      .select('status, onboarding_completed')
      .eq('user_id', user.id)
      .single()

    if (merchant) {
      if (merchant.status === 'pending' && !pathname.startsWith('/apply'))
        return NextResponse.redirect(new URL('/apply/pending', request.url))

      if (merchant.status === 'active'
          && !merchant.onboarding_completed
          && !pathname.startsWith('/onboarding')
          && !pathname.startsWith('/api'))
        return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }
}
```


***

## Complete Flow Summary

| Stage | Route | Status |
| :-- | :-- | :-- |
| New user lands on site | `/apply` | Public (auth required) |
| Fills 4-step application | `/apply` | Collects store type, bank, location details [^1] |
| Application submitted | `/apply/pending` | Polling page, 24hr review promise [^4] |
| Admin approves in panel | `/admin/merchants/[id]` | Status → `active` |
| Post-approval wizard | `/onboarding` | Full-screen 5-step setup [^2] |
| Store goes live | `is_published = true` | Redirect to dashboard |
| Dashboard checklist | Widget in sidebar | Persists until 100% complete [^3] |
| Fully onboarded | All checklist items ✓ | Widget dismisses automatically |

<span style="display:none">[^10][^11][^12][^13][^14][^15][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://plaid.com/resources/fintech/merchant-onboarding/

[^2]: https://www.journeyh.io/blog/marketplace-onboarding-marketplace-seller

[^3]: https://jimo.ai/blog/saas-onboarding-checklist

[^4]: https://www.lemonway.com/en/blog/merchant-onboarding-marketplace

[^5]: https://www.cs-cart.com/blog/marketplace-seller-onboarding/

[^6]: https://stripe.com/resources/more/merchant-onboarding-explained

[^7]: https://authbridge.com/blog/merchant-onboarding-process-guide/

[^8]: https://www.candu.ai/blog/best-saas-onboarding-examples-checklist-practices-for-2025

[^9]: https://www.lemonway.com/en/blog/marketplace-onboard-merchants

[^10]: https://flook.co/blog/posts/saas-onboarding-checklist

[^11]: https://idfy.com/blog/mastering-merchant-onboarding-best-practices/

[^12]: https://www.introw.io/blog/partner-onboarding-checklist

[^13]: https://www.trulioo.com/blog/business-verification/best-practices-merchant-onboarding

[^14]: https://lollypop.design/blog/2025/may/saas-onboarding-ux-design/

[^15]: https://corefy.com/blog/merchant-onboarding-explained

