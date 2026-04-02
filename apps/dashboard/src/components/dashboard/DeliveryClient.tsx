'use client'
import { useState, useEffect }     from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button }       from '@/components/ui/button'
import { format }       from 'date-fns'
import toast            from 'react-hot-toast'
import { Truck, ExternalLink, Package, MapPin, Loader2, AlertCircle, AlertTriangle, RefreshCw, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const PROVIDER_LABELS: Record<string, string> = {
  lalamove:  '🏍️  Lalamove',
  easyparcel: '📦  EasyParcel',
  self:       '🏃  Self Pickup',
}

export function DeliveryClient({ orders: initial, merchantId }: { orders: any[]; merchantId: string }) {
  const [orders, setOrders]   = useState(initial)
  const [activeTab, setActiveTab] = useState<'active' | 'exceptions'>('active')
  const [booking, setBooking] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  // Sync state with server-side prop updates
  useEffect(() => {
    if (initial) {
      setOrders(initial)
    }
  }, [initial])

  const exceptions = orders.filter(o => !!o.exception_flag)
  const activeOrders = orders.filter(o => !o.exception_flag && o.status !== 'cancelled')

  const displayOrders = activeTab === 'active' ? activeOrders : exceptions

  const handleBookLalamove = async (order: any) => {
    if (!order.delivery_quote_id) {
      toast.error('No quote saved for this order — customer must re-checkout')
      return
    }
    setBooking(order.id)
    try {
      const { data, error } = await supabase.functions.invoke('lalamove-create-order', {
        body: {
          orderId:      order.id,
          quotationId:  order.delivery_quote_id,
          serviceType:  order.delivery_service_id,
        },
      })
      if (error || data?.error) throw new Error(error?.message ?? data?.error)
      toast.success('Lalamove booked! Driver being assigned 🏍️')
      setOrders(prev => prev.map(o => o.id === order.id
        ? { ...o, status: 'out_for_delivery', lalamove_order_id: data.lalamoveOrderId }
        : o))
    } catch (err: any) {
      toast.error(err.message)
    }
    setBooking(null)
  }

  const handleSyncEasyParcel = async (order: any) => {
    setBooking(order.id)
    try {
      const { data, error } = await supabase.functions.invoke('easyparcel-sync-status', {
        body: { orderId: order.id },
      })
      if (error || data?.error) throw new Error(error?.message ?? data?.error)
      toast.success('EasyParcel status synced!')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    }
    setBooking(null)
  }

  const handleBookEasyParcel = async (order: any) => {
    setBooking(order.id)
    try {
      const { data, error } = await supabase.functions.invoke('easyparcel-create-order', {
        body: { orderId: order.id },
      })
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Failed to book courier')
      toast.success(`EasyParcel booked! AWB: ${data.trackingNumber}`)
      setOrders(prev => prev.map(o => o.id === order.id
        ? { ...o, status: 'out_for_delivery', tracking_number: data.trackingNumber, tracking_url: data.trackingUrl }
        : o))
    } catch (err: any) {
      toast.error(err.message)
    }
    setBooking(null)
  }

  const handleRetry = async (orderId: string) => {
    if (!confirm('Retry this Lalamove booking?')) return
    setBooking(orderId)
    try {
      const { data, error } = await supabase.functions.invoke('lalamove-retry-order', {
        body: { orderId }
      })
      if (error || data?.error) throw new Error(error?.message ?? data?.error)
      toast.success('Retried successfully!')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    }
    setBooking(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-1">
        <button
          onClick={() => setActiveTab('active')}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors relative",
            activeTab === 'active' ? "text-primary" : "text-gray-400 hover:text-gray-600"
          )}
        >
          Active Deliveries
          {activeOrders.length > 0 && (
            <span className="ml-2 bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md text-[10px]">
              {activeOrders.length}
            </span>
          )}
          {activeTab === 'active' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
        <button
          onClick={() => setActiveTab('exceptions')}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors relative",
            activeTab === 'exceptions' ? "text-amber-600" : "text-gray-400 hover:text-gray-600"
          )}
        >
          Exceptions
          {exceptions.length > 0 && (
            <span className="ml-2 bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-md text-[10px]">
              {exceptions.length}
            </span>
          )}
          {activeTab === 'exceptions' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />}
        </button>
      </div>

      {displayOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-24 text-center">
          <Truck size={40} className="mx-auto text-gray-200 mb-4" />
          <p className="text-gray-400 text-sm">
            {activeTab === 'active' ? 'No active deliveries' : 'No delivery exceptions! 🎉'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayOrders.map(order => {
            const addr    = order.delivery_address as any
            const isBooked = !!order.lalamove_order_id || !!order.tracking_number
            const isLoading = booking === order.id
            const isException = !!order.exception_flag

            return (
              <div 
                key={order.id} 
                className={cn(
                  "bg-white rounded-2xl border p-5 transition-shadow hover:shadow-sm",
                  isException ? "border-amber-200 bg-amber-50/20" : "border-gray-100"
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/orders/${order.id}`} className="hover:underline">
                        <span className="font-mono text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-lg">
                          {order.order_number}
                        </span>
                      </Link>
                      <span className={cn(
                        'text-xs font-semibold px-2 py-0.5 rounded-full capitalize',
                        order.status === 'out_for_delivery' ? 'bg-sky-100 text-sky-700' : 
                        order.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700'
                      )}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
                      {isException && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 uppercase bg-amber-100 px-2 py-0.5 rounded-full">
                          <AlertCircle size={10} />
                          {order.exception_flag.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {format(new Date(order.created_at), 'd MMM, h:mm a')} · RM {Number(order.total_amount).toFixed(2)}
                    </p>

                    {addr && (
                      <div className="flex items-start gap-1.5 mt-2">
                        <MapPin size={13} className="text-gray-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-gray-500">
                          {addr.name} · {addr.line1}, {addr.city}, {addr.state} {addr.postcode}
                        </p>
                      </div>
                    )}

                    <p className="text-xs font-medium text-gray-600 mt-1">
                      {PROVIDER_LABELS[order.delivery_provider] ?? order.delivery_provider ?? '—'}
                      {order.delivery_fee > 0 && ` · RM ${Number(order.delivery_fee).toFixed(2)}`}
                      {order.priority_fee_added > 0 && (
                        <span className="text-green-600"> · +RM {order.priority_fee_added.toFixed(2)} tip</span>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    {isException && order.delivery_provider === 'lalamove' ? (
                      <Button onClick={() => handleRetry(order.id)} disabled={isLoading} size="sm" type="button"
                        className="bg-amber-500 hover:bg-amber-600 text-white">
                        {isLoading ? <Loader2 size={15} className="animate-spin mr-1" /> : <RefreshCw size={14} className="mr-1" />}
                        Retry Booking
                      </Button>
                    ) : isException && order.delivery_provider === 'easyparcel' ? (
                      <div className="flex flex-col gap-2">
                         <Button onClick={() => handleBookEasyParcel(order)} disabled={isLoading} size="sm" type="button"
                          className="bg-amber-500 hover:bg-amber-600 text-white">
                          {isLoading ? <Loader2 size={15} className="animate-spin mr-1" /> : <RefreshCw size={14} className="mr-1" />}
                          Re-submit Order
                        </Button>
                        <p className="text-[10px] text-amber-700 font-medium">
                          {order.merchant_note || 'Check credit balance or postcode.'}
                        </p>
                      </div>
                    ) : (
                      <>
                        {!isBooked && (
                          <div className="flex gap-2">
                            <Button 
                              type="button"
                              onClick={() => {
                                if (!order.delivery_quote_id || order.delivery_provider !== 'lalamove') {
                                  handleRetry(order.id)
                                } else {
                                  handleBookLalamove(order)
                                }
                              }} 
                              disabled={isLoading} 
                              size="sm"
                              className="bg-orange-500 hover:bg-orange-600 text-white"
                            >
                              {isLoading ? <Loader2 size={15} className="animate-spin mr-1" /> : <Truck size={14} className="mr-1" />}
                              Book Lalamove
                            </Button>

                            {order.delivery_provider === 'easyparcel' && (
                              <Button 
                                type="button"
                                onClick={() => handleBookEasyParcel(order)} 
                                disabled={isLoading} 
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                {isLoading ? <Loader2 size={15} className="animate-spin mr-1" /> : <Package size={14} className="mr-1" />}
                                Book Courier
                              </Button>
                            )}
                          </div>
                        )}
                        {isBooked && order.delivery_provider === 'easyparcel' && order.status !== 'delivered' && (
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={() => handleSyncEasyParcel(order)}
                            disabled={isLoading}
                            className="text-xs h-8"
                          >
                            {isLoading ? <Loader2 size={12} className="animate-spin mr-1" /> : <RefreshCw size={12} className="mr-1" />}
                            Sync Status
                          </Button>
                        )}
                      </>
                    )}

                    {order.driver_name && (
                      <div className="bg-green-50 rounded-xl p-2.5 text-[10px]">
                        <p className="font-semibold text-green-800">Driver: {order.driver_name}</p>
                        <p className="text-green-600">{order.driver_plate}</p>
                      </div>
                    )}

                    {order.tracking_url && (
                      <a href={order.tracking_url} target="_blank" rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 bg-blue-50 text-blue-600 text-[11px] font-medium rounded-xl px-3 py-1.5 hover:bg-blue-100 transition-colors">
                        <ExternalLink size={12} /> Track
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
