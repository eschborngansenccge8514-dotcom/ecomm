'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  ArrowLeft,
  Calendar,
  Layers,
  User,
  ArrowUpRight,
  Info,
  Check
} from 'lucide-react'
import { StatusBadge } from '@/components/einvoice/StatusBadge'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'

export default function InvoiceListPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const [activeTab, setActiveTab] = useState(
    searchParams.get('tab') || 'all'
  )
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<any[]>([])
  const [stagedOrders, setStagedOrders] = useState<any[]>([])
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [loadingRequested, setLoadingRequested] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [consolidating, setConsolidating] = useState(false)

  const fetchInvoices = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: merchant } = await supabase.from('merchants').select('id').eq('owner_id', user?.id).single()
    
    if (!merchant) return

    const { data, error } = await supabase
      .from('einvoices')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false })

    if (data) setInvoices(data)
    setLoading(false)
  }

  const fetchStagedOrders = async () => {
    try {
      const res = await fetch('/api/einvoice/staged')
      const data = await res.json()
      if (Array.isArray(data)) setStagedOrders(data)
    } catch (e) {
      console.error('Failed to fetch staged orders', e)
    }
  }

  const fetchPendingRequests = async () => {
    setLoadingRequested(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: merchant } = await supabase.from('merchants').select('id').eq('owner_id', user?.id).single()
    if (!merchant) return

    const { data, error } = await supabase
      .from('pos_einvoice_requests')
      .select('*, pos_transactions(receipt_number, total_rm, created_at)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (data) {
      // Map it to a shape similar to einvoices for easier rendering
      const transformed = data.map(req => ({
        id: req.id,
        order_number: (req.pos_transactions as any)?.receipt_number,
        buyer_name: req.customer_name,
        buyer_tin: req.customer_tin,
        total_amount: (req.pos_transactions as any)?.total_rm,
        created_at: req.created_at,
        status: 'requested',
        invoice_type: 'individual',
        is_request: true,
        transaction_id: req.transaction_id
      }))
      setPendingRequests(transformed)
    }
    setLoadingRequested(false)
  }

  useEffect(() => {
    fetchInvoices()
    fetchStagedOrders()
    fetchPendingRequests()
  }, [])

  const handleConsolidate = async () => {
    if (stagedOrders.length === 0) return
    setConsolidating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: merchant } = await supabase.from('merchants').select('id').eq('owner_id', user?.id).single()
      
      const res = await fetch('/api/einvoice/consolidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId: merchant?.id })
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Batch consolidated successfully!')
        fetchInvoices()
        fetchStagedOrders()
      } else {
        throw new Error(data.error || data.message)
      }
    } catch (e: any) {
      toast.error(`Consolidation failed: ${e.message}`)
    } finally {
      setConsolidating(false)
    }
  }

  const filteredInvoices = (activeTab === 'requested' ? pendingRequests : invoices).filter(inv => {
    const isConsolidatedInvoice = inv.invoice_type === 'consolidated' || (!inv.order_id && !inv.pos_request_id)

    const matchesSearch = 
      (inv.order_number?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (inv.lhdn_uuid?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (inv.buyer_name?.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = 
      activeTab === 'all' || 
      activeTab === 'requested' || 
      (activeTab === 'failed' ? ['failed', 'invalid', 'rejected', 'error'].includes(inv.status) : inv.status === activeTab)
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
           <button onClick={() => router.push('/einvoice')} className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-widest mb-2">
              <ArrowLeft size={14} /> Back to Hub
           </button>
           <h1 className="text-3xl font-black text-gray-900 tracking-tight">Invoice Management</h1>
        </div>
        
        <div className="flex items-center gap-2">
           <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all">
              <Download size={14} /> Export CSV
           </button>
           {activeTab === 'all' && stagedOrders.length > 0 && (
             <button 
               onClick={handleConsolidate}
               disabled={consolidating}
               className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
             >
                {consolidating ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
                Consolidate {stagedOrders.length} Receipts
             </button>
           )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-4 rounded-[1.5rem] border border-gray-100 shadow-sm">
         <div className="flex p-1 bg-gray-50 rounded-2xl overflow-x-auto whitespace-nowrap hide-scrollbar max-w-full">
            <button 
              onClick={() => setActiveTab('all')}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all",
                activeTab === 'all' ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
              )}
            >
               All Invoices
            </button>
            <button 
              onClick={() => setActiveTab('requested')}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all",
                activeTab === 'requested' ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
              )}
            >
               Requested
               {loadingRequested ? (
                 <RefreshCw className="animate-spin" size={10} />
               ) : (
                 <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded-md text-[10px]">
                   {pendingRequests.length}
                 </span>
               )}
            </button>
            <button 
              onClick={() => setActiveTab('pending')}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all",
                activeTab === 'pending' ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
              )}
            >
               Pending
            </button>
            <button 
              onClick={() => setActiveTab('validated')}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all",
                activeTab === 'validated' ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
              )}
            >
               Validated
            </button>
            <button 
              onClick={() => setActiveTab('submitted')}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all",
                activeTab === 'submitted' ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
              )}
            >
               Submitted
            </button>
            <button 
              onClick={() => setActiveTab('failed')}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all",
                activeTab === 'failed' ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
              )}
            >
               Failed
            </button>
         </div>

         <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <div className="relative w-full sm:w-64 group">
               <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
               <input 
                 type="text" 
                 placeholder="Search number, name, UUID..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-600 transition-all border"
               />
            </div>
         </div>
      </div>

      {activeTab === 'all' && stagedOrders.length > 0 && (
         <div className="bg-amber-50 border-2 border-amber-100 rounded-[2rem] p-6 flex flex-col sm:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4 duration-500">
            <div className="flex items-start gap-4">
               <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
                  <Info size={24} />
               </div>
               <div className="space-y-1">
                  <h3 className="font-bold text-amber-900">Ready for Consolidation</h3>
                  <p className="text-xs text-amber-700/80 font-medium leading-relaxed max-w-sm">
                     You have {stagedOrders.length} receipts that haven't been individually invoiced. 
                     You can batch these together now to remain compliant.
                  </p>
               </div>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 px-2 max-w-full sm:max-w-md">
               {stagedOrders.slice(0, 3).map(order => (
                  <div key={order.id} className="px-3 py-2 bg-white rounded-xl border border-amber-200 text-[10px] font-black text-amber-700 whitespace-nowrap">
                     #{order.order_number}
                  </div>
               ))}
               {stagedOrders.length > 3 && (
                  <div className="px-3 py-2 bg-amber-200 rounded-xl text-[10px] font-black text-amber-800">
                     +{stagedOrders.length - 3} more
                  </div>
               )}
            </div>
         </div>
      )}

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-gray-50/50">
                     <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type & Number</th>
                     <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Customer</th>
                     <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount</th>
                     <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date Submitted</th>
                     <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                     <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-50">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="group hover:bg-gray-50/30 transition-all cursor-pointer" onClick={() => router.push(`/einvoice/invoices/${inv.id}`)}>
                       <td className="px-8 py-6">
                          <div className="flex items-center gap-3">
                             <div className={cn(
                               "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                               inv.order_id ? "bg-blue-50 text-blue-600" : "bg-indigo-50 text-indigo-600"
                             )}>
                                {inv.order_id ? <User size={18} /> : <Layers size={18} />}
                             </div>
                             <div className="space-y-0.5">
                                <div className="text-sm font-black text-gray-900 tracking-tight">
                                   #{inv.order_number || `BATCH-${inv.id.slice(0, 8).toUpperCase()}`}
                                </div>
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                   {inv.order_id ? 'Individual B2B' : 'Consolidated B2C'}
                                </div>
                             </div>
                          </div>
                       </td>
                       <td className="px-8 py-6">
                          <div className="text-sm font-bold text-gray-900">{inv.buyer_name || 'Generic Buyer'}</div>
                          <div className="text-xs text-gray-400 font-medium">{inv.buyer_tin || 'No TIN provided'}</div>
                       </td>
                       <td className="px-8 py-6">
                          <div className="text-sm font-black text-gray-900 tracking-tight">
                             {Number(inv.total_amount).toLocaleString('en-MY', { style: 'currency', currency: 'MYR' })}
                          </div>
                          {inv.tax_amount > 0 && <div className="text-[10px] font-bold text-emerald-600 uppercase">Inc. SST</div>}
                       </td>
                       <td className="px-8 py-6">
                          <div className="text-sm font-bold text-gray-700">{format(new Date(inv.created_at), 'MMM d, yyyy')}</div>
                          <div className="text-xs text-gray-400 font-medium">{format(new Date(inv.created_at), 'h:mm a')}</div>
                       </td>
                       <td className="px-8 py-6 text-center">
                          <StatusBadge status={inv.status} />
                       </td>
                       <td className="px-8 py-6 text-right">
                          <button className="p-3 bg-gray-50 text-gray-400 rounded-xl opacity-0 group-hover:opacity-100 hover:text-gray-900 hover:bg-gray-100 transition-all">
                             <ArrowUpRight size={20} />
                          </button>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
         
         {filteredInvoices.length === 0 && !loading && (
            <div className="py-24 text-center">
               <div className="w-20 h-20 bg-gray-50 text-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search size={40} />
               </div>
               <h3 className="text-xl font-bold text-gray-900">No invoices found</h3>
               <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto font-medium leading-relaxed">
                  We couldn't find any {activeTab} invoices matching your current filters.
               </p>
               <button 
                 onClick={() => {
                   setSearchTerm('')
                   setActiveTab('all')
                 }}
                 className="mt-6 text-xs font-black text-blue-600 uppercase tracking-widest hover:underline"
               >
                  Clear all filters
               </button>
            </div>
         )}
      </div>
    </div>
  )
}
