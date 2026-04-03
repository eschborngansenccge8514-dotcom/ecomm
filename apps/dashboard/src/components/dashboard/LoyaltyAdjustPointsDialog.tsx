'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import toast from 'react-hot-toast'
import { ShieldCheck, Info } from 'lucide-react'

interface LoyaltyAdjustPointsDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  customer: {
    id: string
    full_name: string
    current_balance: number
  } | null
  merchantId: string
}

export function LoyaltyAdjustPointsDialog({
  isOpen,
  onClose,
  onSuccess,
  customer,
  merchantId
}: LoyaltyAdjustPointsDialogProps) {
  const [points, setPoints] = useState<string>('')
  const [type, setType] = useState<'add' | 'subtract'>('add')
  const [reason, setReason] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleSubmit = async () => {
    if (!customer || !points || !reason) {
      toast.error('Please fill in all fields')
      return
    }

    const pointsNum = parseInt(points)
    if (isNaN(pointsNum) || pointsNum <= 0) {
      toast.error('Please enter a valid number of points')
      return
    }

    setLoading(true)
    const delta = type === 'add' ? pointsNum : -pointsNum
    const newBalance = customer.current_balance + delta

    if (newBalance < 0) {
      toast.error('Customer balance cannot be negative')
      setLoading(false)
      return
    }

    try {
      // 1. Update balance
      const { error: updateError } = await supabase
        .from('loyalty_points')
        .update({ 
          balance: newBalance,
          total_earned: type === 'add' ? undefined : undefined, // We don't necessarily update total_earned for manual adjustments unless it's a "grant"
          updated_at: new Date().toISOString()
        })
        .eq('customer_id', customer.id)
        .eq('merchant_id', merchantId)

      if (updateError) throw updateError

      // 2. Create transaction record
      const { error: txnError } = await supabase
        .from('points_transactions')
        .insert({
          customer_id: customer.id,
          merchant_id: merchantId,
          type: type === 'add' ? 'earn' : 'redeem',
          points_delta: delta,
          balance_after: newBalance,
          description: `Manual adjustment: ${reason}`,
          metadata: { adjustment_type: 'manual', admin_action: true }
        })

      if (txnError) throw txnError

      toast.success(`Successfully ${type === 'add' ? 'added' : 'deducted'} ${pointsNum} points`)
      onSuccess()
      onClose()
      setPoints('')
      setReason('')
    } catch (error: any) {
      console.error('Adjustment error:', error)
      toast.error(error.message || 'Failed to adjust points')
    } finally {
      setLoading(false)
    }
  }

  if (!customer) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl border-none shadow-2xl bg-white/95 backdrop-blur-xl">
        <DialogHeader>
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-2">
            <ShieldCheck size={24} />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">Adjust Points</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Updating balance for <span className="font-semibold text-foreground">{customer.full_name}</span>
          </p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="bg-blue-50/50 rounded-2xl p-4 flex items-start gap-3 border border-blue-100/50">
            <Info className="text-blue-600 mt-0.5" size={16} />
            <div className="space-y-1">
              <p className="text-xs font-medium text-blue-900 uppercase tracking-wider">Current Balance</p>
              <p className="text-2xl font-bold text-blue-700">{customer.current_balance.toLocaleString()} <span className="text-sm font-normal opacity-70">pts</span></p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Type</Label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add Points</SelectItem>
                  <SelectItem value="subtract">Deduct Points</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Amount</Label>
              <Input
                type="number"
                placeholder="0"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                className="rounded-xl border-gray-100 bg-gray-50/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Reason for Adjustment</Label>
            <Input
              placeholder="e.g. Customer support resolution, Promo fix"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="rounded-xl border-gray-100 bg-gray-50/50"
            />
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="ghost" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-8 shadow-lg shadow-blue-200"
          >
            {loading ? 'Processing...' : 'Confirm Adjustment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
