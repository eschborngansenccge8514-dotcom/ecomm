'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  FileText,
  User,
  MapPin,
  Tag,
  HelpCircle,
  ChevronDown,
  XCircle,
  Ban,
  ExternalLink,
  Building2
} from 'lucide-react'
import { StatusBadge } from '@/components/einvoice/StatusBadge'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'

const LHDN_ERROR_GUIDE: Record<string, string> = {
  'CF302': 'LHDN couldn\'t find your buyer\'s TIN number in their database. This usually means: (1) the TIN was typed incorrectly, or (2) the buyer hasn\'t registered with LHDN yet.',
  'CF301': 'The Tax Identification Number (TIN) format is invalid. Ensure it matches LHDN standards (e.g. C12345678900).',
  'CF305': 'The Business Registration Number provided does not match the TIN on record.',
  'VAL-ERR-01': 'One or more line items have invalid tax classification codes. Please check for accuracy.',
  'INVALID_SIGNATURE': 'The digital signature appended to this document is invalid. This may be due to an expired certificate.',
}

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [invoice, setInvoice] = useState<any>(null)
  const [lineItems, setLineItems] = useState<any[]>([])
  const [rawView, setRawView] = useState(false)
  const [errorGuideOpen, setErrorGuideOpen] = useState(true)

  useEffect(() => {
    async function fetchDetails() {
      setLoading(true)
      const { data, error } = await supabase
        .from('einvoices')
        .select('*')
        .eq('id', params.id)
        .single()

      if (data) {
        setInvoice(data)
        
        // Fetch line items
        const { data: items } = await supabase
          .from('einvoice_line_items')
          .select('*')
          .eq('document_id', data.id)
        
        if (items) setLineItems(items)
      }
      setLoading(false)
    }
    fetchDetails()
  }, [params.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
         <RefreshCw className="animate-spin text-blue-600" size={32} />
      </div>
    )
  }

  if (!invoice) return <div>Not found</div>

  const isFailed = ['invalid', 'rejected', 'failed'].includes(invoice.status)
  
  return (
    <div className="space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
         <div className="space-y-1">
            <button onClick={() => router.push('/einvoice/invoices')} className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-widest mb-2">
               <ArrowLeft size={14} /> Back to List
            </button>
            <div className="flex items-center gap-3">
               <h1 className="text-3xl font-black text-gray-900 tracking-tight">Invoice #{invoice.order_number || invoice.id.slice(0, 8)}</h1>
               <StatusBadge status={invoice.status} />
            </div>
         </div>
         
         <div className="flex items-center gap-2">
            {!isFailed && (
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all">
                <Download size={14} /> Download PDF
              </button>
            )}
            {isFailed && (
              <button 
                onClick={() => toast.loading('Resubmitting...')}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
              >
                 <RefreshCw size={14} /> Fix & Resubmit
              </button>
            )}
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 space-y-8">
            {/* Error Guide Card */}
            {isFailed && (
               <div className="bg-rose-50 border-2 border-rose-100 rounded-[2rem] p-8 space-y-6">
                  <div className="flex items-start justify-between">
                     <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center shrink-0">
                           <AlertCircle size={24} />
                        </div>
                        <div className="space-y-1">
                           <h3 className="text-lg font-black text-rose-900 leading-tight tracking-tight">Validation Failed</h3>
                           <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-rose-600 uppercase bg-rose-200 px-2 py-0.5 rounded-lg tracking-widest leading-none">
                                 {invoice.error_code || 'ERROR'}
                              </span>
                           </div>
                        </div>
                     </div>
                     <button 
                       onClick={() => setErrorGuideOpen(!errorGuideOpen)}
                       className="p-2 text-rose-400 hover:text-rose-900"
                     >
                        <ChevronDown size={20} className={cn("transition-transform", errorGuideOpen ? "rotate-180" : "")} />
                     </button>
                  </div>
                  
                  {errorGuideOpen && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-100 space-y-6">
                       <div className="p-5 bg-white rounded-2xl border border-rose-100 shadow-sm space-y-3">
                          <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                             <HelpCircle size={14} className="text-blue-500" />
                             What does this mean?
                          </h4>
                          <p className="text-sm text-gray-700 leading-relaxed font-medium">
                             {LHDN_ERROR_GUIDE[invoice.error_code] || invoice.error_message || 'A technical validation error occurred during submission. Contact support for assistance.'}
                          </p>
                       </div>
                       
                       <div className="space-y-3">
                         <h4 className="text-xs font-black text-rose-900 uppercase tracking-widest opacity-60">Step-by-step fix</h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-white/50 rounded-2xl border border-rose-100 flex items-start gap-3">
                               <div className="w-6 h-6 bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center text-xs font-black font-mono shrink-0">1</div>
                               <p className="text-xs font-bold text-gray-600">Verify Buyer TIN and Company Registration No again.</p>
                            </div>
                            <div className="p-4 bg-white/50 rounded-2xl border border-rose-100 flex items-start gap-3">
                               <div className="w-6 h-6 bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center text-xs font-black font-mono shrink-0">2</div>
                               <p className="text-xs font-bold text-gray-600">Ensure the TIN matches the legal name registered with LHDN.</p>
                            </div>
                         </div>
                       </div>
                    </div>
                  )}
               </div>
            )}

            {/* Invoice Data Sections */}
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
               <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">Invoice Details</h3>
                  <div className="flex items-center gap-2">
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Type: B2B Invoice</span>
                  </div>
               </div>
               
               <div className="p-8 space-y-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     {/* Seller Info */}
                     <div className="space-y-4 p-6 bg-gray-50/50 rounded-3xl border border-gray-50">
                        <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                           <Building2 size={14} className="text-blue-500" />
                           Seller Details
                        </div>
                        <div className="space-y-1">
                           <div className="text-sm font-black text-gray-900">Your Merchant Name</div>
                           <div className="text-xs font-bold text-gray-500">TIN: C22345678912</div>
                           <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 mt-2">
                              <ShieldCheck size={12} /> Verified by MerchantMind
                           </div>
                        </div>
                     </div>

                     {/* Buyer Info */}
                     <div className="space-y-4 p-6 bg-gray-50/50 rounded-3xl border border-gray-50">
                        <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                           <User size={14} className="text-blue-500" />
                           Buyer Details
                        </div>
                        <div className="space-y-1">
                           <div className="text-sm font-black text-gray-900">Buyer Name or Company</div>
                           <div className="text-xs font-bold text-gray-500">TIN: {invoice.buyer_tin || 'Pending Registration'}</div>
                           <div className="text-xs font-bold text-gray-500">Reg No: 202301011223</div>
                        </div>
                     </div>
                  </div>

                  {/* Line Items */}
                  <div className="space-y-4">
                     <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                        <Tag size={14} className="text-blue-500" />
                        Products & Services
                     </div>
                     <div className="border border-gray-100 rounded-3xl overflow-hidden">
                        <table className="w-full text-left">
                           <thead className="bg-gray-50/50 border-b border-gray-100">
                             <tr>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Description</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Qty</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Price</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Total</th>
                             </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-50/50">
                             {lineItems.length > 0 ? lineItems.map((item) => (
                               <tr key={item.id}>
                                  <td className="px-6 py-4">
                                     <div className="text-xs font-bold text-gray-900">{item.description}</div>
                                     <div className="text-[10px] font-bold text-gray-400 uppercase">{item.classification_code}</div>
                                  </td>
                                  <td className="px-6 py-4 text-center text-xs font-black text-gray-900">{item.quantity}</td>
                                  <td className="px-6 py-4 text-right text-xs font-bold text-gray-900">RM {Number(item.unit_price).toFixed(2)}</td>
                                  <td className="px-6 py-4 text-right text-xs font-black text-gray-900">RM {Number(item.line_total_rm).toFixed(2)}</td>
                               </tr>
                             )) : (
                               <tr>
                                  <td colSpan={4} className="px-6 py-8 text-center text-[10px] font-black text-gray-300 uppercase tracking-widest">Details not synchronized</td>
                               </tr>
                             )}
                           </tbody>
                           <tfoot className="bg-gray-50/30">
                              <tr>
                                 <td colSpan={3} className="px-6 py-4 text-right text-xs font-black text-gray-500 uppercase tracking-widest">Grand Total (MYR)</td>
                                 <td className="px-6 py-4 text-right text-base font-black text-gray-900 tracking-tight">
                                    RM {Number(invoice.total_amount).toFixed(2)}
                                 </td>
                              </tr>
                           </tfoot>
                        </table>
                     </div>
                  </div>

                  {/* Metadata Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                     <div className="p-6 rounded-3xl bg-blue-50/30 border border-blue-50 space-y-4">
                         <div className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">
                            <MapPin size={14} />
                            Submission Context
                         </div>
                         <div className="space-y-4">
                            <div className="flex items-center justify-between">
                               <span className="text-[10px] font-bold text-gray-400 uppercase">Channel</span>
                               <span className="text-xs font-black text-blue-600">POS Checkout</span>
                            </div>
                            <div className="flex items-center justify-between">
                               <span className="text-[10px] font-bold text-gray-400 uppercase">Order Ref</span>
                               <span className="text-xs font-black text-gray-900 tracking-tighter">#{invoice.order_number}</span>
                            </div>
                         </div>
                     </div>

                     <div className="p-6 rounded-3xl bg-emerald-50/30 border border-emerald-50 space-y-4">
                         <div className="flex items-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">
                            <ShieldCheck size={14} />
                            Digital Signature
                         </div>
                         <div className="space-y-4">
                            <div className="flex items-center justify-between">
                               <span className="text-[10px] font-bold text-gray-400 uppercase">Standard</span>
                               <span className="text-xs font-black text-emerald-600">UBL 2.1 JSON</span>
                            </div>
                            <div className="flex items-center justify-between">
                               <span className="text-[10px] font-bold text-gray-400 uppercase">Fingerprint</span>
                               <span className="text-[10px] font-mono font-bold text-gray-900 opacity-40">SHA-256</span>
                            </div>
                         </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Right Column: Timeline & Side Controls */}
         <div className="space-y-8">
            <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm space-y-8">
               <div className="space-y-1">
                  <h3 className="font-black text-gray-900 tracking-tight">Status Timeline</h3>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Real-time interaction story</p>
               </div>

               <div className="relative pl-8 space-y-8">
                  <div className="absolute left-3.5 top-0 bottom-0 w-0.5 bg-gray-100" />
                  
                  {[
                    { label: 'MerchantMind Draft', time: invoice.created_at, icon: FileText, color: 'text-gray-400 bg-gray-50' },
                    { label: 'Submitted to LHDN', time: invoice.submitted_at || invoice.created_at, icon: RefreshCw, color: 'text-blue-500 bg-blue-50' },
                    { 
                      label: invoice.status === 'validated' ? 'Validated by LHDN' : isFailed ? 'Rejected by LHDN' : 'Validation in Progress',
                      time: invoice.validated_at || 'Pending',
                      icon: invoice.status === 'validated' ? CheckCircle2 : isFailed ? XCircle : Clock,
                      color: invoice.status === 'validated' ? 'text-emerald-500 bg-emerald-50' : isFailed ? 'text-rose-500 bg-rose-50' : 'text-amber-500 bg-amber-50'
                    }
                  ].map((event, idx) => (
                    <div key={idx} className="relative z-10 flex flex-col gap-1">
                       <div className={cn(
                         "absolute -left-[27px] top-0 w-4 h-4 rounded-full border-4 border-white shadow-sm ring-2 ring-inset",
                         event.color.replace('text-', 'ring-').replace('bg-', 'bg-')
                       )} />
                       <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          <event.icon size={14} className={event.color.split(' ')[0]} />
                          {event.label}
                       </h4>
                       <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">
                          {event.time === 'Pending' ? 'Waiting...' : format(new Date(event.time), 'MMM d, h:mm a')}
                       </span>
                    </div>
                  ))}
               </div>

               {invoice.lhdn_uuid && (
                 <div className="pt-4 border-t border-gray-50 space-y-4">
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">LHDN UUID</label>
                       <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                          <span className="text-[10px] font-mono font-bold text-gray-500 truncate flex-1">{invoice.lhdn_uuid}</span>
                          <button className="text-gray-400 hover:text-gray-900 transition-colors">
                             <ExternalLink size={14} />
                          </button>
                       </div>
                    </div>
                    {invoice.qr_code_url && (
                        <div className="p-4 bg-gray-50 rounded-[2rem] border border-gray-100 flex flex-col items-center gap-4">
                           <div className="w-32 h-32 bg-white rounded-2xl flex items-center justify-center p-2 shadow-sm border border-gray-100">
                             <img src={invoice.qr_code_url} alt="LHDN QR" className="w-full h-full" />
                           </div>
                           <p className="text-[9px] font-black text-gray-400 uppercase text-center leading-relaxed">
                              LHDN Validated QR Code.<br/>Scan to verify on MyInvois portal.
                           </p>
                        </div>
                    )}
                 </div>
               )}
            </div>

            {/* Bottom Actions for Details */}
            <div className="space-y-4">
               {invoice.status === 'validated' && (
                 <button className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs hover:bg-black transition-all shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2">
                    <Ban size={14} /> Issue Credit Note
                 </button>
               )}
               <button 
                 onClick={() => setRawView(!rawView)}
                 className="w-full bg-white border border-gray-100 py-4 rounded-2xl font-black text-xs text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
               >
                  {rawView ? 'Hide Data' : 'View Payload (XML/JSON)'}
               </button>
            </div>
         </div>
      </div>
    </div>
  )
}
