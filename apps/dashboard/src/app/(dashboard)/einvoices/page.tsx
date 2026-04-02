'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Search, 
  Filter, 
  Download, 
  ExternalLink, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Settings as SettingsIcon,
  ChevronRight,
  Layers
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

export default function EInvoicesPage() {
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [isConsolidating, setIsConsolidating] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchInvoices()
  }, [])

  async function fetchInvoices() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!merchant) return

      const { data, error } = await supabase
        .from('einvoices')
        .select(`
          *,
          orders (
            order_number,
            total_amount,
            customer_id,
            profiles (full_name)
          )
        `)
        .eq('merchant_id', merchant.id)
        .order('created_at', { ascending: false })

      if (data) {
        setInvoices(data)
      }
    } catch (err) {
      console.error('Error fetching invoices:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         inv.lhdn_uuid?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || inv.status === filterStatus
    return matchesSearch && matchesStatus
  })

  async function handleConsolidate() {
     setIsConsolidating(true)
     try {
       const res = await fetch('/api/einvoice/consolidate', { method: 'POST' })
       const data = await res.json()
       if (!res.ok) throw new Error(data.error || 'Consolidation failed')
       toast.success(`Successfully consolidated ${data.processed} orders`)
       fetchInvoices() // refresh
     } catch (err: any) {
       toast.error(err.message)
     } finally {
       setIsConsolidating(false)
     }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'validated':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold ring-1 ring-green-200">
          <CheckCircle2 size={12} /> Validated
        </span>
      case 'submitted':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold ring-1 ring-blue-200">
          <Clock size={12} /> Submitted
        </span>
      case 'rejected':
      case 'failed':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold ring-1 ring-red-200">
          <XCircle size={12} /> {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-bold ring-1 ring-gray-200">
          {status}
        </span>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">E-Invoicing</h1>
          <p className="text-gray-500 mt-1">Manage and track your LHDN e-invoice submissions.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/einvoices/settings" className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition-all shadow-sm">
            <SettingsIcon size={18} />
            Settings
          </Link>
          <button 
             onClick={handleConsolidate}
             disabled={isConsolidating}
             className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50"
          >
            <Layers size={18} />
            {isConsolidating ? 'Sweeping...' : 'Consolidate Receipts'}
          </button>
          <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
            <Download size={18} />
            Export
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by order number or LHDN UUID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl pl-11 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-all outline-none shadow-sm"
          />
        </div>
        <div>
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-all outline-none shadow-sm font-medium text-gray-700"
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="validated">Validated</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Order Info</th>
                <th className="px-6 py-4">LHDN UUID</th>
                <th className="px-6 py-4">Submission Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Loading your e-invoices...</td></tr>
              ) : filteredInvoices.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No e-invoices found matching your criteria.</td></tr>
              ) : filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{inv.order_number}</div>
                    <div className="text-xs text-gray-500">{inv.orders?.profiles?.full_name || 'Customer'}</div>
                    <div className="text-xs font-medium text-blue-600 mt-1">RM {inv.orders?.total_amount}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-mono text-gray-600 truncate max-w-[200px]" title={inv.lhdn_uuid}>
                      {inv.lhdn_uuid || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{format(new Date(inv.created_at), 'dd MMM yyyy')}</div>
                    <div className="text-xs text-gray-500">{format(new Date(inv.created_at), 'hh:mm a')}</div>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(inv.status)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       {inv.qr_code_url && (
                        <a href={inv.qr_code_url} target="_blank" rel="noopener noreferrer" 
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="View on LHDN"
                        >
                          <ExternalLink size={18} />
                        </a>
                      )}
                      <Link href={`/orders?query=${inv.order_number}`}
                        className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                      >
                        <ChevronRight size={18} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
