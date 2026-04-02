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
  Loader2, ExternalLink, AlertTriangle, RefreshCw, CreditCard
} from 'lucide-react'

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

export function RazorpaySettings({ config: initial, merchantId }: {
  config: any; merchantId: string
}) {
  const supabase = createClient()

  const [form, setForm] = useState({
    key_id:         initial?.key_id         ?? '',
    key_secret:     initial?.key_secret     ?? '',
    webhook_secret: initial?.webhook_secret ?? '',
  })

  const [showSecret,  setShowSecret]  = useState(false)
  const [showWebhook, setShowWebhook] = useState(false)
  const [saving,      setSaving]      = useState(false)

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!form.key_id || !form.key_secret) {
      toast.error('Key ID and Key Secret are required')
      return
    }
    setSaving(true)

    const { error } = await supabase
      .from('merchant_razorpay_config')
      .upsert({
        merchant_id:    merchantId,
        key_id:         form.key_id,
        key_secret:     form.key_secret,
        webhook_secret: form.webhook_secret || null,
        updated_at:     new Date().toISOString(),
      }, { onConflict: 'merchant_id' })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Razorpay credentials saved!')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <Section
        title="Razorpay API Credentials"
        subtitle="These keys are used to process payments and handle refunds for your store."
      >
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex gap-2.5 items-start">
          <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 leading-relaxed">
            <strong>Important:</strong> Ensure you are using the correct keys for your environment (Test vs Live). 
            Refunds will only work if the orders were placed using these keys.
          </p>
        </div>

        {/* Key ID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Key ID</Label>
            <Input
              value={form.key_id}
              onChange={e => set('key_id', e.target.value)}
              placeholder="rzp_test_..."
              className="mt-1.5 font-mono text-sm"
            />
          </div>

          {/* Key Secret */}
          <div>
            <Label>Key Secret</Label>
            <div className="relative mt-1.5">
              <Input
                type={showSecret ? 'text' : 'password'}
                value={form.key_secret}
                onChange={e => set('key_secret', e.target.value)}
                placeholder="Your Razorpay Secret Key"
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
        </div>

        {/* Webhook Secret */}
        <div>
          <Label className="flex items-center gap-1.5">
            Webhook Secret
            <span className="text-[10px] font-normal text-gray-400 font-sans italic ml-auto">(Optional - for signature verification)</span>
          </Label>
          <div className="relative mt-1.5">
            <Input
              type={showWebhook ? 'text' : 'password'}
              value={form.webhook_secret}
              onChange={e => set('webhook_secret', e.target.value)}
              placeholder="Your Webhook Secret"
              className="pr-10 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowWebhook(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showWebhook ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
          {saving
            ? <><Loader2 size={15} className="animate-spin mr-2" />Saving...</>
            : <><CreditCard size={15} className="mr-2" />Save Razorpay Credentials</>}
        </Button>

        <a
          href="https://dashboard.razorpay.com/app/settings/api_keys"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 text-sm text-blue-600 hover:underline w-full"
        >
          <ExternalLink size={13} />
          Find your keys in Razorpay Dashboard
        </a>
      </Section>

      <Section
        title="Refunds"
        subtitle="Information about how refunds are handled."
      >
        <p className="text-sm text-gray-600 leading-relaxed">
          When this configuration is active, you will be able to initiate refunds directly from the 
          <strong> Order Details</strong> page for any order paid via Razorpay. 
          The refund will be processed immediately to the customer's original payment method.
        </p>
      </Section>
    </div>
  )
}
