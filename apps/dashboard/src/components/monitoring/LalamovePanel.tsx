import { Truck, Phone, MapPin, Clock, AlertTriangle, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Order, useMonitoring } from '@/hooks/useMonitoring'
import { formatDistanceToNow, differenceInMinutes } from 'date-fns'
import { cn } from '@/lib/utils'

type MonitoringData = ReturnType<typeof useMonitoring>

export function LalamovePanel({ data }: { data: MonitoringData }) {
  const { orders } = data
  
  const lalamoveOrders = orders.filter(o => 
    o.delivery_provider === 'lalamove' && 
    o.delivery_status !== 'not_requested'
  )
  const activeOrders = lalamoveOrders.filter(o => 
    ['paid', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery'].includes(o.status)
  )

  const getStatusConfig = (status: string, deliveryStatus: string) => {
    if (deliveryStatus === 'finding_driver') return { color: 'bg-yellow-500', label: 'Assigning Driver', progress: 20 }
    if (deliveryStatus === 'driver_assigned') return { color: 'bg-blue-500', label: 'Driver Assigned', progress: 40 }
    if (deliveryStatus === 'picked_up') return { color: 'bg-indigo-500', label: 'On Going', progress: 60 }
    if (deliveryStatus === 'in_transit') return { color: 'bg-green-500', label: 'Picked Up', progress: 80 }
    if (deliveryStatus === 'delivered') return { color: 'bg-green-600', label: 'Completed', progress: 100 }
    if (deliveryStatus === 'failed') return { color: 'bg-red-500', label: 'Failed', progress: 0 }
    return { color: 'bg-gray-400', label: status, progress: 10 }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-orange-100 bg-orange-50/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-600 flex items-center gap-2">
              <Truck className="w-4 h-4" /> Active Lalamove
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeOrders.length}</div>
            <p className="text-xs text-gray-500 mt-1">Deliveries in progress</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-900">Active Deliveries</h3>
        {activeOrders.length === 0 ? (
          <div className="bg-white border rounded-xl p-8 text-center text-gray-400">
            <Truck className="w-12 h-12 mx-auto mb-3 opacity-10" />
            <p>No active Lalamove deliveries at the moment.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {activeOrders.map((order) => {
              const config = getStatusConfig(order.status, order.delivery_status)
              const minutesInStatus = order.updated_at ? differenceInMinutes(new Date(), new Date(order.updated_at)) : 0
              
              return (
                <Card key={order.id} className="overflow-hidden">
                  <div className="flex flex-col md:flex-row">
                    {/* Main Info */}
                    <div className="flex-1 p-5 border-b md:border-b-0 md:border-r">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-orange-100 rounded-lg">
                            <Truck className="w-5 h-5 text-orange-600" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">Order #{order.order_number}</p>
                            <p className="text-[10px] text-gray-500 uppercase font-medium">Lalamove ID: {order.lalamove_order_id || 'Pending'}</p>
                          </div>
                        </div>
                        <Badge className={cn("text-white border-0", config.color)}>
                          {config.label}
                        </Badge>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="text-gray-500">Delivery Progress</span>
                            <span className="font-medium text-gray-900">{config.progress}%</span>
                          </div>
                          <Progress value={config.progress} className="h-1.5" />
                        </div>

                        <div className="grid grid-cols-2 gap-4 py-2">
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Status for {minutesInStatus} min</span>
                          </div>
                          {order.driver_name && (
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <MapPin className="w-3.5 h-3.5" />
                              <span>{order.driver_plate}</span>
                            </div>
                          )}
                        </div>

                        {order.delivery_status === 'finding_driver' && minutesInStatus > 10 && (
                          <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-3">
                            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-[11px] font-bold text-red-700 leading-tight">Driver not found for {minutesInStatus} mins</p>
                              <div className="mt-2 flex gap-2">
                                <Button size="sm" variant="destructive" className="h-7 text-[10px] px-2">Add Priority Fee</Button>
                                <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 border-red-200 text-red-700 bg-white">Cancel & Retry</Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Driver & Map Placeholder */}
                    <div className="w-full md:w-80 bg-gray-50 p-5">
                      {order.driver_name ? (
                        <div className="space-y-4">
                          <div className="bg-white rounded-xl p-3 border shadow-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">
                                {order.driver_name[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-900 truncate">{order.driver_name}</p>
                                <p className="text-[10px] text-gray-500">Lalamove Hero</p>
                              </div>
                              <Button size="icon" variant="secondary" className="w-8 h-8 rounded-full">
                                <Phone className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="relative aspect-video bg-gray-200 rounded-xl overflow-hidden border border-gray-300 group">
                            {/* Simple simulated map */}
                            <div className="absolute inset-0 bg-[#f8f9fa] flex items-center justify-center text-center p-4">
                              <div>
                                <MapPin className="w-6 h-6 text-blue-600 mx-auto mb-1 animate-pulse" />
                                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Live Driver Tracking</p>
                                <p className="text-[10px] text-gray-400 mt-1">{order.last_driver_lat?.toFixed(4)}, {order.last_driver_lng?.toFixed(4)}</p>
                              </div>
                            </div>
                            <div className="absolute top-2 right-2">
                              <Button size="icon" variant="outline" className="w-7 h-7 shadow-sm bg-white">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-500">Last updated:</span>
                            <span className="font-medium text-gray-700">
                              {order.last_driver_update_at ? formatDistanceToNow(new Date(order.last_driver_update_at)) : 'No data'} ago
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-4">
                          <Clock className="w-8 h-8 text-gray-300 mb-2 animate-spin-slow" />
                          <p className="text-xs font-medium text-gray-500">Searching for nearby drivers...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
