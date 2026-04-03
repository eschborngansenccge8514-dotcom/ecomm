'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { exportOrdersCSV } from '@/lib/export'
import { toast } from 'react-hot-toast'
import { 
  Download, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Eye, 
  CheckCircle, 
  AlertCircle,
  Truck,
  Box,
  ChevronRight,
  TrendingUp,
  Clock,
  Wallet,
  CreditCard,
  Check,
  Printer
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { 
  ORDER_STATUS_CONFIG, 
  PAYMENT_METHOD_CONFIG, 
  DELIVERY_TYPE_CONFIG,
  getDeliveryProgress,
  DELIVERY_STATUS_CONFIG
} from '@/lib/order-utils'
import { OrderActionMenu } from './OrderActionMenu'
import { bulkUpdateOrderStatus, printInvoice } from '@/lib/order-actions'
import { Progress } from '@/components/ui/progress'

const STATUS_FILTERS = [
  { key: 'all',              label: 'All Orders' },
  { key: 'paid',             label: 'New' },
  { key: 'pending',          label: 'Unpaid' },
  { key: 'confirmed',        label: 'Confirmed' },
  { key: 'preparing',        label: 'Preparing' },
  { key: 'ready_for_pickup', label: 'Ready' },
  { key: 'out_for_delivery', label: 'Delivering' },
  { key: 'delivered',        label: 'Delivered' },
  { key: 'cancelled',        label: 'Cancelled' },
]

interface OrdersTableProps {
  orders: any[]
  total: number
  page: number
  pageSize: number
  currentStatus: string
  merchantId: string
  merchant: any
  merchantEinvoiceConfig: any
  stats: {
    total: number
    pending: number
    revenueToday: number
  }
  statusCounts: Record<string, number>
}

const STATUS_STAGES: Record<string, number> = {
  pending: 10,
  paid: 20,
  confirmed: 40,
  preparing: 60,
  ready_for_pickup: 80,
  out_for_delivery: 100,
  delivered: 100,
  cancelled: 0,
  failed: 0,
}

import { AgentActivityFeed } from '@/components/agent/AgentActivityFeed'

export function OrdersTable({ 
  orders, 
  total, 
  page, 
  pageSize, 
  currentStatus, 
  merchantId,
  merchant,
  merchantEinvoiceConfig,
  stats,
  statusCounts
}: OrdersTableProps) {

  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  
  const totalPages = Math.ceil(total / pageSize)

  const navigate = (params: Record<string, string>) => {
    const sp = new URLSearchParams(searchParams.toString())
    Object.entries(params).forEach(([k, v]) => {
      if (v) sp.set(k, v); else sp.delete(k)
    })
    router.push(`/orders?${sp.toString()}`)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    navigate({ search: searchQuery, page: '1' })
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === orders.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(orders.map(o => o.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId)

    if (!error) {
      startTransition(() => {
        router.refresh()
      })
    }
  }

  const updateOrderStatusLocal = async (orderId: string, newStatus: string) => {
    // This is a fallback for simple status updates if needed
    // but preferred is handled in OrderActionMenu now
    startTransition(() => {
      router.refresh()
    })
  }

  const bulkUpdateStatus = async (newStatus: string) => {
    if (selectedIds.length === 0) return
    const tid = toast.loading(`Updating ${selectedIds.length} orders...`)
    try {
      await bulkUpdateOrderStatus(selectedIds, newStatus)
      setSelectedIds([])
      toast.success(`Successfully updated orders to ${newStatus}`, { id: tid })
      startTransition(() => {
        router.refresh()
      })
    } catch (err: any) {
      toast.error(err.message || 'Failed to update orders', { id: tid })
    }
  }

  const bulkPrintInvoices = () => {
    if (selectedIds.length === 0) return
    toast.success(`Opening ${selectedIds.length} invoices for printing...`)
    selectedIds.forEach(id => {
      const order = orders.find(o => o.id === id)
      if (order) {
        const eInv = order.einvoices?.[0] || null
        printInvoice(order, merchant, merchantEinvoiceConfig, eInv)
      }
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
      <div className="lg:col-span-3 space-y-6">
      {/* Stats Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
            <Box size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Orders</p>
            <h3 className="text-2xl font-bold text-gray-900">{stats.total}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Pending New</p>
            <h3 className="text-2xl font-bold text-gray-900">{stats.pending}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Revenue Today</p>
            <h3 className="text-2xl font-bold text-gray-900">RM {stats.revenueToday.toFixed(2)}</h3>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex bg-white rounded-2xl border border-gray-100 p-1 gap-1 overflow-x-auto no-scrollbar">
            {STATUS_FILTERS.map(f => {
              const count = f.key === 'all' ? stats.total : (statusCounts[f.key] || 0)
              return (
                <button key={f.key}
                  onClick={() => navigate({ status: f.key, page: '1' })}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2 whitespace-nowrap',
                    currentStatus === f.key
                      ? 'bg-gray-900 text-white shadow-md shadow-gray-200'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  )}
                >
                  {f.label}
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-md font-bold',
                    currentStatus === f.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  )}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-2xl h-11 px-4 border-gray-200 hover:bg-gray-50"
              onClick={() => exportOrdersCSV(orders)}>
              <Download size={18} className="mr-2 text-gray-500" />
              Export
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <form onSubmit={handleSearch} className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <Input 
              placeholder="Search order #, customer name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-12 rounded-2xl border-gray-100 bg-white focus:ring-2 focus:ring-blue-500/10 transition-all text-sm"
            />
          </form>
          <Button variant="outline" className="h-12 w-12 rounded-2xl border-gray-100">
            <Filter size={18} className="text-gray-500" />
          </Button>
        </div>
      </div>

      {/* Bulk Actions Floating Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-6 animate-in fade-in slide-in-from-bottom-4">
          <span className="text-sm font-semibold text-gray-300">
            {selectedIds.length} orders selected
          </span>
          <div className="h-6 w-[1px] bg-gray-700" />
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="text-white hover:bg-gray-800 rounded-xl"
              onClick={() => bulkUpdateStatus('confirmed')}>
              Confirm
            </Button>
            <Button size="sm" variant="ghost" className="text-white hover:bg-gray-800 rounded-xl"
              onClick={() => bulkUpdateStatus('preparing')}>
              Start Prep
            </Button>
            <Button size="sm" variant="ghost" className="text-blue-400 hover:bg-blue-900/30 rounded-xl"
              onClick={bulkPrintInvoices}>
              <Printer size={14} className="mr-2" />
              Print Invoices
            </Button>
            <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-900/30 rounded-xl"
              onClick={() => setSelectedIds([])}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-left w-12">
                  <Checkbox 
                    checked={selectedIds.length === orders.length && orders.length > 0}
                    onCheckedChange={toggleSelectAll}
                    className="rounded-md border-gray-300"
                  />
                </th>
                <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Order</th>
                <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Customer</th>
                <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Fulfillment</th>
                <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Total</th>
                <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Status & Progress</th>
                <th className="px-5 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-20">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                        <Box size={32} />
                      </div>
                      <div>
                        <p className="text-gray-900 font-semibold">No orders found</p>
                        <p className="text-sm text-gray-400">Try adjusting your filters or search query</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map(order => {
                  const statusInfo = ORDER_STATUS_CONFIG[order.status] || { 
                    label: order.status, 
                    color: 'bg-gray-100 text-gray-700 border-gray-200' 
                  }
                  const payInfo = PAYMENT_METHOD_CONFIG[order.payment_method] || { label: order.payment_method, icon: CreditCard }
                  const delInfo = DELIVERY_TYPE_CONFIG[order.delivery_type] || { label: 'Standard', icon: Truck }
                  
                  const delProgress = getDeliveryProgress(order)
                  const provider = order.delivery_provider
                  const isCancelled = order.status === 'cancelled' || order.status === 'refunded'
                  
                  // Provider styling
                  const providerTheme = provider === 'lalamove' ? 'text-orange-600 bg-orange-50 border-orange-100' 
                                      : provider === 'easyparcel' ? 'text-pink-600 bg-pink-50 border-pink-100'
                                      : order.delivery_type === 'pickup' ? 'text-cyan-600 bg-cyan-50 border-cyan-100'
                                      : statusInfo.color

                  return (
                    <tr key={order.id} className="group hover:bg-gray-50/80 transition-all duration-200">
                      <td className="px-6 py-5">
                        <Checkbox 
                          checked={selectedIds.includes(order.id)}
                          onCheckedChange={() => toggleSelect(order.id)}
                          className="rounded-md border-gray-300"
                        />
                      </td>
                      <td className="px-5 py-5">
                        <div className="flex flex-col">
                          <span className="font-black text-gray-900 text-sm tracking-tight">#{order.order_number}</span>
                          <span className="text-[11px] text-gray-400 font-bold flex items-center gap-1 mt-0.5">
                            <Clock size={10} />
                            {format(new Date(order.created_at), 'd MMM, h:mm a')}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-500 font-black text-xs shadow-inner">
                            {(order.buyer_name || (order.delivery_address as any)?.recipient_name || 'Guest').charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900 text-sm">
                              {order.buyer_name || (order.delivery_address as any)?.recipient_name || 'Guest Customer'}
                            </span>
                            <span className="text-[11px] text-gray-400 font-bold uppercase tracking-tighter">
                              {order.delivery_address ? `📍 ${(order.delivery_address as any).city}` : 'No Address'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-5">
                        <div className="flex flex-col gap-1.5">
                           <div className="flex items-center gap-2">
                             <delInfo.icon size={14} className="text-gray-400" />
                             <span className="text-xs font-bold text-gray-700 capitalize">
                                {provider?.replace('_', ' ') || order.delivery_type}
                             </span>
                           </div>
                           {order.delivery_provider === 'lalamove' && order.driver_name && (
                             <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full w-fit">
                               🏍️ {order.driver_name}
                             </span>
                           )}
                           {order.tracking_number && (
                             <span className="text-[10px] font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full w-fit">
                               📦 {order.tracking_number}
                             </span>
                           )}
                        </div>
                      </td>
                      <td className="px-5 py-5">
                        <div className="flex flex-col">
                          <span className="font-black text-gray-900 text-sm">RM {Number(order.total_amount).toFixed(2)}</span>
                          <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest flex items-center gap-1 mt-0.5">
                            <payInfo.icon size={10} />
                            {payInfo.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-5">
                        <div className="flex flex-col gap-3">
                          <Badge variant="outline" className={cn(
                            'px-3 py-1 rounded-xl border text-[10px] font-black uppercase tracking-widest w-fit shadow-sm',
                            providerTheme
                          )}>
                            {statusInfo.label}
                          </Badge>
                          
                          {/* Mini Progress Bar */}
                          {!isCancelled && delProgress !== -1 && (
                            <div className="flex flex-col gap-1.5">
                              <div className="w-24 group-hover:w-32 transition-all duration-500">
                                <Progress 
                                  value={(delProgress + 1) * 25} 
                                  className="h-1.5 bg-gray-100 rounded-full" 
                                  indicatorClassName={cn(
                                    "transition-all duration-700",
                                    delProgress === 3 ? 'bg-emerald-500' : 'bg-blue-500'
                                  )}
                                />
                              </div>
                              <span className="text-[9px] font-black uppercase tracking-[0.1em] text-gray-400 animate-pulse">
                                {provider === 'lalamove' ? 'Driver Finding' : 'In Progress'}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-5 text-right">
                        <OrderActionMenu 
                          order={order} 
                          merchant={merchant} 
                          merchantEinvoiceConfig={merchantEinvoiceConfig} 
                        />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-8 py-6 bg-gray-50/30 border-t border-gray-50 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-400">
              Showing {Math.min(total, (page - 1) * pageSize + 1)}-{Math.min(total, page * pageSize)} of {total} orders
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="rounded-2xl bg-white border-gray-200 h-10 px-4 text-xs font-bold"
                disabled={page <= 1}
                onClick={() => navigate({ page: String(page - 1) })}
              >
                Previous
              </Button>
              <Button 
                variant="outline" 
                className="rounded-2xl bg-white border-gray-200 h-10 px-4 text-xs font-bold"
                disabled={page >= totalPages}
                onClick={() => navigate({ page: String(page + 1) })}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Agent Activity Feed Side Panel */}
      <aside className="space-y-6">
        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm sticky top-6">
          <AgentActivityFeed limit={8} />
        </div>
      </aside>
    </div>
  )
}

