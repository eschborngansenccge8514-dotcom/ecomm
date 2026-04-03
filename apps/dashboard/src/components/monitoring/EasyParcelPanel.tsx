'use client'

import { Package, Truck, CheckCircle2, AlertCircle, RefreshCw, BarChart3, Copy, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useMonitoring, Order, DeliveryEvent } from '@/hooks/useMonitoring'
import { useEffect, useState, Fragment } from 'react'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'

type MonitoringData = ReturnType<typeof useMonitoring>

export function EasyParcelPanel({ data }: { data: MonitoringData }) {
  const { orders, deliveryEvents } = data
  const [expandedAwb, setExpandedAwb] = useState<string | null>(null)

  const easyParcelOrders = orders.filter(o => o.delivery_provider === 'easyparcel')
  
  const stats = {
    pending: easyParcelOrders.filter(o => !o.tracking_number).length,
    transit: easyParcelOrders.filter(o => o.delivery_status === 'in_transit' || o.delivery_status === 'driver_assigned' || o.delivery_status === 'picked_up').length,
    delivered: easyParcelOrders.filter(o => o.delivery_status === 'delivered').length,
    exceptions: easyParcelOrders.filter(o => o.exception_flag === 'on_hold' || o.delivery_status === 'returned' || o.delivery_status === 'cancelled').length,
  }


  const getAwbTimeline = (orderId: string) => {
    return deliveryEvents
      .filter(e => e.order_id === orderId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('AWB copied to clipboard')
  }

  return (
    <div className="space-y-6">
      {/* Status Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(stats).map(([label, count]) => (
          <div key={label} className="bg-white border rounded-lg p-3 text-center shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{(label || '').replace('_', ' ')}</p>
            <p className="text-xl font-bold text-gray-900">{count}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Performance Metrics Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" /> Performance Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="text-xs text-blue-700 font-medium">On-time Rate</span>
              <span className="text-sm font-bold text-blue-900">94.2%</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 border rounded-lg">
                <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Avg. Days</p>
                <p className="text-lg font-bold">2.4</p>
              </div>
              <div className="p-3 border rounded-lg">
                <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Return Rate</p>
                <p className="text-lg font-bold">0.8%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Shipments List */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold">Recent Shipments</CardTitle>
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b">
                    <th className="px-5 py-3">AWB / Courier</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Destination</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {easyParcelOrders.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-gray-400 italic">No EasyParcel shipments found.</td>
                    </tr>
                  ) : (
                    easyParcelOrders.map((order) => (
                      <Fragment key={order.id}>
                        <tr className="hover:bg-gray-50/50">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-100 rounded-lg">
                                <Package className="w-4 h-4 text-blue-600" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-gray-900">{order.tracking_number || 'Pending...'}</span>
                                  {order.tracking_number && (
                                    <button onClick={() => copyToClipboard(order.tracking_number)} className="text-gray-400 hover:text-gray-600">
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-500">J&T Express (Standard Delivery)</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0 text-[10px]">
                              {(order.delivery_status || 'Pending').replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-xs text-gray-700 font-medium">Batu Berendam, Melaka</p>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 text-xs gap-1"
                              onClick={() => setExpandedAwb(expandedAwb === order.id ? null : order.id)}
                            >
                              Track {expandedAwb === order.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </Button>
                          </td>
                        </tr>
                        {expandedAwb === order.id && (
                          <tr className="bg-gray-50/30">
                            <td colSpan={4} className="px-5 py-6">
                              <div className="max-w-md mx-auto relative pl-6 space-y-4 border-l-2 border-dashed border-gray-200 ml-4">
                                {getAwbTimeline(order.id).length === 0 ? (
                                  <div className="py-4 text-xs text-gray-500 italic">Tracking timeline will appear as the shipment progresses.</div>
                                ) : (
                                  getAwbTimeline(order.id).map((event, idx) => (
                                    <div key={event.id} className="relative">
                                      <div className={cn(
                                        "absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm ring-1 ring-gray-300",
                                        idx === 0 ? "bg-blue-600" : "bg-gray-300"
                                      )} />
                                      <div>
                                        <p className={cn("text-xs font-bold capitalize", idx === 0 ? "text-blue-600" : "text-gray-900")}>
                                          {(event.event_type || 'Update').replace('_', ' ')}
                                        </p>
                                        <p className="text-[10px] text-gray-500">
                                          {new Date(event.created_at).toLocaleString()}
                                        </p>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
