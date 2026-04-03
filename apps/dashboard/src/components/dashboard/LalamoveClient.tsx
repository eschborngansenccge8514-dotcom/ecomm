'use client'
import { useState, useCallback, useEffect } from 'react'
import { useRouter }   from 'next/navigation'
import { Input }       from '@/components/ui/input'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn }          from '@/lib/utils'
import toast           from 'react-hot-toast'
import { format }      from 'date-fns'
import { 
  Zap, Truck, Bike, Clock, MapPin, User, Phone, Info, 
  AlertCircle, CheckCircle2, XCircle, Plus, ChevronRight, 
  ArrowLeft, RefreshCw, ExternalLink, Download, Search, Filter,
  History, Settings, BarChart3, Wallet, Activity, ClipboardList,
  Package
} from 'lucide-react'
import { useMonitoring, Order } from '@/hooks/useMonitoring'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getLalamoveStatus, SERVICE_TYPE_LABELS, LALAMOVE_STAGES } from '@/lib/lalamove'

const rm = (v: any) => `RM ${Number(v ?? 0).toFixed(2)}`

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'active',   icon: <Activity size={14}/>,      label: 'Active Deliveries' },
  { id: 'history',  icon: <History size={14}/>,       label: 'Order History'     },
  { id: 'overview', icon: <BarChart3 size={14}/>,     label: 'Performance'      },
  { id: 'logs',     icon: <ClipboardList size={14}/>, label: 'API Logs'          },
]

// ─── Driver Card ──────────────────────────────────────────────────────────────
function DriverCard({ order }: { order: Order }) {
  if (!order.driver_name) return (
    <div className="bg-amber-50/50 rounded-2xl p-4 flex items-center justify-between border border-dashed border-amber-200 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
          <User size={18} className="text-amber-400" />
        </div>
        <div>
          <p className="text-xs font-bold text-amber-900">Finding driver...</p>
          <p className="text-[10px] text-amber-600 font-medium">Broadcasted to nearby riders</p>
        </div>
      </div>
      <RefreshCw size={14} className="text-amber-400 animate-spin" />
    </div>
  )

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col gap-4 group hover:border-blue-200 transition-all">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner shrink-0 overflow-hidden relative">
          {order.driver_photo_url ? (
            <img src={order.driver_photo_url} alt={order.driver_name} className="w-full h-full object-cover" />
          ) : (
            <User size={24} className="text-gray-300" />
          )}
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-black text-gray-900 truncate">{order.driver_name}</p>
            <Badge variant="outline" className="text-[9px] font-bold border-blue-100 text-blue-600 bg-blue-50/50 px-1.5 py-0">
              Verified
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded uppercase tracking-tight">
              {order.driver_plate || 'No Plate'}
            </span>
            <a href={`tel:${order.driver_phone}`} className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center text-green-600 hover:bg-green-100 transition-colors">
              <Phone size={12} fill="currentColor" />
            </a>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Vehicle</p>
          <p className="text-[11px] font-black text-gray-900 mt-0.5">Instant</p>
        </div>
      </div>

      {order.delivery_tracking_url && (
        <a 
          href={order.delivery_tracking_url} 
          target="_blank" 
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            "w-full rounded-xl h-9 text-[11px] font-bold border-blue-100 text-blue-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 group-hover:shadow-sm transition-all"
          )}
        >
          <MapPin size={12} className="mr-2" /> Live Tracking
        </a>
      )}
    </div>
  )
}

