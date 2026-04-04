'use client'

import React, { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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
    business_hours: initialConfig?.business_hours || {}
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
      alert('Settings saved successfully!')
    } catch (e: any) {
      console.error('[SupportSettings] Save failed:', e)
      alert('Failed to save settings: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
      <Card className="col-span-4 transition-all hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">General configuration</CardTitle>
          <CardDescription>
            Customize your AI support agent's behavior and basic behavior.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
            <div className="space-y-1">
              <Label htmlFor="ai-enabled" className="text-base font-medium">Enable AI Support Assistant</Label>
              <p className="text-sm text-muted-foreground">Automatically reply to customers using Gemini 1.5 Flash.</p>
            </div>
            <Switch 
              id="ai-enabled"
              checked={config.ai_enabled}
              onCheckedChange={(val) => setConfig({ ...config, ai_enabled: val })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="welcome">Welcome Message</Label>
            <Input 
              id="welcome"
              value={config.welcome_message}
              onChange={(e) => setConfig({ ...config, welcome_message: e.target.value })}
              placeholder="e.g. Hello! How can we help you today?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Escalation Email</Label>
            <Input 
              id="email"
              type="email"
              value={config.escalation_email}
              onChange={(e) => setConfig({ ...config, escalation_email: e.target.value })}
              placeholder="email@merchant.com"
            />
            <p className="text-xs text-muted-foreground">A notification will be sent here when a customer requests human help.</p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end pt-2 border-t">
          <Button onClick={handleSave} disabled={loading} className="w-full sm:w-auto">
            {loading ? 'Saving...' : 'Save Configuration'}
          </Button>
        </CardFooter>
      </Card>

      <Card className="col-span-3 transition-all hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Knowledge Base</CardTitle>
          <CardDescription>
            Provide FAQs, return policies, and business information for the AI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea 
            className="min-h-[350px] font-mono text-sm leading-relaxed"
            value={config.knowledge_base_text}
            onChange={(e) => setConfig({ ...config, knowledge_base_text: e.target.value })}
            placeholder="Example: \nFAQ: Where do you ship to? \nAnswer: We ship everywhere in Southeast Asia.\n\nReturns: \nCustomers can return items within 30 days..."
          />
        </CardContent>
      </Card>
    </div>
  )
}
