'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import { CheckCircle2, Home, Printer, Copy, Share2, Receipt, QrCode, User, Loader2, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'

import { usePosOffline } from '@/stores/pos-offline'
import { usePosCart } from '@/stores/pos-cart'
import { usePosSettings } from '@/stores/pos-settings'

export default function ReceiptPage() {
  const params = useParams()
  const txId = params.txId as string
  const [txn, setTxn] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])
  const [loadingStatus, setLoadingStatus] = useState('Verifying transaction...')
  const { pendingTransactions } = usePosOffline()
  const lastCompletedTxn  = usePosCart(state => state.lastCompletedTxn)
  const { autoPrint } = usePosSettings()

  useEffect(() => {
    if (autoPrint && txn && !isLoading && mounted) {
      const timer = setTimeout(() => {
        window.print()
      }, 2000) // Increased delay to 2s to ensure the external QR image is fully fetched
      return () => clearTimeout(timer)
    }
  }, [autoPrint, txn, isLoading, mounted])

  useEffect(() => {
    async function load() {
      try {
        setLoadingStatus('Searching records...')
        if (txId.startsWith('OFF-')) {
          setLoadingStatus('Loading offline receipt...')
          const localTx = pendingTransactions.find(t => t.id === txId || t.payload.id === txId)
          if (localTx) {
            setTxn({
              ...localTx.payload,
              id: localTx.id,
              receipt_number: `OFF-${localTx.id.slice(-6).toUpperCase()}`,
              created_at: new Date(localTx.timestamp).toISOString(),
              is_offline: true,
              pos_transaction_items: localTx.payload.items.map((it: any, idx: number) => ({
                id: `item-${idx}`,
                product_name: it.name,
                qty: it.qty,
                unit_price_rm: it.unitPrice,
                line_total_rm: it.lineTotal
              })),
              subtotal_rm: localTx.payload.totals.subtotal,
              tax_rm: localTx.payload.totals.tax,
              total_rm: localTx.payload.totals.total,
              discount_rm: localTx.payload.totals.lineDiscounts + localTx.payload.totals.globalDiscount + localTx.payload.totals.pointsDiscount,
              payment_method: localTx.payload.paymentMethod
            })
          }
          setIsLoading(false)
          return
        }

        // 1. Try Zustand cache (Instant)
        if (lastCompletedTxn && lastCompletedTxn.id === txId) {
          setTxn(lastCompletedTxn)
          setIsLoading(false)
          return
        }

        // 2. Try sessionStorage fallback (Fast)
        if (typeof window !== 'undefined') {
          const stored = sessionStorage.getItem('last_pos_receipt')
          if (stored) {
            try {
              const parsed = JSON.parse(stored)
              if (parsed.id === txId) {
                setTxn(parsed)
                setIsLoading(false)
                return
              }
            } catch (e) {}
          }
        }

        // 3. Supabase Fetch with Smart Retries
        setLoadingStatus('Downloading from cloud...')
        const supabase = createClient()
        let retries = 5;
        let fetchedData = null;
        let delay = 200; // Start with fast retries for low latency

        while (retries > 0 && !fetchedData) {
          const { data } = await supabase
            .from('pos_transactions')
            .select(`
              *,
              pos_transaction_items (*),
              merchants (*),
              pos_sessions (
                profiles (full_name)
              )
            `)
            .eq('id', txId)
            .single()
            
          if (data) {
            fetchedData = data;
            break;
          }
          
          setLoadingStatus(`Syncing... (${6 - retries}/5)`)
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay + 500, 2000); // Exponential backoff for network jitter
          retries--;
        }

        if (fetchedData) {
          setTxn(fetchedData)
        } else {
          toast.error("Could not find record. It may still be syncing.")
        }
      } catch (err) {
        console.error('Fatal Receipt Error:', err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [txId, pendingTransactions, lastCompletedTxn])

  if (isLoading) return (
    <div className="h-full flex flex-col items-center justify-center bg-slate-50 space-y-8 p-12">
      <div className="relative">
        <div className="w-24 h-24 bg-slate-200/50 rounded-full animate-pulse" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="animate-spin text-slate-400" size={32} />
        </div>
      </div>
      <div className="text-center space-y-2">
         <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{loadingStatus}</h3>
         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Finalizing your receipt details</p>
      </div>
    </div>
  )

  if (!txn) return (
    <div className="h-full flex flex-col items-center justify-center bg-slate-50 space-y-6">
      <div className="w-20 h-20 rounded-3xl bg-red-50 text-red-500 flex items-center justify-center">
         <Receipt size={40} className=" opacity-40" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Transaction Not Found</h2>
        <p className="text-sm text-slate-400 font-medium mt-2">The receipt ID provided is invalid or has been moved.</p>
      </div>
      <div className="flex gap-4">
        <button 
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-8 py-3 bg-white border-2 border-slate-900 text-slate-900 rounded-2xl font-bold hover:bg-slate-50 transition-all"
        >
          <RefreshCw size={18} />
          Try Again
        </button>
        <Link href="/pos" className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all">
          Return to POS
        </Link>
      </div>
    </div>
  )

  const merchant = Array.isArray(txn.merchants) ? txn.merchants[0] : txn.merchants
  const pos_session = Array.isArray(txn.pos_sessions) ? txn.pos_sessions[0] : txn.pos_sessions
  const cashierName = pos_session?.profiles?.full_name || 'Staff'
  
  // Format date to Malaysia Timezone (UTC+8)
  const createdAt = txn.created_at ? new Date(txn.created_at) : (mounted ? new Date() : new Date(0))
  const mytDate = mounted ? new Intl.DateTimeFormat('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: true
  }).format(createdAt) : '—'

  return (
    <div className="h-full flex flex-col items-center bg-slate-50 overflow-y-auto p-12 print:p-0 print:bg-white">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; }
          @page { margin: 0; size: auto; }
          .no-print, [role="status"], .react-hot-toast-container { display: none !important; }
        }
      `}} />
      <div className="max-w-md w-full space-y-12 print:space-y-0">
        {/* Success Header */}
        <div className="text-center space-y-4 print:hidden">
          <div className="w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-2xl shadow-emerald-200 animate-in zoom-in-50 duration-500">
            <CheckCircle2 size={40} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Sale Completed</h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Receipt #{txn.receipt_number}</p>
        </div>

        {/* Paper Receipt Mockup */}
        <div className="bg-white p-8 shadow-2xl shadow-slate-200 rounded-lg relative overflow-hidden border-t-8 border-slate-900 animate-in slide-in-from-bottom-8 duration-700 print:shadow-none print:border-none print:p-4">
          
          {/* Merchant Info (LHDN Compliant) */}
          <div className="text-center space-y-2 mb-8">
            <h2 className="text-sm font-black uppercase tracking-[0.3em] text-slate-900">
              {merchant?.store_name || 'ECHO RETAIL'}
            </h2>
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
              <p>{merchant?.address_line1} {merchant?.address_line2}</p>
              <p>{merchant?.city}, {merchant?.state} {merchant?.postcode}</p>
              <div className="flex justify-center gap-4 mt-2 border-y border-slate-50 py-1.5">
                <p>SSM / BRN: <span className="text-slate-600">{merchant?.brn || 'NOT SET'}</span></p>
                <p>TIN: <span className="text-slate-600">{merchant?.tin || 'NOT SET'}</span></p>
              </div>
              <p className="mt-1">Tel: {merchant?.phone || 'Contact Merchant'}</p>
            </div>
          </div>
          
          <div className="h-px bg-slate-100 border-t border-dashed my-6" />

          {/* Transaction Metadata */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="space-y-1">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Reference No.</p>
              <p className="text-[10px] font-bold text-slate-900">{txn.receipt_number}</p>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Date & Time (MYT)</p>
              <p className="text-[10px] font-bold text-slate-900">{mytDate}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Cashier ID</p>
              <p className="text-[10px] font-bold text-slate-900 flex items-center gap-1">
                <User size={10} className="text-slate-400" />
                {cashierName}
              </p>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Payment Method</p>
              <p className="text-[10px] font-bold text-slate-900 uppercase">{txn.payment_method?.replace('_', ' ')}</p>
            </div>
          </div>

          <div className="h-px bg-slate-100 border-t border-dashed my-6" />

          {/* Itemized List */}
          <div className="space-y-4">
            <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase tracking-widest">
              <span>Items</span>
              {txn.is_offline && (
                <span className="text-amber-600 bg-amber-50 px-2 rounded-full border border-amber-100">DRAFT / OFFLINE</span>
              )}
              <span>Total</span>
            </div>
            {txn.pos_transaction_items.map((item: any) => (
              <div key={item.id} className="flex justify-between items-start text-xs font-medium">
                <div className="space-y-1 max-w-[70%]">
                  <p className="text-slate-900 font-bold leading-none">{item.product_name}</p>
                  <p className="text-slate-400 font-bold uppercase text-[9px]">
                    {item.qty}x @ RM {Number(item.unit_price_rm || 0).toFixed(2)}
                  </p>
                </div>
                <p className="font-mono font-bold text-slate-900">RM {Number(item.line_total_rm || 0).toFixed(2)}</p>
              </div>
            ))}
          </div>

          <div className="h-px bg-slate-100 border-t border-dashed my-6" />

          {/* Totals & Tax Breakdown */}
          <div className="space-y-3">
            <div className="flex justify-between text-xs font-bold text-slate-500">
              <span>Subtotal</span>
              <span className="text-slate-900">RM {Number(txn.subtotal_rm || 0).toFixed(2)}</span>
            </div>
            {Number(txn.discount_rm || 0) > 0 && (
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span>Discount</span>
                <span className="text-amber-600">- RM {Number(txn.discount_rm || 0).toFixed(2)}</span>
              </div>
            )}
             <div className="flex justify-between text-xs font-bold text-slate-500">
              <span>SST (8%)</span>
              <span className="text-slate-900">RM {Number(txn.tax_rm || 0).toFixed(2)}</span>
            </div>
            <div className="pt-3 flex justify-between items-baseline border-t border-slate-50">
              <span className="text-sm font-black text-slate-900 uppercase">Grand Total</span>
              <span className="text-2xl font-black text-slate-900 tracking-tighter">RM {Number(txn.total_rm || 0).toFixed(2)}</span>
            </div>
          </div>

          <div className="h-px bg-slate-100 border-t border-dashed my-6" />

          {/* E-Invoice QR & Disclaimer */}
          <div className="flex flex-col items-center text-center space-y-4">
             {txn.metadata?.lhdn_validation_url ? (
               <div className="space-y-2">
                 <div className="w-24 h-24 bg-slate-50 rounded-xl p-2 mx-auto border border-slate-100 flex items-center justify-center relative overflow-hidden">
                    <Image 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(txn.metadata.lhdn_validation_url)}`}
                      alt="LHDN Validation QR"
                      fill
                      className="object-contain p-2"
                    />
                 </div>
                 <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">
                   Validated e-Invoice
                 </p>
               </div>
             ) : (
               <div className="space-y-4 w-full">
                 <div className="w-28 h-28 bg-white border-2 border-slate-900 rounded-3xl p-3 mx-auto flex items-center justify-center shadow-xl shadow-slate-200/50 relative overflow-hidden">
                    <Image 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${mounted ? window.location.origin : ''}/einvoice/request/${txId}`)}`}
                      alt="Request e-Invoice QR"
                      fill
                      priority
                      unoptimized
                      className="object-contain p-3"
                    />
                 </div>
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                   <p className="text-[10px] font-black text-slate-900 leading-tight uppercase tracking-tight">
                     Scan to Request e-Invoice
                   </p>
                   <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                     Provide your TIN / Details within 30 days
                   </p>
                 </div>
               </div>
             )}
             
             <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] pt-4">
                Thank you for your business
             </p>
          </div>
          
          {/* Jagged edge pattern at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-2 flex print:hidden">
            {[...Array(20)].map((_, i) => (
              <div key={i} className="flex-1 h-full bg-slate-50 rotate-45 translate-y-1" />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-4 print:hidden">
          <button 
            onClick={() => window.print()}
            className="flex items-center justify-center gap-3 px-6 h-14 bg-white border-2 border-slate-900 text-slate-900 rounded-2xl font-black hover:bg-slate-50 transition-all shadow-sm"
          >
            <Printer size={18} />
            Print Receipt
          </button>
          <Link 
            href="/pos"
            className="flex items-center justify-center gap-3 px-6 h-14 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
          >
            <Home size={18} />
            New Sale
          </Link>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success('Link copied to clipboard');
            }}
            className="flex items-center justify-center gap-3 px-6 h-12 bg-white border border-slate-200 text-slate-500 rounded-2xl font-bold text-sm hover:border-slate-400 transition-all"
          >
            <Copy size={16} />
            Copy Link
          </button>
           <button className="flex items-center justify-center gap-3 px-6 h-12 bg-white border border-slate-200 text-slate-500 rounded-2xl font-bold text-sm hover:border-slate-400 transition-all">
            <Share2 size={16} />
            Digital Copy
          </button>
        </div>
      </div>
    </div>
  )
}
