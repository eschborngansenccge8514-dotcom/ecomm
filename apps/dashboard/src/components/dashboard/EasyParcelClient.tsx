'use client'
import { useState, useCallback, useEffect } from 'react'
import { useRouter }   from 'next/navigation'
import { Input }       from '@/components/ui/input'
import { Button }      from '@/components/ui/button'
import { cn }          from '@/lib/utils'
import toast           from 'react-hot-toast'
import { format, addDays } from 'date-fns'
import { MY_STATE_OPTIONS, MY_STATES, shipStatusMeta, courierEmoji } from '@/lib/easyparcel'
import {
  Package, Truck, RefreshCw, Eye,
  ExternalLink, Download, CheckCircle2, XCircle, AlertCircle,
  Wallet, Loader2, Info, BarChart3, Clock,
  MapPin, ShieldCheck, Box, Zap
} from 'lucide-react'
import { useMonitoring } from '@/hooks/useMonitoring'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'


const rm = (v: any) => `RM ${Number(v ?? 0).toFixed(2)}`
const n  = (v: any) => Number(v ?? 0)

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id:'overview',  icon: <Package size={14}/>,    label:'Overview'       },
  { id:'shipments', icon: <CheckCircle2 size={14}/>,label:'Shipments'     },
]


// ─── Tracking modal ───────────────────────────────────────────────────────────
function TrackingModal({ shipment, merchantId, onClose }: {
  shipment: any; merchantId: string; onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [data,    setData]    = useState<any>(shipment.tracking_data)

  const refresh = async () => {
    setLoading(true)
    const res = await fetch('/api/easyparcel/track', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId, awbNumbers: [shipment.awb], shipmentId: shipment.id }),
    })
    const json = await res.json()
    if (json.result?.[0]) setData(json.result[0])
    else toast.error('Tracking not available yet')
    setLoading(false)
  }

  const statusList = data?.status_list
    ? Object.values(data.status_list)
        .filter((v: any) => v && typeof v === 'object' && v.event_date)
        .sort((a: any, b: any) => {
          const da = new Date(`${a.event_date} ${a.event_time || ''}`).getTime()
          const db = new Date(`${b.event_date} ${b.event_time || ''}`).getTime()
          return db - da // Latest first
        })
    : []

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
        <div className="bg-white border-b border-gray-100 px-8 py-8 relative overflow-hidden">
          <div className="relative z-10 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <Truck size={16} className="text-white" />
                </div>
                <p className="text-indigo-600 text-[10px] font-bold uppercase tracking-[0.2em]">Live Tracking</p>
              </div>
              <h3 className="text-2xl font-black text-gray-900 tracking-tight leading-none">Shipment Status</h3>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-gray-500 text-sm font-mono tracking-wider bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-200">{shipment.awb}</span>
                <button onClick={() => { navigator.clipboard.writeText(shipment.awb); toast.success('AWB Copied'); }} className="text-gray-400 hover:text-indigo-600 transition-colors">
                  <Download size={14} />
                </button>
              </div>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all flex items-center justify-center text-gray-400 text-xl font-bold border border-gray-100">×</button>
          </div>
        </div>

        <div className="px-8 py-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {data?.latest_status && (
            <Card className="rounded-2xl border-indigo-100 bg-indigo-50/30 p-6 mb-8 text-center relative overflow-hidden shadow-none">
              <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-[0.2em] mb-2">Current Milestones</p>
              <p className="font-bold text-gray-900 text-xl tracking-tight leading-tight">{data.latest_status}</p>
              {data.latest_update && (
                <div className="flex items-center justify-center gap-1.5 mt-3 text-[11px] text-indigo-500 font-bold w-fit mx-auto">
                  <Clock size={12} />
                  Updated {data.latest_update}
                </div>
              )}
            </Card>
          )}

          <div className="flex gap-4 mb-10 text-xs">
            <div className="flex-1 bg-gray-50/50 rounded-2xl p-4 border border-gray-100 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 left-0 w-1 h-full bg-gray-200" />
               <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1.5 ml-1">SENDER</p>
               <p className="text-gray-900 font-black truncate text-sm ml-1">{data?.status_list?.sender || shipment.pick_name}</p>
            </div>
            <div className="flex-1 bg-indigo-50/30 rounded-2xl p-4 border border-indigo-100/30 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 w-1 h-full bg-indigo-400" />
               <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mb-1.5 mr-1 text-right">RECEIVER</p>
               <p className="text-indigo-900 font-black truncate text-sm mr-1 text-right">{data?.status_list?.receiver || shipment.send_name}</p>
            </div>
          </div>

          {statusList.length > 0 ? (
            <div className="space-y-0 text-left px-2">
              {statusList.map((event: any, i: number) => (
                <div key={i} className="flex items-start gap-6 pb-10 relative group">
                  <div className="flex flex-col items-center shrink-0 mt-1">
                    <div className={cn('w-4 h-4 rounded-full border-4 ring-4 transition-all duration-500',
                      i === 0 ? 'bg-indigo-600 border-white ring-indigo-100 scale-125' : 'bg-gray-200 border-white ring-transparent group-hover:bg-gray-300')} />
                    {i < statusList.length - 1 && (
                      <div className="w-0.5 bg-gradient-to-b from-gray-200 to-gray-50 absolute top-6 bottom-0 left-[7.5px] rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className={cn('text-sm font-black tracking-tight transition-colors duration-300', 
                      i === 0 ? 'text-indigo-700' : 'text-gray-700 group-hover:text-gray-900')}>
                      {event.status || event.ep_status}
                    </p>
                    {event.location && (
                      <div className="flex items-center gap-1 text-[11px] text-gray-400 font-bold group-hover:text-gray-500 transition-colors">
                        <MapPin size={10} className="text-indigo-300" />
                        {event.location}
                      </div>
                    )}
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1 opacity-70">
                      {event.event_date} {event.event_time && `· ${event.event_time}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-gray-50/50 rounded-[2rem] border-2 border-dashed border-gray-200/50">
              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-gray-200/20">
                <Box size={32} className="text-gray-300" />
              </div>
              <h4 className="text-gray-900 font-black tracking-tight text-lg">Wating for Departure</h4>
              <p className="text-gray-400 text-sm font-medium mt-1 mb-8">No journey events recorded yet.</p>
              <Button size="lg" onClick={refresh} className="bg-indigo-600 hover:bg-indigo-700 rounded-2xl px-8 h-12 font-black uppercase tracking-widest text-[11px] shadow-xl shadow-indigo-100 border-none transition-all hover:scale-105 active:scale-95" disabled={loading}>
                {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : <RefreshCw size={16} className="mr-2" />}
                Pull Latest Status
              </Button>
            </div>
          )}
        </div>

        <div className="px-8 py-8 border-t border-gray-100 flex gap-4 bg-gray-50/30">
          {shipment.awb_id_link && shipment.awb && !shipment.awb.toLowerCase().includes('not available') && (
            <a href={shipment.awb_id_link} target="_blank"
              className="group flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-[0.15em] h-14 rounded-2xl transition-all shadow-xl shadow-indigo-100 hover:shadow-indigo-200 border-none hover:scale-[1.02] active:scale-[0.98]">
              <Download size={16} className="group-hover:-translate-y-0.5 transition-transform" /> Print Label
            </a>
          )}
          {shipment.tracking_url && (
            <a href={shipment.tracking_url} target="_blank"
              className="flex-1 flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-black uppercase tracking-[0.15em] h-14 rounded-2xl transition-all border border-gray-200 shadow-sm hover:scale-[1.02] active:scale-[0.98]">
              <ExternalLink size={16} /> Web Tracker
            </a>
          )}
        </div>
      </div>
    </div>
  )
}


// ─── Main component ───────────────────────────────────────────────────────────
export function EasyParcelClient({ merchantId, merchant, initialSettings, initialShipments, pendingOrders, hasGlobalKeys }: {
  merchantId: string; merchant: any
  initialSettings: any; initialShipments: any[]; pendingOrders: any[]
  hasGlobalKeys?: boolean
}) {
  const router   = useRouter()
  const [tab,       setTab]       = useState('overview')
  const [settings,  setSettings]  = useState(initialSettings)
  const [shipments, setShipments] = useState(initialShipments)
  const [balance,   setBalance]   = useState<string | null>(null)
  const [loadBal,   setLoadBal]   = useState(false)
  const [trackShip, setTrackShip] = useState<any | null>(null)
  const [shipFilter, setShipFilter] = useState('all')
  const [isSyncingAll, setIsSyncingAll] = useState(false)


  const hasKeys      = !!(settings?.api_key || hasGlobalKeys)
  const hasSender    = !!settings?.sender_postcode
  const isConfigured = hasKeys && hasSender

  const { 
    orders: monitoredOrders, 
    deliveryEvents, 
    loading: monitoringLoading,
    refresh: refreshMonitoring 
  } = useMonitoring(merchantId)

  // Merge initial shipments with monitored orders for real-time status
  useEffect(() => {
    if (monitoredOrders.length > 0) {
      setShipments(prev => prev.map(s => {
        const match = monitoredOrders.find(o => o.order_number === s.reference || o.tracking_number === s.awb)
        if (match) {
          return {
            ...s,
            ship_status: match.delivery_status || s.ship_status,
            order_status: match.status || s.order_status,
            awb: match.tracking_number || s.awb
          }
        }
        return s
      }))
    }
  }, [monitoredOrders])

  useEffect(() => {
    if (isConfigured) {
      fetchBalance()
      refreshMonitoring()
    }
  }, [isConfigured, refreshMonitoring])


  const fetchBalance = async () => {
    setLoadBal(true)
    const res = await fetch('/api/easyparcel/balance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId }),
    })
    const json = await res.json()
    if (json.api_status === 'Success') setBalance(json.result)
    setLoadBal(false)
  }


  const [syncingOrder, setSyncingOrder] = useState<string | null>(null)
  const refreshOrderStatus = async (shipment: any) => {
    setSyncingOrder(shipment.id)
    try {
      const res = await fetch('/api/easyparcel/order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId,
          orderNumbers: [shipment.ep_order_number],
          shipmentIds:  [shipment.id],
        }),
      })
      const json = await res.json()
      if (json.api_status === 'Success') {
        const newStatus = json.result?.[0]?.order_status
        setShipments(prev => prev.map(s => s.id === shipment.id ? { ...s, order_status: newStatus } : s))
        toast.success(`Order ${shipment.reference} status: ${newStatus}`)
      } else {
        toast.error(json.error_remark || 'Failed to sync order status')
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSyncingOrder(null)
    }
  }

  const [syncingShip, setSyncingShip] = useState<string | null>(null)
  const refreshShipStatus = async (shipment: any) => {
    setSyncingShip(shipment.id)
    try {
      const res = await fetch('/api/easyparcel/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId,
          orderNumbers: [shipment.ep_order_number],
          shipmentIds:  [shipment.id],
        }),
      })
      const json = await res.json()
      if (json.api_status === 'Success') {
        const parcel = json.result?.[0]?.parcel?.[0]
        if (parcel) {
          setShipments(prev => prev.map(s => s.id === shipment.id ? { 
            ...s, 
            ship_status: parcel.ship_status,
            awb: parcel.awb,
            awb_id_link: parcel.awb_id_link
          } : s))
          toast.success(`Shipment ${shipment.reference} status: ${parcel.ship_status}`)
        }
      } else {
        toast.error(json.error_remark || 'Failed to sync ship status')
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {

      setSyncingShip(null)
    }
  }

  const syncAllStatuses = async () => {

    const activeShipments = shipments.filter(s => 
      !s.ship_status?.toLowerCase().includes('delivered') && 
      !s.ship_status?.toLowerCase().includes('cancel') &&
      !s.ship_status?.toLowerCase().includes('return')
    )
    
    if (activeShipments.length === 0) {
      toast.error('No active shipments to sync')
      return
    }

    setIsSyncingAll(true)
    toast.loading(`Syncing ${activeShipments.length} shipments...`)
    
    try {
      // We'll sync in batches or just sequentially for now to keep it simple and safe
      for (const s of activeShipments) {
        await Promise.all([
          refreshOrderStatus(s),
          refreshShipStatus(s)
        ])
      }
      toast.dismiss()
      toast.success('All active shipments synced')
    } catch (e: any) {
      toast.error('Bulk sync failed partially')
    } finally {
      setIsSyncingAll(false)
    }
  }

  const filteredShipments = shipments.filter(s => {
    if (shipFilter === 'all') return true
    const status = s.ship_status?.toLowerCase() || ''
    if (shipFilter === 'transit') return status.includes('transit') || status.includes('collected') || status.includes('drop off')
    if (shipFilter === 'delivered') return status.includes('delivered')
    if (shipFilter === 'exception') return status.includes('return') || status.includes('cancel')
    return true
  })


  return (
    <div className="flex flex-col h-full bg-gray-50/50">
      {/* Header Area */}
      <div className="bg-white border-b border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                <Package size={18} />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Delivery Operations</h1>
            </div>
            <p className="text-gray-500 text-sm mt-0.5">Control center for your merchant logistics</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Active Shipments Stat in Header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-3 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Truck size={20} />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Deliveries</p>
                <p className="text-lg font-black text-gray-900 -mt-0.5">
                   {shipments.filter(s => s.ship_status?.toLowerCase().includes('transit') || s.ship_status?.toLowerCase().includes('collected')).length}
                </p>
              </div>
              <button 
                onClick={() => { fetchBalance(); refreshMonitoring(); }} 
                disabled={monitoringLoading} 
                className="text-gray-300 hover:text-indigo-600 ml-1 transition-colors"
              >
                <RefreshCw size={14} className={monitoringLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Balance in Header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-3 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Wallet size={20} />
              </div>
              <div className="text-left pr-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Balance</p>
                <p className="text-lg font-black text-gray-900 -mt-0.5">
                  {loadBal ? '...' : balance !== null ? rm(balance) : 'RM --'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all outline-none',
                tab === t.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                  : 'text-gray-500 hover:bg-gray-50')}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto w-full">

        {tab === 'overview' && (
          <div className="space-y-8 animate-in fade-in duration-700">
            {/* Stats Grid - MATCH LALAMOVE STYLE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'In Transit', count: shipments.filter(s => s.ship_status?.toLowerCase().includes('transit') || s.ship_status?.toLowerCase().includes('collected')).length, icon: <Truck className="w-5 h-5" />, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                { label: 'Delivered', count: shipments.filter(s => s.ship_status?.toLowerCase().includes('delivered')).length, icon: <CheckCircle2 className="w-5 h-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Action Required', count: shipments.filter(s => s.ship_status?.toLowerCase().includes('return') || s.ship_status?.toLowerCase().includes('cancel')).length, icon: <AlertCircle className="w-5 h-5" />, color: 'text-rose-600', bg: 'bg-rose-50' },
                { label: 'Total Shipments', count: shipments.length, icon: <Package className="w-5 h-5" />, color: 'text-blue-600', bg: 'bg-blue-50' },
              ].map((stat, i) => (
                <Card key={i} className="rounded-[2rem] border-gray-100 shadow-sm transition-all hover:shadow-md group">
                   <CardContent className="p-6 flex items-center gap-4">
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", stat.bg, stat.color)}>
                        {stat.icon}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                        <p className="text-2xl font-black text-gray-900">{stat.count}</p>
                      </div>
                   </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Recent Activity - MATCH LALAMOVE STYLE */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="rounded-[2rem] overflow-hidden border-gray-100 shadow-sm bg-white">
                  <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-5 px-8 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center text-white">
                        <Zap size={18} fill="currentColor" />
                      </div>
                      <CardTitle className="font-bold text-gray-900 text-base">Live Logistics Status</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold border-gray-200">
                      REAL-TIME FEED
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-[440px] overflow-y-auto p-8 relative">
                      {deliveryEvents.filter(e => e.provider === 'easyparcel').length > 0 ? (
                        <div className="space-y-6 relative before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
                          {deliveryEvents.filter(e => e.provider === 'easyparcel').slice(0, 10).map((event, i) => (
                            <div key={event.id} className="relative pl-8 group">
                              <div className={cn(
                                "absolute left-0 top-1.5 w-5 h-5 rounded-full border-4 border-white shadow-sm ring-1 ring-gray-100 transition-transform group-hover:scale-110",
                                i === 0 ? "bg-orange-600" : "bg-gray-300"
                              )} />
                              <div className="flex items-start justify-between gap-6">
                                <div className="space-y-1">
                                  <p className="text-sm font-bold text-gray-900 capitalize leading-none">
                                    {(event.event_type || 'Update').replace(/_/g, ' ')}
                                  </p>
                                  <p className="text-[11px] text-gray-400 font-medium">
                                    <Clock size={12} className="inline mr-1" /> {format(new Date(event.created_at), 'MMM d · h:mm a')}
                                  </p>
                                </div>
                                <Badge variant="outline" className="text-[10px] font-bold border-gray-100">
                                   ORDER #{monitoredOrders.find(o => o.id === event.order_id)?.order_number || '---'}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-20">
                          <Clock size={32} className="mx-auto text-gray-200 mb-2" />
                          <p className="text-xs text-gray-400">No active signals flow yet.</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Health Status */}
              <div className="space-y-6">
                <Card className="rounded-[2rem] border-gray-100 shadow-sm bg-white overflow-hidden">
                  <CardHeader className="py-5 px-8 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
                      <ShieldCheck size={16} />
                    </div>
                    <CardTitle className="font-bold text-gray-900 text-sm">System Node</CardTitle>
                  </CardHeader>
                  <CardContent className="px-8 py-6 space-y-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Master API</span>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", hasKeys ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
                        <span className={cn("text-xs font-bold", hasKeys ? "text-emerald-700" : "text-rose-700")}>
                          {hasKeys ? 'CONNECTED' : 'OFFLINE'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Registry</span>
                      <div className="flex items-center gap-1">
                        <MapPin size={10} className="text-gray-400" />
                        <span className="text-xs font-bold text-gray-700">{settings.sender_postcode || '!!!'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-gray-100 shadow-sm p-6 bg-white">
                   <h3 className="font-bold text-gray-900 text-sm mb-4">Quick Insights</h3>
                   <div className="space-y-4">
                      <div className="flex gap-3">
                         <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                            <BarChart3 className="w-4 h-4" />
                         </div>
                         <div>
                            <p className="text-xs font-bold text-gray-900">Success Rate</p>
                            <p className="text-[10px] text-gray-400">96.5% benchmark</p>
                         </div>
                      </div>
                      <div className="flex gap-3">
                         <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 shrink-0">
                            <Truck className="w-4 h-4" />
                         </div>
                         <div>
                            <p className="text-xs font-bold text-gray-900">Top Service</p>
                            <p className="text-[10px] text-gray-400">J&T Express Leader</p>
                         </div>
                      </div>
                   </div>
                </Card>
              </div>
            </div>
          </div>
        )}


        {tab === 'shipments' && (
          <div className="space-y-6 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-100 shadow-sm">
                {[
                  { id: 'all', label: 'All Shipments' },
                  { id: 'transit', label: 'In Transit' },
                  { id: 'delivered', label: 'Delivered' },
                  { id: 'exception', label: 'Exceptions' },
                ].map(f => (
                  <button key={f.id} onClick={() => setShipFilter(f.id)}
                    className={cn('px-4 py-1.5 rounded-lg text-xs font-semibold transition-all',
                      shipFilter === f.id ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50')}>
                    {f.label}
                  </button>
                ))}
              </div>
              <Button onClick={syncAllStatuses} disabled={isSyncingAll} variant="outline" className="rounded-xl h-10 px-4 gap-2 border-gray-200 bg-white">
                <RefreshCw size={14} className={isSyncingAll ? 'animate-spin' : ''} />
                {isSyncingAll ? 'Syncing...' : 'Sync All Status'}
              </Button>
            </div>

            <Card className="rounded-[2rem] border-gray-100 shadow-sm overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100 uppercase tracking-widest text-[10px] font-bold text-gray-400">
                      <th className="px-8 py-5">Shipment</th>
                      <th className="px-8 py-5">Status</th>
                      <th className="px-8 py-5">Courier</th>
                      <th className="px-8 py-5">Cost</th>
                      <th className="px-8 py-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredShipments.map(s => {
                      const meta = shipStatusMeta(s.ship_status)
                      return (
                        <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-8 py-6">
                            <p className="font-bold text-gray-900 text-sm">#{s.reference}</p>
                            <p className="text-xs text-gray-400 truncate max-w-[200px]">{s.customer_name}</p>
                          </td>
                          <td className="px-8 py-6">
                            <Badge className={cn("text-[10px] uppercase font-black px-2 py-0.5", meta.bg, meta.color)}>
                              {meta.label}
                            </Badge>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2">
                               <span className="text-lg">{courierEmoji(s.courier_name)}</span>
                               <div>
                                  <p className="text-xs font-bold text-gray-700 leading-tight">{s.courier_name}</p>
                                  <p className="text-[10px] text-gray-400 font-mono">{s.awb || 'No AWB yet'}</p>
                               </div>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-sm font-bold text-gray-900">
                            {rm(s.shipping_cost)}
                          </td>
                          <td className="px-8 py-6 text-right space-x-2">
                             <Button variant="ghost" size="sm" onClick={() => setTrackShip(s)} className="h-8 w-8 p-0 text-gray-400 hover:text-indigo-600">
                               <Eye size={14} />
                             </Button>
                             {s.awb_id_link && s.awb && !s.awb.toLowerCase().includes('not available') && (
                               <a href={s.awb_id_link} target="_blank">
                                 <Button variant="ghost" size="sm" title="Print AWB Label" className="h-8 w-8 p-0 text-gray-400 hover:text-emerald-600">
                                   <Download size={14} />
                                 </Button>
                               </a>
                             )}
                          </td>
                        </tr>
                      )
                    })}
                    {filteredShipments.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-8 py-20 text-center text-gray-400 text-sm italic">
                          No shipments found matching the selected filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

      </div>

      {trackShip && <TrackingModal shipment={trackShip} merchantId={merchantId} onClose={() => setTrackShip(null)} />}
    </div>
  )
}

