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
  Eye, EyeOff, Loader2, ExternalLink, AlertCircle, RefreshCw, CheckCircle2, XCircle
} from 'lucide-react'
import { invokeWorker } from '@/lib/worker'

const ID_TYPES = [
  { value: 'BRN',      label: 'Business Registration Number (BRN)' },
  { value: 'NRIC',     label: 'National Identity Card (NRIC)' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'ARMY',     label: 'Army/Police ID' },
]

function Section({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm">
      <div>
        <h3 className="font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

export function EInvoiceSettings({ config: initial, merchantId }: {
  config: any; merchantId: string
}) {
  const supabase = createClient()

  const [form, setForm] = useState({
    tin:                  initial?.tin                  ?? '',
    registration_no:      initial?.registration_no      ?? '',
    registration_no_type: initial?.registration_no_type ?? 'BRN',
    msic_code:            initial?.msic_code            ?? '',
    description:          initial?.description          ?? '',
    client_id:            initial?.client_id            ?? '',
    client_secret:         initial?.client_secret        ?? '',
    env:                  initial?.env                  ?? 'sandbox',
    issue_mode:           initial?.issue_mode           ?? 'individual',
  })

  const [showId,     setShowId]     = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [testing,    setTesting]    = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!form.tin || !form.client_id || !form.client_secret) {
      toast.error('TIN, Client ID, and Client Secret are required')
      return
    }
    setSaving(true)

    const { error } = await supabase
      .from('merchant_einvoice_config')
      .upsert({
        merchant_id:          merchantId,
        tin:                  form.tin.trim(),
        registration_no:      form.registration_no.trim(),
        registration_no_type: form.registration_no_type,
        msic_code:            form.msic_code,
        description:          form.description,
        client_id:            form.client_id.trim(),
        client_secret:        form.client_secret.trim(),
        env:                  form.env,
        issue_mode:           form.issue_mode,
        updated_at:           new Date().toISOString(),
      }, { onConflict: 'merchant_id' })

    if (error) toast.error(error.message)
    else toast.success('E-Invoice settings saved! ✅')
    setSaving(false)
  }

  const handleTestConnection = async () => {
     setTesting(true)
     setTestResult(null)
     try {
        // We use a lightweight check by just trying to fetch a token via the einvoice-submit function 
        // with a special "test_connection" flag if supported, otherwise we just try to get a token manually.
        // For now, we'll implement a dedicated test-connection logic or just inform the user.
        const { data, error } = await invokeWorker('einvoice/test-connection', {
            body: { merchantId, ...form }
        })

        if (error) throw error
        setTestResult({ ok: true, message: 'LHDN connection verified!' })
        toast.success('Connection Successful! 🎉')
     } catch (err: any) {
        setTestResult({ ok: false, message: err.message || 'Connection failed' })
        toast.error('LHDN connection failed')
     } finally {
        setTesting(false)
     }
  }

  return (
    <div className="space-y-6">
      {/* ── Environment ────────────────────────────────────────────────── */}
      <Section title="LHDN Environment" subtitle="Switch between Sandbox for testing and Production for real filings.">
        <div className="flex gap-2">
          {(['sandbox', 'production'] as const).map(env => (
            <button key={env}
              onClick={() => set('env', env)}
              className={cn(
                'flex-1 py-3 rounded-xl text-sm font-black border-2 transition-all capitalize',
                form.env === env
                  ? env === 'production'
                    ? 'border-green-600 bg-green-50 text-green-700 shadow-sm'
                    : 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-gray-100 text-gray-400 hover:border-gray-200'
              )}
            >
              {env === 'production' ? 'PROD' : 'TEST'} {env}
            </button>
          ))}
        </div>
      </Section>

      {/* ── Submission Strategy ────────────────────────────────────────── */}
      <Section title="Submission Strategy" subtitle="Choose how your e-invoices are reported to LHDN.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => set('issue_mode', 'individual')}
            className={cn(
              "p-5 rounded-2xl border-2 text-left transition-all",
              form.issue_mode === 'individual' 
                ? "border-blue-600 bg-blue-50/50 ring-4 ring-blue-50" 
                : "border-gray-100 opacity-60 grayscale hover:grayscale-0"
            )}
          >
            <div className="flex justify-between items-start">
               <span className="font-black text-gray-900">Individual Submission</span>
               {form.issue_mode === 'individual' && <CheckCircle2 className="text-blue-600" size={20} />}
            </div>
            <p className="text-xs text-gray-400 font-medium mt-2 leading-relaxed">
              Every sale is submitted to LHDN immediately. Required for B2B transactions.
            </p>
          </button>

          <button
            onClick={() => set('issue_mode', 'consolidated')}
            className={cn(
              "p-5 rounded-2xl border-2 text-left transition-all",
              form.issue_mode === 'consolidated' 
                ? "border-purple-600 bg-purple-50/50 ring-4 ring-purple-50" 
                : "border-gray-100 opacity-60 grayscale hover:grayscale-0"
            )}
          >
             <div className="flex justify-between items-start">
               <span className="font-black text-gray-900">Consolidated Batch</span>
               {form.issue_mode === 'consolidated' && <CheckCircle2 className="text-purple-600" size={20} />}
            </div>
            <p className="text-xs text-gray-400 font-medium mt-2 leading-relaxed">
              Sales are batched and submitted monthly. Recommended for high-volume retail.
            </p>
          </button>
        </div>
        {form.issue_mode === 'consolidated' && (
           <div className="flex items-start gap-3 p-4 bg-orange-50 rounded-2xl border border-orange-100">
             <AlertCircle className="text-orange-500 shrink-0 mt-0.5" size={16} />
             <p className="text-[10px] text-orange-800 font-bold leading-relaxed uppercase tracking-tighter">
               Note: You must still issue an individual e-invoice if a customer requests one within 30 days of purchase.
             </p>
           </div>
        )}
      </Section>

      {/* ── Business Details ───────────────────────────────────────────── */}
      <Section title="Tax & Business Identity" subtitle="Required for accurate document generation.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-black text-gray-500 uppercase tracking-wider">Tax Identification Number (TIN) *</Label>
            <Input value={form.tin} onChange={e => set('tin', e.target.value)} placeholder="e.g. C1234567890" className="mt-1.5 h-11 rounded-xl font-mono" />
          </div>
          <div>
            <Label className="text-xs font-black text-gray-500 uppercase tracking-wider">Registration Type</Label>
            <select value={form.registration_no_type} onChange={e => set('registration_no_type', e.target.value)}
              className="w-full h-11 border border-gray-200 rounded-xl px-3 py-2 text-sm mt-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {ID_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs font-black text-gray-500 uppercase tracking-wider">Registration Number *</Label>
            <Input value={form.registration_no} onChange={e => set('registration_no', e.target.value)} placeholder="e.g. 202301012345" className="mt-1.5 h-11 rounded-xl font-mono" />
          </div>
          <div>
            <Label className="text-xs font-black text-gray-500 uppercase tracking-wider">MSIC Code</Label>
            <Input value={form.msic_code} onChange={e => set('msic_code', e.target.value)} placeholder="e.g. 47910" className="mt-1.5 h-11 rounded-xl font-mono" />
          </div>
        </div>
        <div>
          <Label className="text-xs font-black text-gray-500 uppercase tracking-wider">Business Activity Description</Label>
          <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. Retail sale via internet" className="mt-1.5 h-11 rounded-xl" />
        </div>
      </Section>

      {/* ── API Credentials ───────────────────────────────────────────── */}
      <Section title="API Credentials" subtitle="Obtain these from the LHDN MyInvois portal under Developers.">
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-black text-gray-500 uppercase tracking-wider">Client ID *</Label>
            <div className="relative mt-1.5">
              <Input type={showId ? 'text' : 'password'} value={form.client_id} onChange={e => set('client_id', e.target.value)} className="pr-10 h-11 rounded-xl font-mono text-xs" />
              <button type="button" onClick={() => setShowId(!showId)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showId ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <Label className="text-xs font-black text-gray-500 uppercase tracking-wider">Client Secret *</Label>
            <div className="relative mt-1.5">
              <Input type={showSecret ? 'text' : 'password'} value={form.client_secret} onChange={e => set('client_secret', e.target.value)} className="pr-10 h-11 rounded-xl font-mono text-xs" />
              <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>

        {testResult && (
          <div className={cn(
            'flex items-center gap-3 p-4 rounded-2xl border transition-all animate-in fade-in slide-in-from-top-2',
            testResult.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          )}>
            {testResult.ok ? <CheckCircle2 className="text-green-600" size={18} /> : <XCircle className="text-red-500" size={18} />}
            <div>
               <p className={cn("text-sm font-bold", testResult.ok ? "text-green-800" : "text-red-800")}>{testResult.ok ? 'Connection Verified' : 'Validation Failed'}</p>
               <p className="text-xs text-gray-500 mt-0.5">{testResult.message}</p>
            </div>
          </div>
        )}

        <Button onClick={handleTestConnection} disabled={testing || !form.client_id || !form.client_secret} variant="outline" className="w-full h-11 rounded-xl border-2 border-gray-100 hover:border-blue-200 transition-all font-bold group">
           {testing ? <Loader2 className="animate-spin mr-2" size={16} /> : <RefreshCw className="mr-2 group-hover:rotate-180 transition-transform duration-500" size={16} />}
           Test LHDN Connection
        </Button>

        <a href={form.env === 'sandbox' ? "https://preprod.myinvois.hasil.gov.my" : "https://myinvois.hasil.gov.my"} 
           target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 text-xs font-black text-blue-600 hover:text-blue-700 transition-colors pt-2">
          <ExternalLink size={14} /> Open MyInvois Portal
        </a>
      </Section>

      <div className="pt-4">
        <Button onClick={handleSave} disabled={saving} className="w-full h-12 rounded-2xl bg-gray-900 hover:bg-black text-white font-black shadow-xl shadow-gray-200 active:scale-95 transition-all">
          {saving ? <Loader2 className="animate-spin mr-2" /> : null}
          Save E-Invoice Configuration
        </Button>
      </div>
    </div>
  )
}
