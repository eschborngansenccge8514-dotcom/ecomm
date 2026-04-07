'use client'

import { useState } from 'react'
import { 
  X, 
  Wallet,
  AlertCircle,
  Building2,
  User,
  CreditCard,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requestWithdrawal } from '../actions'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'

export function WithdrawalModal({ 
  isOpen, 
  onClose,
  balance,
  merchant
}: { 
  isOpen: boolean, 
  onClose: () => void,
  balance: number,
  merchant: any
}) {
  const [amount, setAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || isNaN(Number(amount))) return
    
    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('amount', amount)
      
      await requestWithdrawal(formData)
      toast.success('Withdrawal request submitted!')
      onClose()
      setAmount('')
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit withdrawal request')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isInsufficient = Number(amount) > balance

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-8 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
              <Wallet size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">Withdraw Funds</h2>
              <p className="text-sm text-gray-500 font-medium">Request a payout to your bank account</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-50 text-gray-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 pt-4 space-y-6">
          {/* Balance Status */}
          <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 flex items-center justify-between">
            <span className="text-sm font-bold text-blue-700">Available Balance</span>
            <span className="text-lg font-black text-blue-900">RM {balance.toFixed(2)}</span>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-wider text-gray-400 ml-1">Withdrawal Amount (RM)</Label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold group-focus-within:text-blue-600 transition-colors">RM</div>
                <Input 
                   type="number"
                   step="0.01"
                   placeholder="0.00"
                   value={amount}
                   onChange={(e) => setAmount(e.target.value)}
                   className={cn(
                     "pl-12 h-14 rounded-2xl border-gray-100 bg-gray-50/30 focus:ring-4 focus:ring-blue-500/10 text-lg font-black transition-all",
                     isInsufficient && "border-rose-200 focus:ring-rose-500/10 text-rose-600"
                   )}
                   autoFocus
                />
              </div>
              {isInsufficient && (
                <div className="flex items-center gap-2 text-rose-600 mt-2 px-1">
                  <AlertCircle size={14} />
                  <span className="text-xs font-bold">Insufficient balance</span>
                </div>
              )}
            </div>

            {/* Bank Info Context */}
            <div className="space-y-3 p-5 bg-gray-50 rounded-2xl border border-gray-100">
               <p className="text-[10px] font-black uppercase tracking-[0.1em] text-gray-400 mb-2">Payout Destination (from settings)</p>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1.5"><Building2 size={10} /> Bank Name</span>
                    <p className="text-xs font-bold text-gray-900 truncate">{merchant?.bank_name || 'Not Configured'}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1.5"><CreditCard size={10} /> Account Number</span>
                    <p className="text-xs font-bold text-gray-900 truncate">{merchant?.bank_account_number || 'Not Configured'}</p>
                  </div>
                  <div className="col-span-2 space-y-0.5 pt-1 border-t border-gray-200/50">
                    <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1.5"><User size={10} /> Account Holder</span>
                    <p className="text-xs font-bold text-gray-900 truncate">{merchant?.bank_account_name || 'Not Configured'}</p>
                  </div>
               </div>
               {!merchant?.bank_account_number && (
                 <div className="pt-2">
                    <p className="text-[10px] text-amber-600 font-bold flex items-center gap-1.5">
                      <AlertCircle size={12} /> Please update your bank details in Store Settings first.
                    </p>
                 </div>
               )}
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
                disabled={isSubmitting || !amount || isInsufficient || !merchant?.bank_account_number}
                className="flex-[2] rounded-2xl h-14 bg-gray-900 font-bold hover:bg-gray-800 shadow-xl shadow-gray-200/50"
             >
               {isSubmitting ? (
                 <>
                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                   Processing...
                 </>
               ) : (
                 'Submit Withdrawal'
               )}
             </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
