'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  Building2, 
  User, 
  Mail, 
  MapPin, 
  Hash, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  Receipt,
  ArrowRight
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'

type IdType = 'BRN' | 'MyKad' | 'Passport'

export default function EinvoiceRequestPage() {
  const params = useParams()
  const txId = params.txId as string
  const [txn, setTxn] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDone, setIsDone] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    tin: '',
    idType: 'BRN' as IdType,
    idNumber: '',
    email: '',
    address: ''
  })

  useEffect(() => {
    async function fetchTx() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('pos_transactions')
        .select('id, receipt_number, total_rm, created_at, merchants(store_name)')
        .eq('id', txId)
        .single()
      
      if (error) {
        console.error('Fetch error:', error)
      } else {
        setTxn(data)
      }
      setIsLoading(false)
    }
    if (txId) fetchTx()
  }, [txId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const supabase = createClient()
    const { error } = await supabase
      .from('pos_einvoice_requests')
      .insert({
        transaction_id: txId,
        customer_name: formData.name,
        customer_tin: formData.tin,
        customer_id_type: formData.idType,
        customer_id_number: formData.idNumber,
        customer_email: formData.email,
        customer_address: formData.address
      })

    if (error) {
      if (error.code === '23505') {
        toast.error('A request for this receipt has already been submitted.')
      } else {
        toast.error('Submission failed. Please check your details.')
        console.error(error)
      }
    } else {
      setIsDone(true)
      toast.success('Request Submitted Successfully!')
    }
    setIsSubmitting(false)
  }

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-slate-400" size={32} />
    </div>
  )

  if (!txn) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center space-y-6">
      <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center">
        <AlertCircle size={40} />
      </div>
      <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Invalid Receipt</h2>
      <p className="text-slate-500 max-w-xs">The transaction ID is invalid or has expired.</p>
    </div>
  )

  if (isDone) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center space-y-8 animate-in fade-in duration-500">
      <div className="w-24 h-24 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-emerald-200">
        <CheckCircle2 size={48} />
      </div>
      <div className="space-y-2">
        <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Thank You!</h2>
        <p className="text-slate-500 max-w-xs mx-auto">
          Your e-invoice request for **{txn.merchants?.store_name}** has been received. 
          The validated e-invoice will be sent to **{formData.email}**.
        </p>
      </div>
      <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm w-full max-w-xs">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Receipt Number</p>
          <p className="font-bold text-slate-900">{txn.receipt_number}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-12 lg:p-24 flex flex-col items-center">
      <div className="w-full max-w-xl space-y-8">
        
        {/* Branding & Info */}
        <div className="text-center space-y-4">
           <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto shadow-xl">
              <Receipt size={32} />
           </div>
           <div className="space-y-1">
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">e-Invoice Request</h1>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Transaction: <span className="text-slate-600">#{txn.receipt_number}</span>
              </p>
           </div>
        </div>

        {/* Form Card */}
        <form 
          onSubmit={handleSubmit}
          className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-slate-200 border border-slate-100 space-y-8"
        >
          <div className="space-y-6">
            
            {/* Header Field: Name */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <User size={14} className="text-slate-300" />
                Full Name (Taxpayer Name)
              </label>
              <input 
                required
                type="text"
                placeholder="e.g. ADAM BIN GANI"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})}
                className="w-full h-14 px-5 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 font-bold transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {/* TIN */}
               <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Hash size={14} className="text-slate-300" />
                  TIN Number
                </label>
                <input 
                  required
                  type="text"
                  placeholder="e.g. IG23456789"
                  value={formData.tin}
                  onChange={e => setFormData({...formData, tin: e.target.value.toUpperCase()})}
                  className="w-full h-14 px-5 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 font-bold transition-all"
                />
              </div>

               {/* Email */}
               <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Mail size={14} className="text-slate-300" />
                  Email Address
                </label>
                <input 
                  required
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full h-14 px-5 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 font-bold transition-all"
                />
              </div>
            </div>

            {/* ID Type & Number */}
            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-full md:w-32 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID Type</label>
                <select 
                  value={formData.idType}
                  onChange={e => setFormData({...formData, idType: e.target.value as IdType})}
                  className="w-full h-14 px-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold text-sm focus:outline-none"
                >
                  <option value="BRN">BRN (SSM)</option>
                  <option value="MyKad">MyKad</option>
                  <option value="Passport">Passport</option>
                </select>
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID Number</label>
                <input 
                  required
                  type="text"
                  placeholder="Registration / ID No."
                  value={formData.idNumber}
                  onChange={e => setFormData({...formData, idNumber: e.target.value.toUpperCase()})}
                  className="w-full h-14 px-5 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 font-bold transition-all"
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <MapPin size={14} className="text-slate-300" />
                Address
              </label>
              <textarea 
                rows={3}
                placeholder="Full residential or business address"
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                className="w-full p-5 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 font-bold transition-all resize-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-16 bg-slate-900 text-white rounded-[1.5rem] font-black text-lg hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : <ArrowRight />}
            Request e-Invoice
          </button>
        </form>

        <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest px-8 leading-relaxed">
          The merchant will process your request and submit it to MyInvois. 
          You will receive the validated e-invoice via email once approved.
        </p>
      </div>
    </div>
  )
}