// ─── Order Progress Bar ───────────────────────────────────────────────────────
function OrderProgressBar({ currentStage }: { currentStage: number }) {
  if (currentStage < 0) return null // Cancelled or Failed

  return (
    <div className="py-4 px-1">
      <div className="relative flex justify-between">
        {/* Background Line */}
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-100 -translate-y-1/2 rounded-full" />
        
        {/* Progress Line */}
        <div 
          className="absolute top-1/2 left-0 h-0.5 bg-orange-500 -translate-y-1/2 rounded-full transition-all duration-700 ease-in-out shadow-[0_0_8px_rgba(249,115,22,0.4)]" 
          style={{ width: `${(currentStage / (LALAMOVE_STAGES.length - 1)) * 100}%` }}
        />

        {LALAMOVE_STAGES.map((stage, idx) => {
          const isActive = idx <= currentStage
          const isCurrent = idx === currentStage
          
          return (
            <div key={stage.id} className="relative flex flex-col items-center">
              <div 
                className={cn(
                  "w-3.5 h-3.5 rounded-full border-2 transition-all duration-500 z-10 bg-white",
                  isActive ? "border-orange-500 bg-orange-500" : "border-gray-200",
                  isCurrent && "scale-125 ring-4 ring-orange-100 ring-offset-2 ring-offset-white"
                )}
              />
              <span className={cn(
                "absolute top-6 text-[9px] font-bold whitespace-nowrap tracking-tighter uppercase transition-all duration-500",
                isCurrent ? "text-orange-600 scale-110" : isActive ? "text-gray-900" : "text-gray-300"
              )}>
                {stage.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Client Component ────────────────────────────────────────────────────
export function LalamoveClient({ 
  merchantId, 
  merchant, 
  initialConfig, 
  initialOrders, 
  initialLogs 
}: {
  merchantId: string
  merchant: any
  initialConfig: any
  initialOrders: any[]
  initialLogs: any[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState('active')
  const [config] = useState(initialConfig)
  const [logs] = useState(initialLogs)
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null)

  const { 
    orders: monitoredOrders, 
    deliveryEvents, 
    loading: monitoringLoading,
    refresh: refreshMonitoring 
  } = useMonitoring(merchantId)

  // Filter orders for Lalamove (excluding not_requested)
  const lalamoveOrders = monitoredOrders.filter(o => 
    o.delivery_provider === 'lalamove' && 
    o.delivery_status !== 'not_requested'
  )
  
  const activeOrders = lalamoveOrders.filter(o => 
    !['delivered', 'cancelled', 'failed', 'completed'].includes(o.delivery_status?.toLowerCase())
  )
  
  const completedOrders = lalamoveOrders.filter(o => 
    ['delivered', 'completed'].includes(o.delivery_status?.toLowerCase())
  )

  const cancelledOrders = lalamoveOrders.filter(o => 
    ['cancelled', 'failed'].includes(o.delivery_status?.toLowerCase())
  )

  // Action: Cancel Order
  const cancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this Lalamove delivery?')) return
    setIsActionLoading(orderId)
    try {
      const res = await fetch('/api/lalamove/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, merchantId })
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('Delivery cancelled successfully')
      refreshMonitoring()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsActionLoading(null)
    }
  }

  // Action: Add Priority Fee
  const addPriorityFee = async (orderId: string) => {
    const fee = prompt('Enter priority fee amount (RM):', '2.00')
    if (fee === null) return
    const amount = parseFloat(fee)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid amount')
      return
    }

    setIsActionLoading(orderId)
    try {
      const res = await fetch('/api/lalamove/add-priority-fee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, merchantId, priorityFee: amount })
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(`Priority fee of RM ${amount.toFixed(2)} added`)
      refreshMonitoring()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsActionLoading(null)
    }
  }

  // Action: Retry Order
  const retryOrder = async (orderId: string) => {
    setIsActionLoading(orderId)
    try {
      const res = await fetch('/api/lalamove/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, merchantId })
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('Retry attempt initiated')
      refreshMonitoring()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsActionLoading(null)
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50/50">
      {/* Header Area */}
      <div className="bg-white border-b border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white">
                  <Zap size={18} fill="currentColor" />
               </div>
               <h1 className="text-2xl font-bold text-gray-900">Lalamove Dashboard</h1>
            </div>
            <p className="text-gray-500 text-sm mt-0.5">Instant hyperlocal delivery management</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-3 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                <Activity size={20} />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Orders</p>
                <p className="text-lg font-black text-gray-900 -mt-0.5">{activeOrders.length}</p>
              </div>
              <button onClick={refreshMonitoring} disabled={monitoringLoading} className="text-gray-300 hover:text-orange-600 ml-1">
                <RefreshCw size={14} className={monitoringLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all outline-none',
                tab === t.id ? 'bg-orange-600 text-white shadow-lg shadow-orange-200' : 'text-gray-500 hover:bg-gray-50')}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 overflow-y-auto">
        {!config && (
          <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 mb-8 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-amber-600 shadow-sm shrink-0">
              <AlertCircle size={24} />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-amber-900">Lalamove Not Configured</h4>
              <p className="text-amber-700 text-sm">Please set up your Lalamove account in settings to start using instant delivery.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push('/settings')} className="bg-white border-amber-200 hover:bg-amber-100 text-amber-700">
              Go to Settings
            </Button>
          </div>
        )}

        {tab === 'active' && (
          <div className="space-y-6">
            {activeOrders.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeOrders.map(order => {
                  const status = getLalamoveStatus(order.delivery_status)
                  return (
                    <Card key={order.id} className="rounded-[40px] border-gray-100 shadow-sm overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-white group">
                      <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-5 px-8 flex flex-row items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Order ID</p>
                          </div>
                          <p className="text-sm font-black text-gray-900 mt-0.5">#{order.order_number}</p>
                        </div>
                        <Badge className={cn("text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-sm", status.bg, status.color)}>
                          {status.label}
                        </Badge>
                      </CardHeader>
                      <CardContent className="p-8 space-y-8">
                        <div className="space-y-6">
                           <OrderProgressBar currentStage={status.stage} />
                           
                           <div className="pt-2">
                             <DriverCard order={order} />
                           </div>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="flex items-start gap-4 p-4 bg-gray-50/80 rounded-[24px] border border-gray-100/50">
                              <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-sm">
                                <MapPin size={18} className="text-orange-500" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Delivery Destination</p>
                                <p className="text-xs text-gray-700 font-bold leading-relaxed mt-0.5">{order.delivery_address?.line1 || order.delivery_address?.address || 'No address provided'}</p>
                                <p className="text-[10px] text-gray-400 font-medium truncate">{[order.delivery_address?.city, order.delivery_address?.state].filter(Boolean).join(', ')}</p>
                              </div>
                            </div>
                          
                          <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                                <Wallet size={14} />
                              </div>
                              <div>
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Delivery Fee</p>
                                <p className="text-sm font-black text-gray-900">{rm(order.delivery_fee)}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Placed On</p>
                              <p className="text-xs font-bold text-gray-700">{format(new Date(order.created_at), 'MMM d, h:mm a')}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                           <Button 
                             size="sm" 
                             variant="outline" 
                             onClick={() => addPriorityFee(order.id)}
                             disabled={!!isActionLoading}
                             className="flex-1 rounded-2xl text-xs font-bold h-11 border-gray-100 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 transition-all shadow-sm active:scale-95"
                           >
                             <Plus size={16} className="mr-2" /> Add Fee
                           </Button>
                           <Button 
                             size="sm" 
                             variant="outline" 
                             onClick={() => cancelOrder(order.id)}
                             disabled={!!isActionLoading}
                             className="rounded-2xl w-14 h-11 text-rose-600 border-rose-50 hover:bg-rose-50 hover:border-rose-100 transition-all shadow-sm active:scale-95"
                           >
                             <XCircle size={18} />
                           </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <div className="bg-white rounded-[32px] border border-dashed border-gray-200 py-20 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                  <Truck size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">No Active Deliveries</h3>
                <p className="text-gray-500 text-sm mt-1 max-w-xs mx-auto">Active Lalamove deliveries will appear here for real-time monitoring and driver tracking.</p>
              </div>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Lalamove Order History</h3>
                <div className="flex items-center gap-2">
                   <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input placeholder="Search orders..." className="pl-9 h-9 text-xs rounded-xl border-gray-200 w-64" />
                   </div>
                   <Button variant="outline" size="sm" className="h-9 rounded-xl border-gray-200">
                      <Filter size={14} className="mr-1.5" /> Filter
                   </Button>
                </div>
             </div>
             
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead>
                      <tr className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                         <th className="px-6 py-4">Order</th>
                         <th className="px-6 py-4">Customer</th>
                         <th className="px-6 py-4">Status</th>
                         <th className="px-6 py-4">Fulfillment</th>
                         <th className="px-6 py-4">Total</th>
                         <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50">
                      {lalamoveOrders.map(order => {
                        const status = getLalamoveStatus(order.delivery_status)
                        return (
                          <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                             <td className="px-6 py-4">
                                <p className="text-sm font-bold text-gray-900">#{order.order_number}</p>
                                <p className="text-[10px] text-gray-400 font-medium">{format(new Date(order.created_at), 'MMM d, yyyy')}</p>
                             </td>
                             <td className="px-6 py-4">
                                <p className="text-sm font-semibold text-gray-700">{order.buyer_name || 'Walk-in Customer'}</p>
                                <p className="text-[10px] text-gray-400 font-medium">Lalamove: {order.lalamove_order_id || 'Pending'}</p>
                             </td>
                             <td className="px-6 py-4">
                                <Badge className={cn("text-[10px] font-black uppercase px-2 py-0.5", status.bg, status.color)}>
                                  {status.label}
                                </Badge>
                             </td>
                             <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <Truck size={14} className="text-gray-400" />
                                  <div>
                                    <p className="text-xs font-semibold text-gray-700">Hyperlocal</p>
                                    <p className="text-[10px] text-gray-400 font-medium">Standard Instant</p>
                                  </div>
                                </div>
                             </td>
                             <td className="px-6 py-4 font-bold text-gray-900 text-sm">
                                {rm(order.total_amount)}
                             </td>
                             <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                   {order.delivery_status === 'failed' && (
                                     <Button size="sm" variant="outline" onClick={() => retryOrder(order.id)} className="rounded-lg h-7 px-2 text-[10px] border-orange-200 text-orange-600 hover:bg-orange-50">
                                       Retry
                                     </Button>
                                   )}
                                   <Button variant="ghost" size="sm" onClick={() => router.push(`/orders/${order.id}`)} className="rounded-lg h-8 w-8 p-0 text-gray-400 hover:text-blue-600">
                                      <ExternalLink size={14} />
                                   </Button>
                                </div>
                             </td>
                          </tr>
                        )
                      })}
                      {lalamoveOrders.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-20 text-center text-gray-400 text-sm italic">
                            No order history found for Lalamove.
                          </td>
                        </tr>
                      )}
                   </tbody>
                </table>
             </div>
          </div>
        )}

        {tab === 'overview' && (
          <div className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Deliveries', value: lalamoveOrders.length, icon: <Package size={18}/>, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Completion Rate', value: `${lalamoveOrders.length > 0 ? Math.round((completedOrders.length / lalamoveOrders.length) * 100) : 0}%`, icon: <CheckCircle2 size={18}/>, color: 'text-green-600', bg: 'bg-green-50' },
                  { label: 'Total Spend', value: rm(lalamoveOrders.reduce((acc, o) => acc + Number(o.delivery_fee || 0), 0)), icon: <Wallet size={18}/>, color: 'text-orange-600', bg: 'bg-orange-50' },
                  { label: 'Avg Distance', value: '4.2 km', icon: <MapPin size={18}/>, color: 'text-purple-600', bg: 'bg-purple-50' },
                ].map((stat, i) => (
                  <Card key={i} className="rounded-3xl border-gray-100 shadow-sm">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", stat.bg, stat.color)}>
                          {stat.icon}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
                          <p className="text-xl font-black text-gray-900 leading-tight">{stat.value}</p>
                        </div>
                    </CardContent>
                  </Card>
                ))}
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="rounded-[32px] border-gray-100 shadow-sm overflow-hidden">
                   <CardHeader className="py-4 px-6 border-b border-gray-50 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-bold">Delivery Status Distribution</CardTitle>
                      <Badge variant="outline" className="text-[10px] font-bold">Lifetime</Badge>
                   </CardHeader>
                   <CardContent className="p-6">
                      <div className="space-y-4">
                        {[
                          { label: 'Completed', count: completedOrders.length, color: 'bg-green-500', pct: lalamoveOrders.length > 0 ? (completedOrders.length / lalamoveOrders.length) * 100 : 0 },
                          { label: 'Active', count: activeOrders.length, color: 'bg-blue-500', pct: lalamoveOrders.length > 0 ? (activeOrders.length / lalamoveOrders.length) * 100 : 0 },
                          { label: 'Cancelled', count: cancelledOrders.length, color: 'bg-red-500', pct: lalamoveOrders.length > 0 ? (cancelledOrders.length / lalamoveOrders.length) * 100 : 0 },
                        ].map((item, i) => (
                          <div key={i} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                               <span className="text-gray-600">{item.label}</span>
                               <span className="text-gray-900">{item.count}</span>
                            </div>
                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                               <div className={cn("h-full rounded-full transition-all duration-500", item.color)} style={{ width: `${item.pct}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                   </CardContent>
                </Card>

                <Card className="rounded-[32px] border-gray-100 shadow-sm overflow-hidden">
                   <CardHeader className="py-4 px-6 border-b border-gray-50">
                      <CardTitle className="text-sm font-bold">Recent Lalamove Activity</CardTitle>
                   </CardHeader>
                   <CardContent className="p-0 max-h-[300px] overflow-y-auto">
                      <div className="p-6">
                        {deliveryEvents.filter(e => e.provider === 'lalamove').length > 0 ? (
                          <div className="space-y-6 relative before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
                             {deliveryEvents.filter(e => e.provider === 'lalamove').slice(0, 10).map((event, i) => (
                               <div key={event.id} className="relative pl-8 group">
                                  <div className={cn(
                                    "absolute left-0 top-1.5 w-5 h-5 rounded-full border-4 border-white shadow-sm ring-1 ring-gray-100 transition-transform group-hover:scale-110",
                                    i === 0 ? "bg-orange-600" : "bg-gray-300"
                                  )} />
                                  <div className="flex items-start justify-between gap-4">
                                     <div>
                                        <p className="text-sm font-bold text-gray-900 capitalize">{(event.event_type || 'Update').replace(/_/g, ' ')}</p>
                                        <p className="text-xs text-gray-400 font-medium">
                                          <Clock size={12} className="inline mr-1" /> {format(new Date(event.created_at), 'MMM d, h:mm a')}
                                        </p>
                                     </div>
                                     <Badge variant="outline" className="text-[10px] font-bold border-gray-100">
                                        {monitoredOrders.find(o => o.id === event.order_id)?.order_number || 'Parcel'}
                                     </Badge>
                                  </div>
                               </div>
                             ))}
                          </div>
                        ) : (
                          <div className="text-center py-10">
                            <Clock size={32} className="mx-auto text-gray-200 mb-2" />
                            <p className="text-xs text-gray-400">No recent activity logs.</p>
                          </div>
                        )}
                      </div>
                   </CardContent>
                </Card>
             </div>
          </div>
        )}

        {tab === 'logs' && (
          <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Lalamove API Communication Logs</h3>
                <Button variant="ghost" size="sm" onClick={() => router.refresh()} className="text-xs text-gray-400 hover:text-gray-900">
                   <RefreshCw size={14} className="mr-1.5" /> Refresh
                </Button>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead>
                      <tr className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                         <th className="px-6 py-4">Timestamp</th>
                         <th className="px-6 py-4">Method / Endpoint</th>
                         <th className="px-6 py-4">Status</th>
                         <th className="px-6 py-4">Order ID</th>
                         <th className="px-6 py-4 text-right">Details</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50">
                      {logs.map(log => (
                        <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                           <td className="px-6 py-4 text-xs font-medium text-gray-500">
                              {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                           </td>
                           <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "text-[10px] font-bold px-1.5 py-0.5 rounded",
                                  log.method === 'POST' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                                )}>{log.method}</span>
                                <span className="text-xs font-mono text-gray-600">{log.endpoint}</span>
                              </div>
                           </td>
                           <td className="px-6 py-4">
                              <Badge className={cn(
                                "text-[10px] font-black",
                                log.status_code >= 200 && log.status_code < 300 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              )}>
                                {log.status_code}
                              </Badge>
                           </td>
                           <td className="px-6 py-4 text-xs font-mono text-gray-400">
                              {monitoredOrders.find(o => o.id === log.order_id)?.order_number || log.order_id?.substring(0, 8)}
                           </td>
                           <td className="px-6 py-4 text-right">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-gray-900">
                                 <Info size={14} />
                              </Button>
                           </td>
                        </tr>
                      ))}
                      {logs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-20 text-center text-gray-400 text-sm italic">
                            No API logs found.
                          </td>
                        </tr>
                      )}
                   </tbody>
                </table>
             </div>
          </div>
        )}
      </div>
    </div>
  )
}
