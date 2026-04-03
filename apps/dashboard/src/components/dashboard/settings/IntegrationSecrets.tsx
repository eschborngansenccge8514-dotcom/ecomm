'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, Key, ShoppingBag, CreditCard, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';

const INTEGRATIONS = [
  { id: 'shopee',   name: 'Shopee',       icon: <ShoppingBag size={18} />, type: 'marketplace' },
  { id: 'lazada',   name: 'Lazada',       icon: <ShoppingBag size={18} />, type: 'marketplace' },
  { id: 'tiktok',   name: 'TikTok Shop',  icon: <ShoppingBag size={18} />, type: 'marketplace' },
  { id: 'billplz',   name: 'Billplz',      icon: <CreditCard size={18} />,  type: 'payment' },
  { id: 'razorpay', name: 'Razorpay',     icon: <CreditCard size={18} />,  type: 'payment' },
];

export function IntegrationSecrets() {
  const [loading,     setLoading]     = useState<Record<string, boolean>>({});
  const [secrets,     setSecrets]     = useState<Record<string, string>>({});
  const [configured,  setConfigured]  = useState<Record<string, boolean>>({});
  const supabase = createClient();

  useEffect(() => {
    async function fetchConfigured() {
      const { data } = await supabase
        .from('merchant_integrations')
        .select('provider, is_configured');
      
      const map: Record<string, boolean> = {};
      data?.forEach(i => map[i.provider] = i.is_configured);
      setConfigured(map);
    }
    fetchConfigured();
  }, []);

  const saveSecret = async (provider: string) => {
    const secret = secrets[provider];
    if (!secret) {
        toast.error('Please enter a secret/API key');
        return;
    }

    setLoading(prev => ({ ...prev, [provider]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/save-integration-secret`, {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type':  'application/json'
        },
        body: JSON.stringify({ provider, secret })
      });

      if (!res.ok) throw new Error('Failed to save secret');

      toast.success(`${INTEGRATIONS.find(i => i.id === provider)?.name} secret saved securely!`);
      setConfigured(prev => ({ ...prev, [provider]: true }));
      setSecrets(prev => ({ ...prev, [provider]: '' }));
    } catch (err) {
      toast.error('Error: ' + String(err));
    } finally {
        setLoading(prev => ({ ...prev, [provider]: false }));
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {INTEGRATIONS.map((integration) => (
        <Card key={integration.id} className="rounded-2xl border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="bg-gray-50/50 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-primary">
                  {integration.icon}
                </div>
                <div>
                  <CardTitle className="text-base font-bold">{integration.name}</CardTitle>
                  <CardDescription className="text-[11px] uppercase font-bold tracking-wider text-gray-400">
                    {integration.type}
                  </CardDescription>
                </div>
              </div>
              {configured[integration.id] && (
                <Badge className="bg-green-100 text-green-700 border-green-200 gap-1 rounded-full px-2">
                  <CheckCircle2 size={12} /> Configured
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500">
                {integration.name} API Key / Secret
              </Label>
              <div className="relative">
                 <Input 
                  type="password"
                  placeholder={configured[integration.id] ? "••••••••••••••••" : `Enter your ${integration.name} key`}
                  value={secrets[integration.id] || ''}
                  onChange={e => setSecrets(prev => ({ ...prev, [integration.id]: e.target.value }))}
                  className="bg-gray-50/50 border-gray-100 pr-10 focus:bg-white transition-all font-mono text-sm"
                />
                <Key className="absolute right-3 top-2.5 text-gray-300 w-4 h-4" />
              </div>
              <p className="text-[10px] text-gray-400 italic">
                Stored securely in encrypted vault. Never shared.
              </p>
            </div>
            <Button 
                onClick={() => saveSecret(integration.id)} 
                disabled={loading[integration.id]}
                className="w-full bg-primary hover:bg-primary/90 text-white gap-2 font-semibold shadow-sm"
            >
              {loading[integration.id] ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              {configured[integration.id] ? 'Update Secret' : 'Connect Integration'}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
