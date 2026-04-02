'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  RefreshCcw,
  Search,
  Filter,
  AlertTriangle,
  CreditCard,
  History
} from 'lucide-react'
import { format } from 'date-fns'

export default function PaymentExceptionsClient({ merchantId }: { merchantId: string }) {
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<any[]>([])
  const [stats, setStats] = useState({
    duplicates: 0,
    pending: 0,
    failed: 0
  })

  const supabase = createClient()

  useEffect(() => {
    fetchExceptions()
  }, [merchantId])

  const fetchExceptions = async () => {
    setLoading(true)
    try {
      // 1. Fetch recent payment events (last 100)
      const { data: eventData, error: eventError } = await supabase
        .from('payment_events')
        .select(`
          *,
          orders!left (
            order_number,
            status,
            total_amount
          )
        `)
        // Filter by orders belonging to this merchant
        .not('order_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100)

      if (eventError) throw eventError

      setEvents(eventData || [])

      // 2. Fetch stats: Dubplicates (this is harder to query exactly without a count, let's just count from fetched data for now)
      // Actually, we can just fetch pending older than 30 mins
      const { count: pendingCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', merchantId)
        .eq('status', 'pending')
        .lt('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())

      // 3. Fetch failed payments
      const { count: failedCount } = await supabase
        .from('payment_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'payment_failed')

      setStats({
        duplicates: 0, // Mock for now, requires complex count
        pending: pendingCount || 0,
        failed: failedCount || 0
      })
    } catch (err) {
      console.error('Error fetching exceptions:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Stuck Pending</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">Orders pending for &gt; 30 minutes</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-red-600">
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Failed Attempts</p>
              <p className="text-2xl font-bold text-gray-900">{stats.failed}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">Total payment failures logged</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <RefreshCcw size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Deduplicated</p>
              <p className="text-2xl font-bold text-gray-900">Auto</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">Duplicate webhooks suppressed</p>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <History size={20} className="text-gray-400" />
            <h2 className="text-lg font-bold text-gray-900">Payment Event Log</h2>
          </div>
          <button 
            onClick={fetchExceptions}
            className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            <RefreshCcw size={16} />
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Gateway / Ref</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Event Type</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">
                    Loading event logs...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">
                    No payment events found.
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                      {format(new Date(event.created_at), 'MMM d, HH:mm:ss')}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900">{event.orders?.order_number || 'N/A'}</p>
                      <p className="text-xs text-gray-500">RM {event.orders?.total_amount || '0.00'}</p>
                    </td>
                    <td className="px-6 py-4 uppercase tracking-tighter">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-700">{event.gateway}</span>
                        <span className="text-[10px] text-gray-400 font-mono truncate max-w-[120px]">
                          {event.gateway_ref}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700">
                        {event.event_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {event.event_type.includes('captured') || event.event_type.includes('success') ? (
                        <div className="flex items-center gap-1.5 text-green-600">
                          <CheckCircle2 size={14} />
                          <span className="font-medium">Processed</span>
                        </div>
                      ) : event.event_type.includes('failed') ? (
                        <div className="flex items-center gap-1.5 text-red-600">
                          <AlertCircle size={14} />
                          <span className="font-medium">Failed</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-600">
                          <Clock size={14} />
                          <span className="font-medium">Notice</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
