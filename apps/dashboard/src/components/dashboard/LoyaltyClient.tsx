'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button }       from '@/components/ui/button'
import { Input }        from '@/components/ui/input'
import { Label }        from '@/components/ui/label'
import { Switch }       from '@/components/ui/switch'
import { Badge }        from '@/components/ui/badge'
import { Progress, ProgressTrack, ProgressIndicator } from '@/components/ui/progress'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import toast            from 'react-hot-toast'
import { format }       from 'date-fns'
import { 
  Star, 
  Users, 
  TrendingUp, 
  Award, 
  Search, 
  Settings2, 
  ArrowUpRight, 
  ArrowDownRight,
  ChevronRight,
  History,
  ShieldCheck,
  Plus,
  Filter,
  Info
} from 'lucide-react'
import { cn }           from '@/lib/utils'
import { LoyaltyAdjustPointsDialog } from './LoyaltyAdjustPointsDialog'

const TIER_CONFIG = {
  bronze:   { style: 'bg-orange-50 text-orange-700 border-orange-100', icon: '🥉', color: '#f97316' },
  silver:   { style: 'bg-slate-50 text-slate-700 border-slate-100', icon: '🥈', color: '#64748b' },
  gold:     { style: 'bg-amber-50 text-amber-700 border-amber-100', icon: '🥇', color: '#f59e0b' },
  platinum: { style: 'bg-purple-50 text-purple-700 border-purple-100', icon: '💎', color: '#a855f7' },
}

