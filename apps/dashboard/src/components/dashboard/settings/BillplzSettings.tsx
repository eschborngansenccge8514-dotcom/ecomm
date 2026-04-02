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
  CheckCircle2, XCircle,
  Loader2, ExternalLink, AlertTriangle, Receipt
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

export function BillplzSettings({ config: initial, merchantId }: {
  config: any; merchantId: string
}) {
  const supabase = createClient()

  const [form, setForm] = useState({
    collection_id:               initial?.collection_id ?? '',
    payment_order_collection_id: initial?.payment_order_collection_id ?? '',
    x_signature:                 initial?.x_signature   ?? '',
    enabled:                     initial?.enabled       ?? true,
  })

  const [saving, setSaving] = useState(false)

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!form.collection_id) {
      toast.error('Collection ID is required')
      return
    }
    setSaving(true)

    const { error } = await supabase
      .from('merchant_billplz_config')
      .upsert({
        merchant_id:                 merchantId,
        collection_id:               form.collection_id,
        payment_order_collection_id: form.payment_order_collection_id || null,
        x_signature:                 form.x_signature || null,
        enabled:                     form.enabled,
        updated_at:                  new Date().toISOString(),
      }, { onConflict: 'merchant_id' })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Billplz configuration saved!')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <Section
        title="Billplz Configuration"
        subtitle="Configure your Billplz collections to start accepting payments and processing refunds."
      >
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2.5 items-start">
          <AlertTriangle size={15} className="text-blue-600 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700 leading-relaxed">
            <strong>Note:</strong> The main API Key is managed securely by the platform. 
            You only need to provide your <strong>Collection IDs</strong>.
          </p>
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
           <div className="space-y-0.5">
             <Label className="text-base">Enable Billplz</Label>
             <p className="text-xs text-gray-400">Allow customers to pay via FPX/Billplz</p>
           </div>
           <Switch 
             checked={form.enabled} 
             onCheckedChange={v => set('enabled', v)} 
           />
        </div>

        {/* Collection ID */}
        <div>
          <Label>Standard Collection ID</Label>
          <Input
            value={form.collection_id}
            onChange={e => set('collection_id', e.target.value)}
            placeholder="e.g. x1y2z3..."
            className="mt-1.5 font-mono text-sm"
          />
          <p className="text-[10px] text-gray-400 mt-1 font-sans italic">
            Used for creating customer bills.
          </p>
        </div>

        {/* Payment Order Collection ID */}
        <div>
          <Label className="flex items-center gap-1.5">
            Payment Order Collection ID
            <span className="text-[10px] font-normal text-gray-400 font-sans italic ml-auto">(Required for Refunds)</span>
          </Label>
          <Input
            value={form.payment_order_collection_id}
            onChange={e => set('payment_order_collection_id', e.target.value)}
            placeholder="e.g. 23349419-..."
            className="mt-1.5 font-mono text-sm border-orange-100 focus:border-orange-400"
          />
          <p className="text-[10px] text-gray-400 mt-1 font-sans italic">
            Found in Billplz Dashboard ➜ Payment Order ➜ Collections.
          </p>
        </div>

        {/* X-Signature Key */}
        <div>
          <Label className="flex items-center gap-1.5">
            X-Signature Key
            <span className="text-[10px] bg-red-50 text-red-600 px-1.5 rounded-full border border-red-100 font-medium">Required for Refunds</span>
          </Label>
          <Input
            value={form.x_signature}
            onChange={e => set('x_signature', e.target.value)}
            placeholder="Your Billplz X-Signature Key"
            className="mt-1.5 font-mono text-sm border-blue-100 focus:border-blue-400"
          />
          <p className="text-[10px] text-gray-400 mt-1 font-sans italic">
            Found in Billplz Dashboard ➜ Settings ➜ X-Signature Key
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
          {saving
            ? <><Loader2 size={15} className="animate-spin mr-2" />Saving...</>
            : <><Receipt size={15} className="mr-2" />Save Billplz Configuration</>}
        </Button>

        <a
          href="https://www.billplz.com/dashboard"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 text-sm text-blue-600 hover:underline w-full"
        >
          <ExternalLink size={13} />
          Go to Billplz Dashboard
        </a>
      </Section>

      <Section
        title="Refunds"
        subtitle="How to handle Billplz refunds."
      >
        <p className="text-sm text-gray-600 leading-relaxed">
          Refunds for Billplz orders can be initiated directly from the <strong>Order Details</strong> page. 
          The system will use the platform's API key to process the refund back to the customer's bank account.
        </p>
      </Section>
    </div>
  )
}
