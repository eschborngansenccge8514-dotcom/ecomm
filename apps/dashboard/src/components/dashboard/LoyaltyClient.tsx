'use client'
import { useState }     from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button }       from '@/components/ui/button'
import { Input }        from '@/components/ui/input'
import { Label }        from '@/components/ui/label'
import { Switch }       from '@/components/ui/switch'
import toast            from 'react-hot-toast'
import { format }       from 'date-fns'
import { Star, Users, TrendingUp, Award } from 'lucide-react'
import { cn }           from '@/lib/utils'

const TIER_STYLES = {
  bronze:   'bg-amber-100 text-amber-800',
  silver:   'bg-gray-100 text-gray-700',
  gold:     'bg-yellow-100 text-yellow-800',
  platinum: 'bg-purple-100 text-purple-800',
}
const TIER_EMOJI = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎' }

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
          {icon}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h3 className="font-bold text-gray-900 mb-4">{title}</h3>
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
  const supabase = createClient()

  const set = (k: string, v: any) => setSettings((p: any) => ({ ...p, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('loyalty_settings')
      .upsert({ ...settings, merchant_id: merchantId }, { onConflict: 'merchant_id' })
    if (error) toast.error(error.message)
    else toast.success('Loyalty settings saved!')
    setSaving(false)
  }

  const tabs = [
    { key: 'overview',  label: '📊 Overview' },
    { key: 'members',   label: '👥 Members'  },
    { key: 'settings',  label: '⚙️ Settings' },
  ]

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className={cn('rounded-2xl px-5 py-3 flex items-center justify-between',
        settings.is_enabled ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200')}>
        <div className="flex items-center gap-2">
          <Star size={18} className={settings.is_enabled ? 'text-green-600' : 'text-gray-400'} />
          <span className="font-semibold text-sm text-gray-800">
            {settings.program_name ?? 'Loyalty Program'}
          </span>
          <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full',
            settings.is_enabled ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600')}>
            {settings.is_enabled ? 'Active' : 'Paused'}
          </span>
        </div>
        <Switch
          checked={!!settings.is_enabled}
          onCheckedChange={async (v) => {
            set('is_enabled', v)
            await supabase.from('loyalty_settings')
              .update({ is_enabled: v }).eq('merchant_id', merchantId)
            toast.success(v ? 'Loyalty program enabled' : 'Loyalty program paused')
          }}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard icon={<Users size={18} />}     label="Total Members"
              value={statsSummary.totalMembers.toLocaleString()} />
            <StatCard icon={<Star size={18} />}       label="Points Outstanding"
              value={statsSummary.totalOutstanding.toLocaleString()}
              sub={`≈ RM ${(statsSummary.totalOutstanding * (settings.rm_per_point ?? 0.01)).toFixed(2)} liability`} />
            <StatCard icon={<Award size={18} />}      label="Gold + Platinum"
              value={String(statsSummary.tierCounts.gold + statsSummary.tierCounts.platinum)}
              sub="High-value members" />
            <StatCard icon={<TrendingUp size={18} />} label="Earn Rate"
              value={`${settings.points_per_rm ?? 1} pt / RM1`} />
          </div>

          {/* Tier breakdown */}
          <Section title="Member Tier Breakdown">
            <div className="grid grid-cols-4 gap-3">
              {(['bronze', 'silver', 'gold', 'platinum'] as const).map(t => (
                <div key={t} className={cn('rounded-xl p-4 text-center', TIER_STYLES[t])}>
                  <p className="text-2xl mb-1">{TIER_EMOJI[t]}</p>
                  <p className="text-xl font-bold">{statsSummary.tierCounts[t]}</p>
                  <p className="text-xs font-semibold capitalize opacity-80">{t}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Recent activity */}
          <Section title="Recent Activity">
            <div className="space-y-0">
              {recentTransactions.slice(0, 10).map((txn, i) => (
                <div key={txn.id}
                  className={cn('flex items-center justify-between py-3',
                    i < 9 ? 'border-b border-gray-50' : '')}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm',
                      txn.type === 'earn' ? 'bg-green-100' : 'bg-orange-100')}>
                      {txn.type === 'earn' ? '⬆️' : '🎁'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {txn.profiles?.full_name ?? 'Customer'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {format(new Date(txn.created_at), 'd MMM, h:mm a')}
                      </p>
                    </div>
                  </div>
                  <span className={cn('text-sm font-bold',
                    txn.type === 'earn' ? 'text-green-600' : 'text-orange-500')}>
                    {txn.points_delta > 0 ? '+' : ''}{txn.points_delta.toLocaleString()} pts
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ── MEMBERS TAB ── */}
      {tab === 'members' && (
        <Section title={`${topCustomers.length} Members — Top by Spend`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50">
                  {['#', 'Member', 'Tier', 'Balance', 'Total Earned', 'Total Spent', 'Last Active'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-400 px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((c, i) => (
                  <tr key={c.customer_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-3 py-3 text-sm text-gray-400 font-mono">#{i + 1}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold">
                          {(c.profiles?.full_name ?? 'G').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{c.profiles?.full_name ?? 'Guest'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full capitalize',
                        TIER_STYLES[c.tier as keyof typeof TIER_STYLES])}>
                        {TIER_EMOJI[c.tier as keyof typeof TIER_EMOJI]} {c.tier}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm font-bold text-blue-600">
                      {Number(c.balance).toLocaleString()} pts
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">
                      {Number(c.total_earned).toLocaleString()} pts
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-gray-700">
                      RM {Number(c.total_spent_rm).toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-400">
                      {format(new Date(c.updated_at), 'd MMM')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ── SETTINGS TAB ── */}
      {tab === 'settings' && (
        <div className="max-w-lg space-y-4">
          <Section title="Program Identity">
            <div>
              <Label>Program Name</Label>
              <Input value={settings.program_name ?? ''} onChange={e => set('program_name', e.target.value)}
                placeholder="e.g. Star Rewards" />
            </div>
          </Section>

          <Section title="Earning Rules">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Points per RM1 spent</Label>
                <Input type="number" min="0.1" step="0.1" value={settings.points_per_rm ?? 1}
                  onChange={e => set('points_per_rm', e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">e.g. 1 = earn 1 pt per RM1</p>
              </div>
              <div>
                <Label>RM value per point</Label>
                <Input type="number" min="0.001" step="0.001" value={settings.rm_per_point ?? 0.01}
                  onChange={e => set('rm_per_point', e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">e.g. 0.01 = 100 pts = RM1</p>
              </div>
            </div>
          </Section>

          <Section title="Redemption Rules">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Minimum points to redeem</Label>
                <Input type="number" min="1" value={settings.min_redeem_points ?? 100}
                  onChange={e => set('min_redeem_points', e.target.value)} />
              </div>
              <div>
                <Label>Max % of order redeemable</Label>
                <Input type="number" min="1" max="100" value={settings.max_redeem_pct ?? 50}
                  onChange={e => set('max_redeem_pct', e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">e.g. 50 = max 50% discount from points</p>
              </div>
            </div>
          </Section>

          <Section title="Tier Thresholds (RM spent, cumulative)">
            <div className="grid grid-cols-3 gap-4">
              {[
                { key: 'tier_silver_rm',   label: '🥈 Silver from (RM)' },
                { key: 'tier_gold_rm',     label: '🥇 Gold from (RM)'   },
                { key: 'tier_platinum_rm', label: '💎 Platinum from (RM)'},
              ].map(({ key, label }) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Input type="number" min="1" value={settings[key] ?? ''}
                    onChange={e => set(key, e.target.value)} />
                </div>
              ))}
            </div>
          </Section>

          <Section title="Tier Multipliers (points earn multiplier)">
            <div className="grid grid-cols-3 gap-4">
              {[
                { key: 'tier_silver_multiplier',   label: '🥈 Silver ×' },
                { key: 'tier_gold_multiplier',     label: '🥇 Gold ×'   },
                { key: 'tier_platinum_multiplier', label: '💎 Platinum ×'},
              ].map(({ key, label }) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Input type="number" min="1" step="0.1" value={settings[key] ?? ''}
                    onChange={e => set(key, e.target.value)} />
                </div>
              ))}
            </div>
          </Section>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      )}
    </div>
  )
}