function StatCard({ icon, label, value, sub, trend }: { 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  sub?: string;
  trend?: { val: string; positive: boolean }
}) {
  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-white shadow-sm p-6 hover:shadow-md transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">{label}</p>
          <p className="text-3xl font-black text-foreground tracking-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground font-medium">{sub}</p>}
          {trend && (
            <div className={cn("flex items-center gap-1 text-[10px] font-bold mt-2 px-2 py-0.5 rounded-full w-fit", 
              trend.positive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
              {trend.positive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
              {trend.val}
            </div>
          )}
        </div>
        <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-blue-600 border border-gray-50">
          {icon}
        </div>
      </div>
    </div>
  )
}

function GlassSection({ title, children, className, action }: { title: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <div className={cn("bg-white/40 backdrop-blur-2xl rounded-[2.5rem] border border-white/60 shadow-sm p-8", className)}>
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-bold text-foreground tracking-tight">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

export function LoyaltyClient({ settings: init, topCustomers, recentTransactions, merchantId, statsSummary }: {
  settings: any; topCustomers: any[]; recentTransactions: any[]
  merchantId: string; statsSummary: any
}) {
  const [settings, setSettings] = useState(init ?? {})
  const [saving, setSaving]     = useState(false)
  const [tab, setTab]           = useState<'overview' | 'members' | 'settings'>('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [adjustingCustomer, setAdjustingCustomer] = useState<any>(null)
  
  const supabase = createClient()

  const set = (k: string, v: any) => setSettings((p: any) => ({ ...p, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('loyalty_settings')
      .upsert({ ...settings, merchant_id: merchantId }, { onConflict: 'merchant_id' })
    if (error) toast.error(error.message)
    else toast.success('Loyalty settings updated')
    setSaving(false)
  }

  // Memoized analytics
  const analytics = useMemo(() => {
    const last30DaysTxns = recentTransactions.filter(t => 
      new Date(t.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    )
    const pointsVelocity = last30DaysTxns.reduce((s, t) => s + (t.type === 'earn' ? t.points_delta : 0), 0)
    const redemptions = last30DaysTxns.filter(t => t.type === 'redeem').length
    
    return {
      pointsVelocity,
      redemptions30d: redemptions,
      avgBalance: statsSummary.totalMembers > 0 ? Math.round(statsSummary.totalOutstanding / statsSummary.totalMembers) : 0
    }
  }, [recentTransactions, statsSummary])

  const filteredMembers = useMemo(() => {
    if (!searchQuery) return topCustomers
    const q = searchQuery.toLowerCase()
    return topCustomers.filter(c => 
      c.profiles?.full_name?.toLowerCase().includes(q) || 
      c.customer_id.toLowerCase().includes(q)
    )
  }, [topCustomers, searchQuery])

  const calculateTierProgress = (spent: number, tier: string) => {
    const thresholds = {
      bronze:   settings.tier_silver_rm   || 200,
      silver:   settings.tier_gold_rm     || 500,
      gold:     settings.tier_platinum_rm || 1000,
      platinum: Infinity
    }
    const currentThreshold = thresholds[tier as keyof typeof thresholds]
    if (currentThreshold === Infinity) return 100
    return Math.min(Math.round((spent / currentThreshold) * 100), 100)
  }

  return (
    <div className="space-y-8 pb-20">
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tight text-foreground">
              {settings.program_name ?? 'Loyalty Master'}
            </h1>
            <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest border-2", 
              settings.is_enabled ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200")}>
              {settings.is_enabled ? 'Active' : 'Paused'}
            </Badge>
          </div>
          <p className="text-muted-foreground font-medium italic">Empower your community with bespoke rewards and tier-based prestige.</p>
        </div>

        <div className="flex items-center gap-2 bg-white/50 backdrop-blur-xl p-1.5 rounded-[1.5rem] border border-white shadow-sm">
          {['overview', 'members', 'settings'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t as any)}
              className={cn(
                "px-6 py-2.5 rounded-[1.1rem] text-sm font-bold transition-all duration-300 capitalize",
                tab === t 
                  ? "bg-foreground text-background shadow-lg shadow-gray-200" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── STATUS TOGGLE ── */}
      {!settings.is_enabled && (
        <div className="bg-amber-50/50 backdrop-blur-xl border border-amber-200 rounded-[2rem] p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
              <Info size={24} />
            </div>
            <div>
              <p className="font-bold text-amber-900">Program currently paused</p>
              <p className="text-sm text-amber-800/70">Customers won't earn or redeem points until the program is activated.</p>
            </div>
          </div>
          <Button 
            onClick={() => {
              set('is_enabled', true)
              supabase.from('loyalty_settings').update({ is_enabled: true }).eq('merchant_id', merchantId).then(() => toast.success('Program Activated'))
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-2xl px-8 font-black uppercase tracking-wider text-xs"
          >
            Activate Now
          </Button>
        </div>
      )}

      {/* ── TABS CONTENT ── */}
      <div className="animate-in fade-in duration-500">
        {tab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard icon={<Users size={20} />} label="Total Members" value={statsSummary.totalMembers.toLocaleString()} trend={{ val: '12% up', positive: true }} />
              <StatCard 
                icon={<Star size={20} />} 
                label="Points Burndown" 
                value={statsSummary.totalOutstanding.toLocaleString()} 
                sub={`RM ${(statsSummary.totalOutstanding * (settings.rm_per_point ?? 0.01)).toFixed(2)} Liability`} 
              />
              <StatCard icon={<TrendingUp size={20} />} label="Points Velocity" value={`+${analytics.pointsVelocity.toLocaleString()}`} sub="Last 30 days" trend={{ val: '4.2% up', positive: true }} />
              <StatCard icon={<History size={20} />} label="Redemptions" value={analytics.redemptions30d.toString()} sub="Last 30 days" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <GlassSection title="Tier Distribution" className="lg:col-span-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  {(['bronze', 'silver', 'gold', 'platinum'] as const).map(t => (
                    <div key={t} className={cn("group rounded-[2rem] p-6 border transition-all duration-300", TIER_CONFIG[t].style, "hover:scale-[1.02] hover:shadow-xl")}>
                      <div className="flex flex-col items-center text-center space-y-3">
                        <div className="text-4xl mb-2 group-hover:animate-bounce">{TIER_CONFIG[t].icon}</div>
                        <div className="space-y-1">
                          <p className="text-3xl font-black tracking-tighter">{statsSummary.tierCounts[t]}</p>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">{t}</p>
                        </div>
                        <div className="w-full bg-white/50 rounded-full h-1.5 mt-4">
                          <div 
                            className="bg-current h-full rounded-full opacity-40 transition-all duration-1000" 
                            style={{ width: `${(statsSummary.tierCounts[t] / statsSummary.totalMembers) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassSection>

              <GlassSection title="Live Audit Trail">
                <div className="space-y-6">
                  {recentTransactions.slice(0, 6).map((txn, i) => (
                    <div key={txn.id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-sm border border-white", 
                          txn.type === 'earn' ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-600")}>
                          {txn.type === 'earn' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground group-hover:text-blue-600 transition-colors">
                            {txn.profiles?.full_name ?? 'Anonymous'}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                            {format(new Date(txn.created_at), 'd MMM')} • {txn.type === 'earn' ? 'Earned' : 'Redeemed'}
                          </p>
                        </div>
                      </div>
                      <div className={cn("text-sm font-black tracking-tighter", txn.type === 'earn' ? "text-green-600" : "text-orange-600")}>
                        {txn.points_delta > 0 ? '+' : ''}{txn.points_delta.toLocaleString()}
                      </div>
                    </div>
                  ))}
                  <Button variant="ghost" className="w-full rounded-2xl text-xs font-bold text-muted-foreground mt-4 border border-dashed hover:border-solid">
                    View Full Ledger <ChevronRight size={14} className="ml-1" />
                  </Button>
                </div>
              </GlassSection>
            </div>
          </div>
        )}

        {tab === 'members' && (
          <GlassSection 
            title="Member Explorer" 
            action={
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input 
                    placeholder="Search name or ID..." 
                    className="pl-11 pr-4 py-6 rounded-2xl bg-white/50 border-none w-64 focus-visible:ring-blue-500/20 shadow-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="icon" className="rounded-2xl w-12 h-12 bg-white/50 border-none shadow-sm">
                  <Filter size={18} />
                </Button>
              </div>
            }
          >
            <div className="overflow-x-auto -mx-8 px-8">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-4 py-4">Identity</th>
                    <th className="text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-4 py-4">Elite Tier</th>
                    <th className="text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-4 py-4">Points Power</th>
                    <th className="text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-4 py-4">Next Goal</th>
                    <th className="text-right text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-4 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50/50">
                  {filteredMembers.map((c) => (
                    <tr key={c.customer_id} className="group hover:bg-blue-50/20 transition-colors">
                      <td className="px-4 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-lg shadow-blue-100">
                            {(c.profiles?.full_name ?? 'G').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{c.profiles?.full_name ?? 'Guest Member'}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{c.customer_id.split('-')[0]}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-6">
                        <Badge className={cn("rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest border-2", TIER_CONFIG[c.tier as keyof typeof TIER_CONFIG].style)}>
                          {TIER_CONFIG[c.tier as keyof typeof TIER_CONFIG].icon} {c.tier}
                        </Badge>
                      </td>
                      <td className="px-4 py-6">
                        <div className="space-y-1">
                          <p className="text-base font-black text-blue-600 tabular-nums">{Number(c.balance).toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Available Pts</p>
                        </div>
                      </td>
                      <td className="px-4 py-6 max-w-[200px]">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="text-foreground">{calculateTierProgress(c.total_spent_rm, c.tier)}%</span>
                          </div>
                          <Progress value={calculateTierProgress(c.total_spent_rm, c.tier)} className="h-1.5" />
                        </div>
                      </td>
                      <td className="px-4 py-6 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="rounded-xl font-bold bg-white/50 border border-transparent hover:border-gray-100"
                          onClick={() => setAdjustingCustomer({
                            id: c.customer_id,
                            full_name: c.profiles?.full_name ?? 'Guest',
                            current_balance: c.balance
                          })}
                        >
                          Quick Adjust
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassSection>
        )}

        {tab === 'settings' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2 space-y-8">
              <GlassSection title="Core Ecosystem">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest ml-1 text-muted-foreground">Program Identity</Label>
                      <Input 
                        value={settings.program_name ?? ''} 
                        onChange={e => set('program_name', e.target.value)}
                        placeholder="e.g. Diamond Circle" 
                        className="rounded-2xl py-6 border-gray-100 bg-white/50 focus-visible:ring-blue-500/10"
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                      <div>
                        <p className="text-sm font-bold text-blue-900">Points Accumulation</p>
                        <p className="text-xs text-blue-800/60">Allow customers to earn points on purchases</p>
                      </div>
                      <Switch 
                        checked={!!settings.is_enabled} 
                        onCheckedChange={v => set('is_enabled', v)}
                      />
                    </div>
                  </div>
                  <div className="bg-gray-50/50 rounded-[2rem] p-6 border border-white flex flex-col justify-center items-center text-center space-y-4">
                    <div className="w-16 h-16 bg-white rounded-3xl shadow-sm flex items-center justify-center">
                      <Star className="text-yellow-400 fill-yellow-400" size={32} />
                    </div>
                    <div className="space-y-1">
                      <p className="font-black text-xl">Visual Reward Preview</p>
                      <p className="text-sm text-muted-foreground max-w-[200px]">Spend <span className="font-bold text-foreground">RM 100</span> to receive <span className="font-bold text-blue-600">{(100 * (settings.points_per_rm ?? 1)).toFixed(0)} pts</span></p>
                    </div>
                  </div>
                </div>
              </GlassSection>

              <GlassSection title="Earning & Redemption Math">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest ml-1 text-muted-foreground">Earning Base (Points / RM)</Label>
                      <Input type="number" step="0.1" value={settings.points_per_rm ?? 1} 
                        onChange={e => set('points_per_rm', e.target.value)}
                        className="rounded-2xl py-6 border-gray-100 bg-white/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest ml-1 text-muted-foreground">Cashback Value (RM / Point)</Label>
                      <Input type="number" step="0.001" value={settings.rm_per_point ?? 0.01} 
                        onChange={e => set('rm_per_point', e.target.value)}
                        className="rounded-2xl py-6 border-gray-100 bg-white/50" />
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest ml-1 text-muted-foreground">Minimum Entry for Redemption</Label>
                      <Input type="number" value={settings.min_redeem_points ?? 100} 
                        onChange={e => set('min_redeem_points', e.target.value)}
                        className="rounded-2xl py-6 border-gray-100 bg-white/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest ml-1 text-muted-foreground">Max Discount Guardrail (%)</Label>
                      <Input type="number" max="100" value={settings.max_redeem_pct ?? 50} 
                        onChange={e => set('max_redeem_pct', e.target.value)}
                        className="rounded-2xl py-6 border-gray-100 bg-white/50" />
                    </div>
                  </div>
                </div>
              </GlassSection>

              <GlassSection title="Prestige Tier Logic">
                <div className="space-y-8">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {[
                      { key: 'tier_silver_rm', icon: '🥈', label: 'Silver' },
                      { key: 'tier_gold_rm', icon: '🥇', label: 'Gold' },
                      { key: 'tier_platinum_rm', icon: '💎', label: 'Platinum' },
                    ].map(t => (
                      <div key={t.key} className="space-y-3 p-4 bg-white/30 rounded-3xl border border-white">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{t.icon}</span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t.label} (RM)</span>
                        </div>
                        <Input type="number" value={settings[t.key] ?? ''} 
                          onChange={e => set(t.key, e.target.value)}
                          className="rounded-2xl bg-white/50 border-none shadow-inner" />
                      </div>
                    ))}
                  </div>
                  
                  <div className="p-6 bg-slate-900 rounded-[2rem] text-white space-y-4">
                    <div className="flex items-center gap-3">
                      <Award className="text-slate-400" size={20} />
                      <h4 className="font-bold text-slate-200">Point Multipliers</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      {[
                        { key: 'tier_silver_multiplier', label: 'Silver' },
                        { key: 'tier_gold_multiplier', label: 'Gold' },
                        { key: 'tier_platinum_multiplier', label: 'Platinum' },
                      ].map(t => (
                        <div key={t.key} className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">{t.label} Bonus</Label>
                          <div className="flex items-center gap-2 bg-slate-800 rounded-2xl px-4 py-2 border border-slate-700">
                            <Plus size={10} className="text-slate-500" />
                            <input 
                              type="number" step="0.1" 
                              value={settings[t.key] ?? ''} 
                              onChange={e => set(t.key, e.target.value)}
                              className="bg-transparent border-none focus:ring-0 text-sm font-black w-full"
                            />
                            <span className="text-[10px] text-slate-500 font-black">X</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </GlassSection>
            </div>

            <div className="space-y-8">
              <div className="sticky top-24 space-y-6">
                <GlassSection title="Save Changes">
                  <p className="text-sm text-muted-foreground mb-6">Updating your ecosystem settings will immediately affect how points are calculated for all new transactions.</p>
                  <Button 
                    onClick={handleSave} 
                    disabled={saving} 
                    className="w-full h-16 rounded-[1.5rem] bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-blue-200"
                  >
                    {saving ? 'Synchronizing...' : 'Deploy Updates'}
                  </Button>
                </GlassSection>

                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[2.5rem] p-8 text-white space-y-6 shadow-2xl">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                    <ShieldCheck size={24} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-black tracking-tight">Security & Governance</h4>
                    <p className="text-sm text-blue-50/80 leading-relaxed">System-wide manual adjustments are logged in the audit trail. Ensure point grants align with current promotional policies.</p>
                  </div>
                  <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-200/60">Data Source</p>
                      <p className="text-xs font-bold font-mono">Live Supabase Sync</p>
                    </div>
                    <ArrowUpRight size={20} className="text-white/40" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <LoyaltyAdjustPointsDialog 
        isOpen={!!adjustingCustomer}
        onClose={() => setAdjustingCustomer(null)}
        customer={adjustingCustomer}
        merchantId={merchantId}
        onSuccess={() => {
          // In a real app we'd refresh the server side data
          toast.success('Member balance updated successfully!')
          window.location.reload()
        }}
      />
    </div>
  )
}
