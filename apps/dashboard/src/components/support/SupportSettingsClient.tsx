'use client'

import React, { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

interface SupportSettingsClientProps {
  userId: string
  initialConfig: any
}

export function SupportSettingsClient({ userId, initialConfig }: SupportSettingsClientProps) {
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState({
    welcome_message: initialConfig?.welcome_message || 'Hello! How can we help you today?',
    ai_enabled: initialConfig?.ai_enabled ?? true,
    escalation_email: initialConfig?.escalation_email || '',
    knowledge_base_text: initialConfig?.knowledge_base_text || '',
  })

  const supabase = createClient()

  async function handleSave() {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('support_configs')
        .upsert({
          merchant_id: userId,
          ...config,
          updated_at: new Date().toISOString()
        })

      if (error) throw error
      toast.success('Settings saved successfully!')
    } catch (e: any) {
      console.error('[SupportSettings] Save failed:', e)
      toast.error('Failed to save settings: ' + e.message)
    } finally {
      setLoading(false)
    }
  }



  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7 pb-10">
      <div className="col-span-4 space-y-6">
        <Card className="transition-all hover:shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">General Configuration</CardTitle>
            <CardDescription>
              Customize your AI support agent's behavior and basic handling.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 border rounded-2xl bg-slate-50/50">
              <div className="space-y-1">
                <Label htmlFor="ai-enabled" className="text-base font-bold">Enable AI Support Assistant</Label>
                <p className="text-sm text-slate-500">Automatically reply to customers using Gemini 3.1 Flash.</p>
              </div>
              <Switch 
                id="ai-enabled"
                checked={config.ai_enabled}
                onCheckedChange={(val) => setConfig({ ...config, ai_enabled: val })}
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="welcome" className="text-sm font-bold uppercase tracking-tight text-slate-500">Welcome Message</Label>
              <Input 
                id="welcome"
                className="rounded-xl border-slate-200"
                value={config.welcome_message}
                onChange={(e) => setConfig({ ...config, welcome_message: e.target.value })}
                placeholder="e.g. Hello! How can we help you today?"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="email" className="text-sm font-bold uppercase tracking-tight text-slate-500">Escalation Email</Label>
              <Input 
                id="email"
                type="email"
                className="rounded-xl border-slate-200"
                value={config.escalation_email}
                onChange={(e) => setConfig({ ...config, escalation_email: e.target.value })}
                placeholder="support@yourstore.com"
              />
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">A notification will be sent here when a customer requests human help.</p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end pt-4 border-t">
            <Button onClick={handleSave} disabled={loading} className="w-full sm:w-auto rounded-xl">
              {loading ? 'Saving...' : 'Save Configuration'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="col-span-3">
        <Card className="h-full transition-all hover:shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Knowledge Base</CardTitle>
            <CardDescription>
              Provide FAQs, return policies, and business information for the AI to reference.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea 
              className="min-h-[600px] font-medium text-sm leading-relaxed rounded-2xl border-slate-200 bg-slate-50/50 p-6"
              value={config.knowledge_base_text}
              onChange={(e) => setConfig({ ...config, knowledge_base_text: e.target.value })}
              placeholder="Example: \nFAQ: Where do you ship to? \nAnswer: We ship everywhere in Southeast Asia.\n\nReturns: \nCustomers can return items within 30 days..."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
