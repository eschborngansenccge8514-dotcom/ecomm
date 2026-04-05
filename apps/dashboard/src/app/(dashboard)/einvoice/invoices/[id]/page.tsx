'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
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
  Building2,
  Mail,
  Phone,
  Edit2,
  X
} from 'lucide-react'
import { StatusBadge } from '@/components/einvoice/StatusBadge'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { invokeWorker } from '@/lib/worker'

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
  const [merchant, setMerchant] = useState<any>(null)
  const [config, setConfig] = useState<any>(null)
  const [lineItems, setLineItems] = useState<any[]>([])
  const [rawView, setRawView] = useState(false)
  const [errorGuideOpen, setErrorGuideOpen] = useState(true)
  const [resubmitting, setResubmitting] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editFormData, setEditFormData] = useState({
    name: '',
    tin: '',
    email: '',
    phone: '',
    idType: 'BRN',
    idNumber: '',
    address: '',
    postcode: '',
    city: '',
    state: '',
    country: 'MYS'
  })
  const [checkingStatus, setCheckingStatus] = useState(false)

  useEffect(() => {
     if (invoice) {
        // Try to get existing details from the UBL payload or the flat columns
        const details = invoice.einvoice_details?.Invoice?.[0]?.AccountingCustomerParty?.[0]?.Party?.[0] || {}
        
        if (invoice.is_request) {
           setEditFormData({
              name: (invoice.buyer_name || '').toUpperCase(),
              tin: (invoice.buyer_tin || 'EI00000000010').toUpperCase(),
              email: invoice.buyer_email || '',
              phone: invoice.buyer_phone || '0123456789',
              idType: invoice.buyer_id_type || 'BRN',
              idNumber: (invoice.buyer_id_number || 'NA').toUpperCase(),
              address: invoice.buyer_address || 'N/A',
              postcode: invoice.buyer_postcode || '00000',
              city: invoice.buyer_city || 'N/A',
              state: invoice.buyer_state || '14',
              country: invoice.buyer_country || 'MYS'
           })
        } else {
           setEditFormData({
              name: (invoice.buyer_name || details.PartyLegalEntity?.[0]?.RegistrationName?.[0]?._ || '').toUpperCase(),
              tin: (invoice.buyer_tin || details.PartyIdentification?.[0]?.ID?.[0]?._ || 'EI00000000010').toUpperCase(),
              email: invoice.buyer_email || details.Contact?.[0]?.ElectronicMail?.[0]?._ || '',
              phone: invoice.buyer_phone || details.Contact?.[0]?.Telephone?.[0]?._ || '0123456789',
              idType: details.PartyIdentification?.[1]?.ID?.[0]?.schemeID || 'BRN',
              idNumber: (details.PartyIdentification?.[1]?.ID?.[0]?._ || '').toUpperCase(),
              address: details.PostalAddress?.[0]?.AddressLine?.[0]?.Line?.[0]?._ || 'N/A',
              postcode: details.PostalAddress?.[0]?.PostalZone?.[0]?._ || '00000',
              city: details.PostalAddress?.[0]?.CityName?.[0]?._ || 'N/A',
              state: details.PostalAddress?.[0]?.CountrySubentityCode?.[0]?._ || '14',
              country: details.PostalAddress?.[0]?.Country?.[0]?.IdentificationCode?.[0]?._ || 'MYS'
           })
        }
     }
  }, [invoice]);

  const handleUpdateAndResubmit = async (e: React.FormEvent) => {
     e.preventDefault()
     setResubmitting(true)
     const tId = toast.loading('Saving and Resubmitting...')
     try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('No active session')

        const cleanTin = editFormData.tin.trim().toUpperCase().replace(/[\s-]/g, '')
        const cleanId = editFormData.idNumber.trim().toUpperCase().replace(/[\s-]/g, '')

        // Build customer override
        const customerOverride = {
           name: editFormData.name.trim().toUpperCase(),
           tin: cleanTin,
           email: editFormData.email.trim(),
           phone: editFormData.phone.trim().replace(/[\s-]/g, ''),
           id_type: editFormData.idType,
           id_number: cleanId,
           address: editFormData.address.trim(),
           postcode: editFormData.postcode.trim(),
           city: editFormData.city.trim(),
           state: editFormData.state,
           country: editFormData.country
        }

        const body = {
            order_id: invoice.order_id,
            pos_request_id: invoice.pos_request_id,
            merchant_id: invoice.merchant_id,
            customer: customerOverride
        }

        console.log('[E-Invoice Submit] Payload:', JSON.stringify(body, null, 2));
        const res = await fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}/einvoice/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
          },
          body: JSON.stringify(body)
        })

        const result = await res.json()
        if (!res.ok) {
           console.error('[E-Invoice Submit Error] Worker Response:', result);
           throw new Error(result.error || 'Submission failed')
        }
        
        console.log('[E-Invoice Submit Success] Result:', result);
        toast.success('Successfully submitted!', { id: tId })
        setIsEditModalOpen(false)
        window.location.reload()
     } catch (err: any) {
        console.error('[E-Invoice Submit Caught Error]:', err);
        toast.error(err.message, { id: tId })
     } finally {
        setResubmitting(false)
     }
  }

  const handleResubmit = async () => {
    setResubmitting(true)
    const tId = toast.loading('Resubmitting to LHDN...')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No active session')

      const res = await fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}/einvoice/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        },
        body: JSON.stringify({
          order_id: invoice.order_id,
          pos_request_id: invoice.pos_request_id,
          merchant_id: invoice.merchant_id
        })
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Submission failed')

      toast.success('Successfully submitted!', { id: tId })
      window.location.reload()
    } catch (err: any) {
      toast.error(err.message, { id: tId })
    } finally {
      setResubmitting(false)
    }
  }

  const handleCheckStatus = async () => {
    setCheckingStatus(true)
    const tId = toast.loading('Checking LHDN status...')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No active session')

      // Trigger a poll on the worker. Technically poll-status does a broad poll,
      // but we call it here to ensure this specific invoice is checked and updated.
      const { data, error } = await invokeWorker('einvoice/poll-status', {
        body: { invoice_id: invoice.id }
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      toast.success('Status updated!', { id: tId })
      window.location.reload()
    } catch (err: any) {
      toast.error(err.message, { id: tId })
    } finally {
      setCheckingStatus(false)
    }
  }

  useEffect(() => {
     async function fetchDetails() {
       setLoading(true)
       let { data, error } = await supabase
         .from('einvoices')
         .select(`
           id, status, buyer_name, buyer_tin,
           order_id, pos_request_id, merchant_id, lhdn_long_id, 
           submission_uid, error_code, error_message, created_at, 
           submitted_at, validated_at, lhdn_uuid, qr_code_url, 
           einvoice_details, order_number, tax_amount, total_amount
         `)
         .eq('id', params.id)
         .single()
   
       if (!data) {
          // Check if it's a pending request
          const { data: request } = await supabase
            .from('pos_einvoice_requests')
            .select('*, pos_transactions(receipt_number, total_rm, created_at, merchant_id)')
            .eq('id', params.id)
            .single()
          
          if (request) {
             data = {
                id: request.id,
                status: 'requested',
                buyer_name: request.customer_name,
                buyer_tin: request.customer_tin,
                buyer_email: request.customer_email,
                buyer_id_type: request.customer_id_type,
                buyer_id_number: request.customer_id_number,
                buyer_phone: request.customer_phone,
                buyer_address: request.customer_address,
                // Select reasonable defaults for missing structured fields
                buyer_postcode: '00000',
                buyer_city: 'N/A',
                buyer_state: '14',
                buyer_country: 'MYS',
                pos_request_id: request.id,
                merchant_id: (request.pos_transactions as any)?.merchant_id,
                total_amount: (request.pos_transactions as any)?.total_rm,
                order_number: (request.pos_transactions as any)?.receipt_number,
                created_at: request.created_at,
                is_request: true
             } as any
          }
       }

       if (data) {
         setInvoice(data)
         
         // Fetch line items (if any for invoices)
         if (!(data as any).is_request) {
            const { data: items } = await supabase
              .from('einvoice_line_items')
              .select('id, description, classification_code, quantity, unit_price, line_total_rm')
              .eq('document_id', data.id)
            
            if (items) setLineItems(items)
         }
   
         // Fetch Seller Info
         const { data: merchantData } = await supabase
           .from('merchants')
           .select('id, store_name, company_name, address_line1, postcode, city, state')
           .eq('id', data.merchant_id)
           .single()
         if (merchantData) setMerchant(merchantData)
   
         const { data: configData } = await supabase
           .from('merchant_einvoice_config')
           .select('merchant_id, tin, registration_no_type, registration_no, env')
           .eq('merchant_id', data.merchant_id)
           .single()
         if (configData) setConfig(configData)
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

  const isFailed = ['invalid', 'rejected', 'failed', 'error'].includes(invoice.status)
  
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
               {config?.env === 'sandbox' && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-md border border-amber-200">
                     Sandbox
                  </span>
               )}
            </div>
         </div>
         
         <div className="flex items-center gap-2">
            {!isFailed && invoice.status !== 'validated' && (
              <button 
                onClick={handleCheckStatus}
                disabled={checkingStatus}
                className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-100 rounded-xl text-xs font-bold text-amber-600 hover:bg-amber-100 transition-all shadow-sm shadow-amber-100"
              >
                <RefreshCw size={14} className={checkingStatus ? 'animate-spin' : ''} /> 
                {checkingStatus ? 'Checking...' : 'Check Status'}
              </button>
            )}
             {invoice.status === 'requested' && (
               <button 
                 onClick={() => setIsEditModalOpen(true)}
                 className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
               >
                  <CheckCircle2 size={14} />
                  Issue E-Invoice
               </button>
             )}
             {!isFailed && (
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all">
                <Download size={14} /> Download PDF
              </button>
            )}
            {isFailed && (
              <div className="flex items-center gap-3">
                 <button 
                   onClick={() => setIsEditModalOpen(true)}
                   className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-black hover:bg-black transition-all shadow-lg shadow-gray-200"
                 >
                    <Edit2 size={14} />
                    Edit & Resubmit
                 </button>
                 <button 
                   onClick={handleResubmit}
                   disabled={resubmitting}
                   className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                 >
                    <RefreshCw size={14} className={resubmitting ? 'animate-spin' : ''} /> 
                    {resubmitting ? 'Submitting...' : 'Fix & Resubmit'}
                 </button>
              </div>
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
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                       Type: {invoice.pos_request_id ? 'POS B2C Request' : 'B2B Invoice'}
                     </span>
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
                           <div className="text-sm font-black text-gray-900">{merchant?.store_name || merchant?.company_name || 'Registered Merchant'}</div>
                           <div className="text-xs font-bold text-gray-500">TIN: {config?.tin || 'Not Configured'}</div>
                           <div className="text-xs font-bold text-gray-500">{config?.registration_no_type || 'BRN'}: {config?.registration_no || 'NA'}</div>
                           <div className="text-[10px] font-bold text-gray-400 leading-tight pt-1">
                              {merchant?.address_line1}<br/>
                              {merchant?.postcode} {merchant?.city}, {merchant?.state}
                           </div>
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
                           <div className="text-sm font-black text-gray-900">{invoice.buyer_name || 'Generic Buyer'}</div>
                           <div className="text-xs font-bold text-gray-500">TIN: {invoice.buyer_tin || 'Not Displayed'}</div>
                           {invoice.einvoice_details?.Invoice?.[0]?.AccountingCustomerParty?.[0]?.Party?.[0]?.PartyIdentification?.[1]?.ID?.[0]?._ && (
                              <div className="text-xs font-bold text-gray-500">
                                 {invoice.einvoice_details.Invoice[0].AccountingCustomerParty[0].Party[0].PartyIdentification[1].ID[0].schemeID}: {invoice.einvoice_details.Invoice[0].AccountingCustomerParty[0].Party[0].PartyIdentification[1].ID[0]._}
                              </div>
                           )}
                            <div className="pt-2 space-y-1">
                               <div className="flex items-start gap-2 text-[10px] font-bold text-gray-500">
                                  <MapPin size={12} className="text-gray-400 mt-0.5 shrink-0" />
                                  <span className="leading-tight">
                                     {invoice.einvoice_details?.Invoice?.[0]?.AccountingCustomerParty?.[0]?.Party?.[0]?.PostalAddress?.[0]?.AddressLine?.[0]?.Line?.[0]?._ || 'Address not provided'}
                                  </span>
                               </div>
                               <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                                  <Phone size={12} className="text-gray-400 shrink-0" />
                                  {invoice.einvoice_details?.Invoice?.[0]?.AccountingCustomerParty?.[0]?.Party?.[0]?.Contact?.[0]?.Telephone?.[0]?._ || 'N/A'}
                               </div>
                               <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                                  <Mail size={12} className="text-gray-400 shrink-0" />
                                  {invoice.buyer_email || invoice.einvoice_details?.Invoice?.[0]?.AccountingCustomerParty?.[0]?.Party?.[0]?.Contact?.[0]?.ElectronicMail?.[0]?._ || 'Email not provided'}
                               </div>
                            </div>
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
                               <tr className="border-t border-gray-100">
                                  <td colSpan={3} className="px-6 py-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Subtotal (Excl. Tax)</td>
                                  <td className="px-6 py-2 text-right text-xs font-black text-gray-900">
                                     RM {(Number(invoice.total_amount) - Number(invoice.tax_amount || 0)).toFixed(2)}
                                  </td>
                               </tr>
                               <tr>
                                  <td colSpan={3} className="px-6 py-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Tax (SST {Math.round((Number(invoice?.tax_amount || 0) / (Number(invoice?.total_amount || 0) - Number(invoice?.tax_amount || 0) || 1)) * 100)}%)</td>
                                  <td className="px-6 py-2 text-right text-xs font-black text-gray-900">
                                     RM {Number(invoice.tax_amount || 0).toFixed(2)}
                                  </td>
                               </tr>
                               <tr className="bg-blue-50/20">
                                  <td colSpan={3} className="px-6 py-4 text-right text-xs font-black text-gray-500 uppercase tracking-widest">Grand Total (MYR)</td>
                                  <td className="px-6 py-4 text-right text-base font-black text-blue-600 tracking-tight">
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
                     { 
                       label: (invoice as any).is_request ? 'Receipt Created' : 'MerchantMind Draft', 
                       time: invoice.created_at, 
                       icon: FileText, 
                       color: 'text-gray-400 bg-gray-50' 
                     },
                     { 
                       label: (invoice as any).is_request ? 'Customer Request Received' : 'Submitted to LHDN', 
                       time: (invoice as any).is_request ? invoice.created_at : (invoice.submitted_at || invoice.created_at), 
                       icon: (invoice as any).is_request ? Clock : RefreshCw, 
                       color: 'text-blue-500 bg-blue-50' 
                     },
                     { 
                       label: invoice.status === 'validated' ? 'Validated by LHDN' : 
                              isFailed ? 'Rejected by LHDN' : 
                              (invoice as any).is_request ? 'Pending Merchant Action' : 'Validation in Progress',
                       time: invoice.validated_at || 'Pending',
                       icon: invoice.status === 'validated' ? CheckCircle2 : isFailed ? XCircle : Clock,
                       color: invoice.status === 'validated' ? 'text-emerald-500 bg-emerald-50' : 
                              isFailed ? 'text-rose-500 bg-rose-50' : 'text-amber-500 bg-amber-50'
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
                          <a 
                            href={`${config?.env === 'production' ? 'https://myinvois.hasil.gov.my' : 'https://preprod.myinvois.hasil.gov.my'}/documents/${invoice.lhdn_uuid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-gray-900 transition-colors"
                            title="View on LHDN Portal"
                          >
                             <ExternalLink size={14} />
                          </a>
                       </div>
                    </div>
                    {invoice.qr_code_url && (
                        <div className="p-4 bg-gray-50 rounded-[2rem] border border-gray-100 flex flex-col items-center gap-4">
                           <div className="w-32 h-32 bg-white rounded-2xl flex items-center justify-center p-2 shadow-sm border border-gray-100 relative overflow-hidden">
                             <Image 
                               src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(invoice.qr_code_url)}`} 
                               alt="LHDN QR" 
                               fill
                               className="object-contain p-2" 
                             />
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
         {/* Edit Modal */}
         {isEditModalOpen && (
            <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
               <div className="bg-white rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                     <div className="space-y-0.5">
                        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Edit Buyer Details</h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fix rejection reasons manually</p>
                     </div>
                     <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
                        <X size={20} className="text-gray-400" />
                     </button>
                  </div>
                  
                  <form onSubmit={handleUpdateAndResubmit} className="flex-1 overflow-y-auto p-8 space-y-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Buyer Name</label>
                           <input 
                             required
                             type="text" 
                             className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold"
                             value={editFormData.name}
                             onChange={(e) => setEditFormData({...editFormData, name: e.target.value.toUpperCase()})}
                           />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">TIN Number</label>
                           <input 
                             required
                             type="text" 
                             className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold"
                             value={editFormData.tin}
                             onChange={(e) => setEditFormData({...editFormData, tin: e.target.value.toUpperCase()})}
                             placeholder="e.g. C1234..."
                           />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Phone</label>
                           <input 
                             type="text" 
                             className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold"
                             value={editFormData.phone}
                             onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                           />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Email Address</label>
                           <input 
                             required
                             type="email" 
                             className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold"
                             value={editFormData.email}
                             onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                           />
                        </div>
                     </div>

                     <div className="flex gap-4">
                        <div className="w-1/3 space-y-2">
                           <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ID Type</label>
                           <select 
                             className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold appearance-none"
                             value={editFormData.idType}
                             onChange={(e) => setEditFormData({...editFormData, idType: e.target.value})}
                           >
                              <option value="BRN">BRN</option>
                              <option value="MyKad">MyKad</option>
                              <option value="Passport">Passport</option>
                           </select>
                        </div>
                        <div className="flex-1 space-y-2">
                           <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ID Number / NRIC</label>
                           <input 
                             required
                             type="text" 
                             className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold"
                             value={editFormData.idNumber}
                             onChange={(e) => setEditFormData({...editFormData, idNumber: e.target.value.toUpperCase()})}
                           />
                        </div>
                     </div>

                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Address Line</label>
                        <textarea 
                          required
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold resize-none"
                          rows={2}
                          value={editFormData.address}
                          onChange={(e) => setEditFormData({...editFormData, address: e.target.value})}
                        />
                     </div>
                  </form>
                  
                  <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                     <button 
                       type="button"
                       onClick={() => setIsEditModalOpen(false)}
                       className="px-6 py-3 rounded-xl text-xs font-black text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-widest"
                     >
                        Cancel
                     </button>
                     <button 
                       onClick={handleUpdateAndResubmit}
                       disabled={resubmitting}
                       className="px-8 py-3 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2 uppercase tracking-widest"
                     >
                        {resubmitting ? <RefreshCw className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                        Save & Resubmit
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
   )
}
