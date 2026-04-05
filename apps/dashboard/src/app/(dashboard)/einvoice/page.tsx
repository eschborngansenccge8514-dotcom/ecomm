'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  BarChart3, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  TrendingUp, 
  AlertCircle,
  FileText,
  Search,
  Filter,
  ArrowUpRight,
  RefreshCw,
  ChevronRight
} from 'lucide-react'
import { ComplianceStatusBanner } from '@/components/einvoice/ComplianceStatusBanner'
import { KPICard } from '@/components/einvoice/KPICard'
import { ActionRequired, EinvoiceTask } from '@/components/einvoice/ActionRequired'
import { StatusBadge } from '@/components/einvoice/StatusBadge'
import { createClient } from '@/lib/supabase/client'
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts'
import { format, subDays, startOfDay } from 'date-fns'

export default function EinvoiceDashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({
    submitted: 0,
    validated: 0,
    pending: 0,
    failed: 0,
    complianceRate: 100,
  })
  const [recentInvoices, setRecentInvoices] = useState<any[]>([])
  const [chartData, setChartData] = useState<any[]>([])
  const [tasks, setTasks] = useState<EinvoiceTask[]>([])

  useEffect(() => {
    async function initDashboard() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!merchant) return

      // Check onboarding
      const { data: config } = await supabase
        .from('merchant_einvoice_config')
        .select('onboarding_completed_at')
        .eq('merchant_id', merchant.id)
        .single()

      if (!config?.onboarding_completed_at) {
        router.push('/einvoice/setup')
        return
      }

      // Fetch Metrics
      const { data: invoices } = await supabase
        .from('einvoices')
        .select('*')
        .eq('merchant_id', merchant.id)
        .order('created_at', { ascending: false })

      // Fetch Pending Orders (Requests)
      const { data: pendingOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('merchant_id', merchant.id)
        .eq('payment_status', 'paid')
        .not('status', 'in', '("cancelled","refunded")')
        .eq('einvoice_status', 'pending_buyer_request')

      if (invoices) {
         const validated = invoices.filter(i => ['validated', 'valid'].includes(i.status?.toLowerCase())).length
         const failed = invoices.filter(i => ['invalid', 'rejected', 'failed', 'error'].includes(i.status?.toLowerCase())).length
         const processing = invoices.filter(i => ['submitted', 'pending'].includes(i.status?.toLowerCase())).length
         const requests = pendingOrders?.length || 0
         
         setMetrics({
           submitted: invoices.length,
           validated,
           pending: processing + requests, // Combined processing submissions and new requests
           failed,
           complianceRate: invoices.length > 0 ? (validated / invoices.length) * 100 : 100
         })

         setRecentInvoices(invoices.slice(0, 10))

         // Prepare Chart Data (Last 14 days)
         const last14Days = Array.from({length: 14}).map((_, i) => {
            const date = subDays(new Date(), i)
            const dateStr = format(date, 'MMM d')
            const dayInvoices = invoices.filter(inv => {
               const invDate = new Date(inv.created_at)
               return startOfDay(invDate).getTime() === startOfDay(date).getTime()
            })
            return {
               name: dateStr,
               validated: dayInvoices.filter(d => d.status === 'validated').length,
               pending: dayInvoices.filter(d => ['submitted', 'pending'].includes(d.status)).length,
               failed: dayInvoices.filter(d => ['invalid', 'rejected', 'failed'].includes(d.status)).length
            }
         }).reverse()
         
         setChartData(last14Days)

         // Generate Tasks
         const newTasks: EinvoiceTask[] = []
         
         if (requests > 0) {
            newTasks.push({
               id: 'pending-requests',
               type: 'warning',
               title: `${requests} Pending E-Invoice Requests`,
               description: 'Customers have paid but e-invoices are not yet issued. Review and submit now.',
               actionLabel: 'Review Requests',
               onAction: () => router.push('/einvoice/invoices?tab=requested')
            })
         }

         if (failed > 0) {
            newTasks.push({
               id: 'failed-invoices',
               type: 'error',
               title: `${failed} Invoices Failed Validation`,
               description: 'LHDN rejected some submissions due to TIN mismatch or formatting errors.',
               actionLabel: 'Review Now',
               onAction: () => router.push('/einvoice/invoices?status=failed')
            })
         }
         
         // Add dummy deadline info
         newTasks.push({
            id: 'deadline-info',
            type: 'info',
            title: 'Phase 4 Enforcement is 88 Days Away',
            description: 'Your mandatory deadline for RM1M+ revenue merchants is 1 January 2026.',
            actionLabel: 'Learn More',
            onAction: () => router.push('/einvoice/learn')
         })

         setTasks(newTasks)
      }
      setLoading(false)
    }

    initDashboard()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
         <div className="flex flex-col items-center gap-4">
            <RefreshCw className="animate-spin text-blue-600" size={32} />
            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Loading Command Center...</p>
         </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-700">
      <ComplianceStatusBanner 
        status={metrics.failed > 0 ? 'action_required' : 'compliant'} 
        nextDeadline="15 May 2026"
        onAction={() => metrics.failed > 0 ? router.push('/einvoice/invoices?tab=failed') : router.push('/einvoice/invoices')}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
         <KPICard 
           label="Submitted This Month" 
           value={metrics.submitted} 
           subtitle="Total Submissions" 
           icon={FileText} 
           variant="info"
         />
          <button onClick={() => router.push('/einvoice/invoices?tab=validated')} className="text-left transition-transform active:scale-95">
             <KPICard 
               label="Validated" 
               value={metrics.validated} 
               subtitle="Cleared by LHDN" 
               icon={CheckCircle2} 
               variant="success"
             />
          </button>
          <button onClick={() => router.push('/einvoice/invoices?tab=pending')} className="text-left transition-transform active:scale-95">
             <KPICard 
               label="Pending" 
               value={metrics.pending} 
               subtitle="Awaiting Response" 
               icon={Clock} 
               variant="warning"
              />
          </button>
          <button onClick={() => router.push('/einvoice/invoices?tab=failed')} className="text-left transition-transform active:scale-95">
             <KPICard 
               label="Failed" 
               value={metrics.failed} 
               subtitle="Needs Attention" 
               icon={XCircle} 
               variant="danger"
             />
          </button>
         <KPICard 
           label="Compliance Rate" 
           value={`${Math.round(metrics.complianceRate)}%`} 
           subtitle="Quality Score" 
           icon={TrendingUp} 
           trend={{ value: '2.5%', isUp: true }}
         />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Chart Section */}
         <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden">
               <div className="flex items-center justify-between mb-8 relative z-10">
                  <div className="space-y-1">
                     <h3 className="text-xl font-black text-gray-900 tracking-tight">Invoice Activity</h3>
                     <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Last 14 days submission volume</p>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        <span className="text-[10px] font-black text-gray-600 uppercase">Validated</span>
                     </div>
                  </div>
               </div>
               
               <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorValidated" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '16px', 
                          border: 'none', 
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="validated" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorValidated)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
               </div>
               
               <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                  <p className="text-[10px] font-bold text-gray-400 max-w-sm uppercase leading-relaxed">
                     Validated = Approved by LHDN. Use these as tax documents.
                  </p>
               </div>
            </div>

            {/* Recent Table */}
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
               <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">Recent Invoices</h3>
                  <button onClick={() => router.push('/einvoice/invoices')} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                     View All <ArrowUpRight size={14} />
                  </button>
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="bg-gray-50/50">
                           <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Invoice No.</th>
                           <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount (RM)</th>
                           <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                           <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50">
                        {recentInvoices.map((inv) => (
                          <tr key={inv.id} className="group hover:bg-gray-50/30 transition-colors">
                             <td className="px-6 py-4">
                                <div className="space-y-0.5">
                                   <div className="text-sm font-bold text-gray-900">#{inv.order_number || 'CONSOLIDATED'}</div>
                                   <div className="text-[10px] font-medium text-gray-400">{format(new Date(inv.created_at), 'MMM d, h:mm a')}</div>
                                </div>
                             </td>
                             <td className="px-6 py-4 font-black text-gray-900 text-sm">
                                {Number(inv.total_amount).toLocaleString('en-MY', { style: 'currency', currency: 'MYR' })}
                             </td>
                             <td className="px-6 py-4">
                                <StatusBadge status={inv.status} />
                             </td>
                             <td className="px-6 py-4">
                                <button 
                                  onClick={() => router.push(`/einvoice/invoices/${inv.id}`)}
                                  className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
                                >
                                   <ArrowUpRight size={18} />
                                </button>
                             </td>
                          </tr>
                        ))}
                        {recentInvoices.length === 0 && (
                           <tr>
                              <td colSpan={4} className="px-6 py-12 text-center text-gray-400 font-bold text-sm">
                                 No invoices submitted yet.
                              </td>
                           </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>

         {/* Sidebar with Tasks */}
         <div className="space-y-8">
            <ActionRequired tasks={tasks} />
            
            <div className="p-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] text-white space-y-4 shadow-xl shadow-indigo-100 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform duration-700">
                  <BarChart3 size={100} />
               </div>
               <h4 className="font-black text-lg tracking-tight leading-tight">Professional Support & Training</h4>
               <p className="text-xs text-indigo-100 font-medium leading-relaxed">
                  Join our weekly webinars to master the e-invoice cycle and learn how to reduce validation failures.
               </p>
               <button className="w-full bg-white text-indigo-600 py-3 rounded-xl font-bold text-xs hover:bg-indigo-50 transition-all flex items-center justify-center gap-2">
                  Register Now <ChevronRight size={14} />
               </button>
            </div>
         </div>
      </div>
    </div>
  )
}
