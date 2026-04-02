'use client'
import { useRouter } from 'next/navigation'
import { Badge }    from '@/components/ui/badge'
import { Button }   from '@/components/ui/button'
import { format }   from 'date-fns'
import { cn }       from '@/lib/utils'
import { exportOrdersCSV } from '@/lib/export'
import { Download }      from 'lucide-react'

const STATUS_FILTERS = [
  { key: 'all',              label: 'All'       },
  { key: 'paid',             label: 'New'        },
  { key: 'confirmed',        label: 'Confirmed'  },
  { key: 'preparing',        label: 'Preparing'  },
  { key: 'ready_for_pickup', label: 'Ready'      },
  { key: 'out_for_delivery', label: 'Delivering' },
  { key: 'delivered',        label: 'Delivered'  },
  { key: 'cancelled',        label: 'Cancelled'  },
]

const STATUS_STYLES: Record<string, string> = {
  paid:             'bg-blue-100 text-blue-700',
  confirmed:        'bg-indigo-100 text-indigo-700',
  preparing:        'bg-purple-100 text-purple-700',
  ready_for_pickup: 'bg-cyan-100 text-cyan-700',
  out_for_delivery: 'bg-sky-100 text-sky-700',
  delivered:        'bg-green-100 text-green-700',
  cancelled:        'bg-red-100 text-red-700',
  pending:          'bg-yellow-100 text-yellow-700',
}

export function OrdersTable({ orders, total, page, pageSize, currentStatus, merchantId }: {
  orders: any[]; total: number; page: number; pageSize: number
  currentStatus: string; merchantId: string
}) {
  const router = useRouter()
  const totalPages = Math.ceil(total / pageSize)

  const navigate = (params: Record<string, string>) => {
    const sp = new URLSearchParams({ status: currentStatus, page: String(page), ...params })
    router.push(`/orders?${sp.toString()}`)
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="bg-white rounded-2xl border border-gray-100 p-1 flex gap-1 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button key={f.key}
            onClick={() => navigate({ status: f.key, page: '1' })}
            className={cn(
              'px-3 py-1.5 rounded-xl text-sm font-medium transition-colors',
              currentStatus === f.key
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">
            {total} order{total !== 1 ? 's' : ''}
          </h2>
          <Button variant="outline" size="sm" onClick={() => exportOrdersCSV(orders)}>
            <Download size={14} className="mr-1" /> Export CSV
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                {['Order', 'Date', 'Customer', 'Items', 'Total', 'Status', ''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-400 px-5 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-gray-400 py-12 text-sm">
                    No orders found
                  </td>
                </tr>
              )}
              {orders.map(order => (
                <tr key={order.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs font-semibold text-gray-700">
                      {order.order_number}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">
                    {format(new Date(order.created_at), 'd MMM, h:mm a')}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-700">
                    {(order.delivery_address as any)?.name ?? '—'}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-500">
                    {order.items?.length ?? 0} item{order.items?.length !== 1 ? 's' : ''}
                  </td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-gray-900 whitespace-nowrap">
                    RM {Number(order.total_amount).toFixed(2)}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full capitalize',
                      STATUS_STYLES[order.status] ?? 'bg-gray-100 text-gray-600')}>
                      {order.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <Button variant="ghost" size="sm"
                      onClick={() => router.push(`/orders/${order.id}`)}>
                      View →
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Page {page} of {totalPages} · {total} total
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1}
                onClick={() => navigate({ page: String(page - 1) })}>
                ← Prev
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages}
                onClick={() => navigate({ page: String(page + 1) })}>
                Next →
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
