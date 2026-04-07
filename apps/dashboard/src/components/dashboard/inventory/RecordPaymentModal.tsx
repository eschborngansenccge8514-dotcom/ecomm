'use client'

import { useState, useTransition } from 'react'
import {
  X,
  DollarSign,
  CreditCard,
  Wallet,
  FileText,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { recordPurchasePayment } from '@/lib/purchase-order-actions'
import { toast } from 'react-hot-toast'

interface RecordPaymentModalProps {
  po: any
  onClose: () => void
}

export function RecordPaymentModal({ po, onClose }: RecordPaymentModalProps) {
  const remainingBalance = po.total - (po.amount_paid || 0)
  
  const [amount, setAmount] = useState(remainingBalance.toString())
  const [method, setMethod] = useState('Bank Transfer')
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleRecord = () => {
    const paymentAmount = parseFloat(amount)
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    startTransition(async () => {
      try {
        await recordPurchasePayment({
          poId: po.id,
          amount: paymentAmount,
          method,
          notes
        })
        toast.success(`Payment of RM ${paymentAmount.toFixed(2)} recorded`)
        onClose()
      } catch (error) {
        toast.error('Failed to record payment')
        console.error(error)
      }
    })
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-8 bg-slate-900 text-white flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20">
               <DollarSign size={32} className="text-white" />
             </div>
             <div>
               <DialogTitle className="text-2xl font-black">Record Payment</DialogTitle>
               <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">PO: {po.po_number}</p>
             </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-slate-400 hover:text-white hover:bg-slate-800">
            <X size={24} />
          </Button>
        </DialogHeader>

        <div className="p-8 space-y-8">
          <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100/50 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-black text-blue-400 tracking-widest">Remaining Balance</span>
              <span className="text-2xl font-black text-blue-700">RM {remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-blue-600 h-full transition-all duration-700 ease-out rounded-full" 
                style={{ width: `${Math.min((po.amount_paid / po.total) * 100, 100)}%` }} 
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-xs uppercase font-black text-gray-400 tracking-[0.2em] pl-1">Payment Amount (RM)</Label>
              <div className="relative">
                <Input 
                  type="number" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)}
                  className="pl-14 h-16 text-xl font-black rounded-2xl border-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-gray-50/30"
                />
                <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-500" size={24} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-xs uppercase font-black text-gray-400 tracking-[0.2em] pl-1">Payment Method</Label>
                <Select value={method} onValueChange={(val) => val && setMethod(val)}>
                  <SelectTrigger className="h-16 rounded-2xl border-gray-100 bg-white font-bold text-gray-700 w-full flex shadow-sm">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-gray-100 shadow-2xl">
                    <SelectItem value="Bank Transfer" className="font-bold py-4 px-4"><div className="flex items-center gap-3"><CreditCard size={18} className="text-blue-500" /> Bank Transfer</div></SelectItem>
                    <SelectItem value="Cash" className="font-bold py-4 px-4"><div className="flex items-center gap-3"><Wallet size={18} className="text-green-500" /> Cash</div></SelectItem>
                    <SelectItem value="Cheque" className="font-bold py-4 px-4"><div className="flex items-center gap-3"><FileText size={18} className="text-orange-500" /> Cheque</div></SelectItem>
                    <SelectItem value="Credit Card" className="font-bold py-4 px-4"><div className="flex items-center gap-3"><CreditCard size={18} className="text-purple-500" /> Credit Card</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-xs uppercase font-black text-gray-400 tracking-[0.2em] pl-1">Notes / Reference</Label>
                <Input 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  placeholder="Ref #, Bank info" 
                  className="rounded-2xl border-gray-100 h-16 bg-gray-50/50 text-base font-bold px-6 shadow-inner"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 border-t border-gray-100 bg-gray-50/50 flex flex-col gap-4">
           <Button onClick={handleRecord} disabled={isPending} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl h-16 text-lg font-black shadow-xl shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-3">
             <DollarSign size={20} />
             {isPending ? 'Processing Payment...' : `Pay RM ${parseFloat(amount || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
           </Button>
           <Button variant="ghost" onClick={onClose} className="w-full rounded-2xl h-12 font-black text-gray-400 hover:text-gray-900 uppercase tracking-widest text-[10px]">
             Cancel
           </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
