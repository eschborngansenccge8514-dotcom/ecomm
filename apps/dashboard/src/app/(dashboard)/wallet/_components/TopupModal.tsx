'use client'

import { useState } from 'react'
import { 
  X, 
  Wallet,
  Zap,
  CreditCard,
  Building2,
  Loader2,
  CheckCircle2,
  ArrowRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { createTopupSession } from '../topup-actions'
import { toast } from 'react-hot-toast'
import Script from 'next/script'

export function TopupModal({ 
  isOpen, 
  onClose,
  merchant 
}: { 
  isOpen: boolean, 
  onClose: () => void,
  merchant: any
}) {
  const [amount, setAmount] = useState('')
  const [gateway, setGateway] = useState<'razorpay' | 'billplz'>('razorpay')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleTopup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    setIsSubmitting(true)
    try {
      const data = await createTopupSession(Number(amount), gateway)
      
      if (gateway === 'razorpay') {
        const options = {
          key: data.razorpayKeyId,
          amount: data.amount,
          currency: data.currency,
          name: 'Senang Store',
          description: `Wallet Top-up for ${merchant.store_name}`,
          order_id: data.razorpayOrderId,
          handler: function (response: any) {
            toast.success('Payment successful! Your wallet will be updated shortly.')
            onClose()
            setTimeout(() => window.location.reload(), 2000)
          },
          prefill: {
            name: merchant.store_name,
            email: merchant.email || '',
            contact: merchant.phone || ''
          },
          theme: { color: "#2563eb" }
        }
        const rzp = new (window as any).Razorpay(options)
        rzp.open()
      } else if (gateway === 'billplz') {
        // Redirect to Billplz URL
        window.location.href = data.url
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate top-up')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="p-8 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                <Zap size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight">Add Funds</h2>
                <p className="text-sm text-gray-500 font-medium">Top up your merchant wallet instantly</p>
              </div>
            </div>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-50 text-gray-400 transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleTopup} className="p-8 pt-4 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wider text-gray-400 ml-1">Top-up Amount (RM)</Label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold group-focus-within:text-blue-600 transition-colors">RM</div>
                  <Input 
                    type="number"
                    step="0.01"
                    placeholder="50.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-12 h-14 rounded-2xl border-gray-100 bg-gray-50/30 focus:ring-4 focus:ring-blue-500/10 text-lg font-black transition-all"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wider text-gray-400 ml-1">Payment Method</Label>
                <div className="grid grid-cols-2 gap-3">
                   <button
                     type="button"
                     onClick={() => setGateway('razorpay')}
                     className={cn(
                       "p-4 rounded-2xl border-2 transition-all text-left relative group",
                       gateway === 'razorpay' ? "border-blue-600 bg-blue-50" : "border-gray-50 bg-gray-50/50 hover:border-gray-200"
                     )}
                   >
                     <CreditCard size={20} className={cn("mb-2", gateway === 'razorpay' ? "text-blue-600" : "text-gray-400")} />
                     <p className={cn("text-xs font-black", gateway === 'razorpay' ? "text-blue-900" : "text-gray-400")}>Razorpay</p>
                     <p className="text-[10px] font-bold text-gray-400">Cards & FPX</p>
                     {gateway === 'razorpay' && <CheckCircle2 size={16} className="absolute top-3 right-3 text-blue-600" />}
                   </button>

                   <button
                     type="button"
                     onClick={() => setGateway('billplz')}
                     className={cn(
                       "p-4 rounded-2xl border-2 transition-all text-left relative group",
                       gateway === 'billplz' ? "border-emerald-600 bg-emerald-50" : "border-gray-50 bg-gray-50/50 hover:border-gray-200"
                     )}
                   >
                     <Building2 size={20} className={cn("mb-2", gateway === 'billplz' ? "text-emerald-600" : "text-gray-400")} />
                     <p className={cn("text-xs font-black", gateway === 'billplz' ? "text-emerald-900" : "text-gray-400")}>Billplz</p>
                     <p className="text-[10px] font-bold text-gray-400">FPX Direct</p>
                     {gateway === 'billplz' && <CheckCircle2 size={16} className="absolute top-3 right-3 text-emerald-600" />}
                   </button>
                </div>
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={onClose} 
                className="flex-1 rounded-2xl h-14 font-bold text-gray-500 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || !amount || Number(amount) <= 0}
                className={cn(
                  "flex-[2] rounded-2xl h-14 font-bold shadow-xl transition-all",
                  gateway === 'razorpay' ? "bg-blue-600 hover:bg-blue-700 shadow-blue-100" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100"
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    Pay RM {Number(amount || 0).toFixed(2)}
                    <ArrowRight size={18} className="ml-2" />
                  </>
                )}
              </Button>
            </div>
            
            <p className="text-[10px] text-center text-gray-400 font-bold px-8">
              By topping up, you agree to our merchant terms of service. Funds are typically credited instantly after successful payment.
            </p>
          </form>
        </div>
      </div>
    </>
  )
}
