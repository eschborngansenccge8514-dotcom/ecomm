import { IntegrationSecrets } from '@/components/dashboard/settings/IntegrationSecrets';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Info } from 'lucide-react';

export default function IntegrationsPage() {
  return (
    <div className="max-w-5xl mx-auto py-10 px-6 space-y-10 animate-in fade-in duration-500">
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 drop-shadow-sm">Marketplace & Payments</h1>
            <p className="text-sm text-gray-500 mt-1 max-w-lg leading-relaxed">
              Securely connect your marketplace accounts and payment gateways. All credentials are encrypted and stored in an enterprise-grade vault.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-primary/5 text-primary px-4 py-2 rounded-2xl border border-primary/10 shadow-sm self-start md:self-center">
            <ShieldCheck size={20} className="shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider">Enterprise Security</span>
          </div>
        </div>
      </div>

      <section className="space-y-6">
        <div className="flex items-center gap-2.5 px-1">
          <Badge className="bg-primary/10 text-primary border-none text-[10px] uppercase font-black tracking-widest px-2.5 py-1 rounded-lg">Step 1</Badge>
          <h2 className="text-lg font-bold text-gray-800">Configure Secrets</h2>
        </div>
        <IntegrationSecrets />
      </section>

      <section className="bg-amber-50/50 border border-amber-100 rounded-3xl p-8 flex flex-col md:flex-row gap-6 items-start shadow-inner">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0 shadow-sm border border-amber-200/50">
            <Info size={28} />
        </div>
        <div className="space-y-2">
            <h3 className="text-lg font-extrabold text-amber-900 tracking-tight">Need help with API keys?</h3>
            <p className="text-sm text-amber-800/80 leading-relaxed max-w-2xl font-medium">
                Each provider has a different process for generating API keys. Check our documentation for step-by-step guides for:
            </p>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-sm font-bold text-amber-700/70">
                <li className="flex items-center gap-1.5 hover:text-amber-800 cursor-help transition-colors">• Shopee Partner Portal</li>
                <li className="flex items-center gap-1.5 hover:text-amber-800 cursor-help transition-colors">• Lazada Open Platform</li>
                <li className="flex items-center gap-1.5 hover:text-amber-800 cursor-help transition-colors">• TikTok Shop Affiliate Lab</li>
                <li className="flex items-center gap-1.5 hover:text-amber-800 cursor-help transition-colors">• Billplz Dashboard</li>
                <li className="flex items-center gap-1.5 hover:text-amber-800 cursor-help transition-colors">• Razorpay Settings</li>
            </ul>
        </div>
      </section>
    </div>
  );
}
