'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Save, Mail, Bot, ExternalLink, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { DEFAULT_CONFIG, type StoreConfig } from '@/lib/store-types'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700 block">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function Section({ title, desc, icon, children }: { title: string; desc?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="border-gray-100 shadow-sm overflow-hidden">
      <CardHeader className="bg-gray-50/50 pb-4">
        <div className="flex items-center gap-2">
          {icon && <div className="text-blue-600">{icon}</div>}
          <div>
            <CardTitle className="text-base font-bold">{title}</CardTitle>
            {desc && <CardDescription className="text-xs">{desc}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {children}
      </CardContent>
    </Card>
  )
}

export function EmailSettingsClient({ merchant }: { merchant: any }) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)

  const [config, setConfig] = useState<StoreConfig>({
    ...DEFAULT_CONFIG,
    ...(merchant.store_config ?? {}),
    email: (merchant.store_config?.email ?? merchant.email) ?? '',
    inboundEmail: (merchant.store_config?.inboundEmail ?? merchant.inbound_email) ?? '',
    supportInboundEmail: (merchant.store_config?.supportInboundEmail ?? merchant.support_inbound_email) ?? '',
    marketingDomain: (merchant.store_config?.marketingDomain ?? merchant.marketing_domain) ?? '',
    marketingFromName: (merchant.store_config?.marketingFromName ?? merchant.marketing_from_name) ?? '',
  })

  const setCfg = (k: keyof StoreConfig, v: any) => setConfig(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('merchants')
        .update({
          store_config: config,
          email: config.email,
          inbound_email: config.inboundEmail,
          support_inbound_email: config.supportInboundEmail,
          marketing_domain: config.marketingDomain,
          marketing_from_name: config.marketingFromName,
        })
        .eq('id', merchant.id)

      if (error) throw error

      toast.success('Email settings saved!')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Email Settings</h1>
          <p className="text-sm text-muted-foreground">Configure how your store communicates via email.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="rounded-xl h-11 px-6 font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Basic Configuration */}
        <Section title="Basic Configuration" desc="General email contact details for your store." icon={<Mail size={20} />}>
          <Field label="Public Contact Email" hint="Shown on your storefront and invoices as the primary contact.">
            <Input 
              value={config.email} 
              onChange={e => setCfg('email', e.target.value)} 
              placeholder="hello@yourstore.com"
              className="rounded-xl h-11"
            />
          </Field>
        </Section>

        {/* AI Assistant Configuration */}
        <Section title="AI Assistant (Inbound Email)" desc="Enable your AI Agent to handle customer inquiries via email." icon={<Bot size={20} />}>
          <div className="space-y-6">
            <Field label="AI Agent Inbound Email" hint="This should be the address where customer enquiries are sent.">
              <Input 
                value={config.inboundEmail} 
                onChange={e => setCfg('inboundEmail', e.target.value)} 
                placeholder="support@mail.yourdomain.com"
                className="rounded-xl h-11 border-blue-100 bg-blue-50/5"
              />
            </Field>

            <Field label="Support Agent Inbound Email" hint="Dedicated address for Support Agent inquiries.">
              <Input 
                value={config.supportInboundEmail} 
                onChange={e => setCfg('supportInboundEmail', e.target.value)} 
                placeholder="support@mail.yourdomain.com"
                className="rounded-xl h-11 border-purple-100 bg-purple-50/5"
              />
            </Field>

            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 space-y-3">
              <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                <ShieldCheck size={16} />
                Integration Checklist
              </h4>
              <ul className="text-xs text-blue-700 space-y-2 list-disc pl-4">
                <li>
                  <strong>Resend Domain:</strong> Ensure you have verified your domain (e.g., <code>mail.yourdomain.com</code>) in the Resend dashboard.
                </li>
                <li>
                  <strong>MX Records:</strong> Point your subdomain's MX records to Resend to enable inbound processing.
                </li>
                <li>
                  <strong>Webhook:</strong> Add a Webhook in Resend to point to your worker's endpoint:
                  <div className="mt-1 font-mono bg-white/50 p-1 rounded border border-blue-200 select-all overflow-x-auto">
                    https://functions-worker.YOUR_APP.workers.dev/webhooks/resend
                  </div>
                  <em className="block mt-1 opacity-70">Enable "email.received" event in the webhook settings.</em>
                </li>
              </ul>
              <div className="pt-2">
                <a 
                  href="https://resend.com/docs/dashboard/emails/inbound-emails" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  View Resend Documentation <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </div>
        </Section>
  
        {/* Marketing Configuration */}
        <Section title="Marketing Email" desc="Configure how your bulk marketing emails are sent." icon={<Mail size={20} />}>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Sender Name" hint="Example: 'Hyperlocal Support' or 'Your Store Name'">
              <Input 
                value={config.marketingFromName} 
                onChange={e => setCfg('marketingFromName', e.target.value)} 
                placeholder="My Awesome Store"
                className="rounded-xl h-11"
              />
            </Field>
            <Field label="Marketing Domain" hint="Verified domain in Resend (e.g. mail.yourstore.com)">
              <Input 
                value={config.marketingDomain} 
                onChange={e => setCfg('marketingDomain', e.target.value)} 
                placeholder="mail.yourstore.com"
                className="rounded-xl h-11"
              />
            </Field>
          </div>
        </Section>
      </div>
    </div>
  )
}
