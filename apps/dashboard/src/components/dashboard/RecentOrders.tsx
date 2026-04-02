'use client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import Link from 'next/link'

export function RecentOrders({ orders, merchantId }: { orders: any[]; merchantId: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-gray-900">Recent Orders</h2>
        <Link href="/orders">
          <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
            View All
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        {orders.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">No orders yet</p>
        )}
        {orders.map((order) => (
          <div key={order.id} className="flex items-center justify-between group">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {order.order_number}
              </p>
              <p className="text-xs text-gray-500">
                {format(new Date(order.created_at), 'd MMM, h:mm a')}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-gray-900">
                RM {Number(order.total_amount).toFixed(2)}
              </p>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                {order.status.replace('_', ' ')}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
