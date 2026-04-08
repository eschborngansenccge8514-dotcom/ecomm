'use client'
import dynamic from 'next/dynamic'
import { format } from 'date-fns'
import { 
  ShoppingBag, 
  Calendar, 
  Mail, 
  Phone, 
  Star, 
  TrendingUp, 
  Clock, 
  ArrowRight,
  User,
  CreditCard,
  History,
  Zap,
  Target,
  Heart,
  Crown,
  ShieldCheck,
  Package
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const AreaChart = dynamic(() => import('recharts').then(mod => mod.AreaChart), { ssr: false })
const Area = dynamic(() => import('recharts').then(mod => mod.Area), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false })

interface CustomerDetailsViewProps {
  customer: any
  onEdit: (customer: any) => void
  timeline: any[]
  loadingTimeline: boolean
}

export function CustomerDetailsView({ customer, onEdit, timeline, loadingTimeline }: CustomerDetailsViewProps) {
  if (!customer) return null

  const rm = (v: number) => `RM ${Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  
  // Mock trend data for visualization
  const trendData = [
    { name: 'Jan', value: 400 },
    { name: 'Feb', value: 300 },
    { name: 'Mar', value: 600 },
    { name: 'Apr', value: 800 },
    { name: 'May', value: 500 },
    { name: 'Jun', value: 900 },
  ]

  return (
    <div className="flex flex-col space-y-10 pb-20 animate-in fade-in duration-700">
      {/* ── Profile Hero Section ────────────────────────────────────────── */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent rounded-[48px] -m-4" />
        
        <div className="relative flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-violet-600 rounded-[40px] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
            <div className="relative w-32 h-32 rounded-[36px] bg-slate-900 border-4 border-white flex items-center justify-center text-white text-4xl font-black shadow-2xl">
              {customer.full_name?.charAt(0).toUpperCase() || 'U'}
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-amber-400 rounded-2xl border-4 border-white flex items-center justify-center text-slate-900 shadow-lg">
                <Crown size={18} />
              </div>
            </div>
          </div>
          
          <div className="flex-1 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 justify-center md:justify-start">
                  <h2 className="text-4xl font-black text-gray-900 tracking-tight">{customer.full_name}</h2>
                  <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 px-3 py-1 font-black text-[10px] uppercase tracking-widest">Verified</Badge>
                </div>
                <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-[10px] mt-2">Member Performance • ID {customer.id.slice(0, 8)}</p>
              </div>
              
              <div className="flex items-center gap-2 justify-center">
                <Button 
                  onClick={() => onEdit(customer)}
                  variant="outline"
                  className="h-12 px-6 rounded-2xl border-gray-200 font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all shadow-sm"
                >
                  Edit Profile
                </Button>
                <Button 
                  className="h-12 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-blue-200"
                >
                  Send Rewards
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 justify-center md:justify-start text-sm">
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-100 shadow-sm transition-all hover:border-blue-200 group">
                <Mail size={14} className="text-blue-500 transition-transform group-hover:scale-110" />
                <span className="font-bold text-gray-600">{customer.email}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-100 shadow-sm transition-all hover:border-emerald-200 group">
                <Phone size={14} className="text-emerald-500 transition-transform group-hover:scale-110" />
                <span className="font-bold text-gray-600">{customer.phone || 'No phone'}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-100 shadow-sm">
                <Calendar size={14} className="text-amber-500" />
                <span className="font-bold text-gray-600">Joined {format(new Date(customer.created_at), 'MMM yyyy')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Key Performance Matrix ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { label: 'Lifetime Value', value: rm(customer.lifetime_value), sub: 'Overall Revenue', icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: '+12%' },
          { label: 'Order Frequency', value: `${customer.orders_count || 0} Orders`, sub: 'Purchase Cycle', icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50', trend: '+2' },
          { label: 'Avg Basket Size', value: rm(Number(customer.lifetime_value) / (Number(customer.orders_count) || 1)), sub: 'Spend Velocity', icon: Target, color: 'text-violet-600', bg: 'bg-violet-50', trend: 'High' },
        ].map((stat, i) => (
          <div key={i} className="relative group overflow-hidden bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm transition-all hover:shadow-2xl hover:shadow-gray-200/50 hover:border-blue-100/50">
            <div className={cn("absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-5 group-hover:scale-125 transition-transform duration-700", stat.bg)} />
            <div className="relative flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", stat.bg, stat.color)}>
                  <stat.icon size={22} />
                </div>
                <Badge className={cn("font-black text-[9px] px-2 py-0.5 rounded-lg", stat.bg, stat.color)}>{stat.trend}</Badge>
              </div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-2xl font-black text-gray-900 tracking-tight">{stat.value}</p>
              <p className="text-[10px] font-bold text-gray-400 mt-2 flex items-center gap-1"><Zap size={10} className="text-amber-400" /> {stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-8">
        {/* ── Detailed Activity Feed ──────────────────────────────────── */}
        <div className="space-y-6">
          <div className="bg-white rounded-[40px] border border-gray-100 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-500 shadow-inner">
                  <History size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 tracking-tight">Activity Timeline</h3>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">Customer Journey</p>
                </div>
              </div>
              <Button variant="ghost" className="text-[10px] font-bold uppercase tracking-widest text-blue-600 hover:bg-blue-50 px-4 h-9 rounded-xl">View full log</Button>
            </div>

            <div className="space-y-10 relative">
              <div className="absolute left-[23px] top-2 bottom-2 w-px bg-gradient-to-b from-blue-500 via-gray-100 to-transparent" />
              
              {loadingTimeline ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-4">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Loading history...</p>
                </div>
              ) : timeline && timeline.length > 0 ? (
                timeline.map((item, idx) => {
                  const IconMap: Record<string, any> = {
                    'Package': Package,
                    'Star': Star,
                    'Zap': Zap,
                    'ShieldCheck': ShieldCheck,
                    'Mail': Mail
                  }
                  const Icon = IconMap[item.event_icon as string] || History

                  return (
                    <div key={idx} className="relative flex gap-6 items-start group">
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg relative z-10 transition-all group-hover:scale-110", item.event_color || 'bg-gray-400')}>
                        <Icon size={20} />
                      </div>
                      <div className="flex-1 pt-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-black text-gray-400 uppercase tracking-widest italic">
                            {format(new Date(item.event_date), 'd MMM yyyy, h:mm a')}
                          </p>
                          <Badge variant="outline" className="text-[9px] font-black uppercase opacity-60 rounded-lg">{item.event_type}</Badge>
                        </div>
                        <h4 className="font-black text-gray-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{item.event_title}</h4>
                        <p className="text-sm text-gray-500 font-medium mt-1 leading-relaxed opacity-80">{item.event_desc}</p>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="py-10 text-center">
                  <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">No activity found</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Luxury Loyalty Panel ────────────────────────────────────── */}
        <div className="space-y-8">
          <div className="bg-slate-900 rounded-[48px] p-10 text-white shadow-2xl relative overflow-hidden group min-h-[500px] flex flex-col">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -mr-32 -mt-32 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/10 rounded-full -ml-32 -mb-32 blur-3xl opacity-50" />
            
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center justify-between mb-12">
                <div className="w-14 h-14 bg-white/10 rounded-[20px] backdrop-blur-md border border-white/10 flex items-center justify-center text-amber-400">
                  <Heart size={28} className="fill-amber-400 animate-pulse" />
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black tracking-[0.2em] text-blue-400 uppercase">Loyalty Status</p>
                  <p className="text-2xl font-black italic tracking-tighter">PLATINUM</p>
                </div>
              </div>

              <div className="space-y-10 flex-1">
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">Spending Trend</p>
                    <p className="text-xs font-black text-emerald-400">+24% vs Last Mo</p>
                  </div>
                  <div className="h-[120px] w-full bg-white/5 rounded-3xl p-4 backdrop-blur-sm border border-white/5">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="popChart" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fill="url(#popChart)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 bg-white/5 rounded-[32px] border border-white/10 backdrop-blur-md">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Available</p>
                    <p className="text-3xl font-black tracking-tight">12.4K</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">Reward Points</p>
                  </div>
                  <div className="p-6 bg-white/5 rounded-[32px] border border-white/10 backdrop-blur-md">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Redeemed</p>
                    <p className="text-3xl font-black tracking-tight text-white/50">2.1K</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">Lifetime</p>
                  </div>
                </div>
              </div>

              <Button className="w-full bg-white text-slate-900 hover:bg-blue-50 h-16 rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 mt-10">
                Grant Custom Reward <Zap size={16} className="ml-2 text-amber-500" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

