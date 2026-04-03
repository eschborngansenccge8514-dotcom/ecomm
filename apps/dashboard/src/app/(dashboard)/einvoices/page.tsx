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
  const [activeTab, setActiveTab] = useState<'individual' | 'consolidated'>('individual')

  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchInvoices()
  }, [])

  async function fetchInvoices() {
    setLoading(true)
    setErrorMsg(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setErrorMsg('Not authenticated')
        return
      }

      console.debug('Dashboard User ID:', user.id)

      const { data: merchant, error: mErr } = await supabase
        .from('merchants')
        .select('id, store_name')
        .eq('owner_id', user.id)
        .single()

      if (mErr || !merchant) {
        console.error('Merchant fetch error:', mErr)
        setErrorMsg('Merchant not found for this user.')
        return
      }

      console.debug('Fetching invoices for merchant:', merchant.id, merchant.store_name)

      const { data, error: invErr } = await supabase
        .from('einvoices')
        .select('*')
        .eq('merchant_id', merchant.id)
        .order('created_at', { ascending: false })

      if (invErr) {
        console.error('Einvoice query error (JSON):', JSON.stringify(invErr, null, 2))
        setErrorMsg('Error loading invoices: ' + (invErr.message || JSON.stringify(invErr)))
      } else if (data) {
        console.debug('Invoices data received:', data.length, data)
        setInvoices(data)
      }
    } catch (err: any) {
      console.error('Error fetching invoices:', err)
      setErrorMsg('Unexpected error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredInvoices = invoices.filter(inv => {
    // Tab filter
    if (activeTab === 'individual' && !inv.order_id) return false
    if (activeTab === 'consolidated' && inv.order_id) return false

    const matchesSearch = inv.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         inv.lhdn_uuid?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || inv.status === filterStatus
    return matchesSearch && matchesStatus
  })

  async function handleConsolidate() {
     setIsConsolidating(true)
     try {
       const now = new Date()
       const res = await fetch('/api/einvoice/consolidate', { 
         method: 'POST',
         body: JSON.stringify({
            merchant_id: '', // Will be picked up by the API route from auth context
            year: now.getFullYear().toString(),
            month: (now.getMonth() + 1).toString()
         })
       })
       const data = await res.json()
       if (!res.ok) throw new Error(data.error || 'Consolidation failed')
       toast.success(`Successfully consolidated ${data.processed} orders`)
       fetchInvoices() // refresh
       setActiveTab('consolidated')
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
             className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:shadow-lg hover:to-indigo-700 transition-all shadow-md disabled:opacity-50"
          >
            <Layers size={18} />
            {isConsolidating ? 'Sweeping...' : 'Consolidate Receipts'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('individual')}
          className={cn(
            "px-6 py-3 font-semibold text-sm transition-all relative",
            activeTab === 'individual' ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"
          )}
        >
          Individual Invoices
          {invoices.filter(i => i.order_id).length > 0 && (
             <span className="ml-2 bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs">
               {invoices.filter(i => i.order_id).length}
             </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('consolidated')}
          className={cn(
            "px-6 py-3 font-semibold text-sm transition-all relative",
            activeTab === 'consolidated' ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"
          )}
        >
          Consolidated Invoices
          {invoices.filter(i => !i.order_id).length > 0 && (
             <span className="ml-2 bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-xs font-bold">
               {invoices.filter(i => !i.order_id).length}
             </span>
          )}
        </button>
      </div>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder={activeTab === 'individual' ? "Search by order number or LHDN UUID..." : "Search by consolidated batch number..."}
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
        {errorMsg && (
          <div className="p-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
              <XCircle size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Unable to load e-invoices</h3>
            <p className="text-gray-500 mt-2 max-w-md mx-auto">{errorMsg}</p>
            <button 
              onClick={() => fetchInvoices()}
              className="mt-6 text-blue-600 font-bold hover:underline"
            >
              Try refreshing
            </button>
          </div>
        )}
        
        {!errorMsg && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">{activeTab === 'individual' ? 'Order Info' : 'Consolidated Batch'}</th>
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
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No {activeTab} e-invoices found matching your criteria.</td></tr>
                ) : filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900 flex items-center gap-2">
                         {inv.order_number}
                         {activeTab === 'consolidated' && (
                            <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tight">Batch</span>
                         )}
                      </div>
                      {activeTab === 'individual' ? (
                         <div className="text-xs text-gray-500">Order #{inv.order_number}</div>
                      ) : (
                         <div className="text-xs text-gray-500">Includes {inv.orders_count || 'multiple'} receipts</div>
                      )}
                      <div className="text-xs font-medium text-blue-600 mt-1">RM {inv.orders?.total_amount || inv.total_amount || '0.00'}</div>
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
                        {activeTab === 'individual' ? (
                           <Link href={`/orders?query=${inv.order_number}`}
                             className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                           >
                             <ChevronRight size={18} />
                           </Link>
                        ) : (
                           <button className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all" title="View Batch Details">
                             <ChevronRight size={18} />
                           </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
