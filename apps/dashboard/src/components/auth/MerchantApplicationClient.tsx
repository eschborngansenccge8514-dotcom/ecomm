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
    <div className="flex items-center gap-2 mb-8 text-white">
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
  postcode:          string
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
    postcode:           '',
    businessRegNumber:  '',
    bankName:           '',
    bankAccountNumber:  '',
    bankAccountName:    profile.full_name ?? '',
    expectedOrders:     '',
    howHeard:           '',
    agreeTerms:         false,
  })

  const set = (k: keyof FormData, v: any) => setForm(p => ({ ...p, [k]: v }))

  const canProceed = (): boolean => {
    if (step === 0) return !!form.storeName.trim() && !!form.storeType
    if (step === 1) return !!form.fullName.trim() && !!form.phone.trim() && !!form.state && !!form.postcode.trim()
    if (step === 2) return !!form.bankName && !!form.bankAccountNumber.trim() && !!form.bankAccountName.trim()
    if (step === 3) return !!form.expectedOrders && !!form.howHeard && form.agreeTerms
    return true
  }

  const next = () => {
    if (!canProceed()) { toast.error('Please fill in all required fields'); return }
    if (step < STEPS - 1) setStep(s => s + 1)
  }

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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 w-full">
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
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Postcode" required>
                    <Input value={form.postcode} 
                      onChange={e => set('postcode', e.target.value.replace(/\D/g,''))}
                      placeholder="e.g. 50603" maxLength={5} />
                  </Field>
                  <Field label="SSM / Business Registration No." hint="Optional — for business accounts">
                    <Input value={form.businessRegNumber} onChange={e => set('businessRegNumber', e.target.value)}
                      placeholder="e.g. 202301234567" className="font-mono" />
                  </Field>
                </div>
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
