'use client'

import React, { useState, useEffect } from "react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { updateAccount } from "../../actions"
import { toast } from "react-hot-toast"

export function EditAccountDialog({ 
  account, 
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange
}: { 
  account: any, 
  open?: boolean,
  onOpenChange?: (open: boolean) => void
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  console.log("EditAccountDialog render", account?.name, "open:", controlledOpen);
  
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = controlledOnOpenChange ?? setUncontrolledOpen
  const [isLoading, setIsLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    code: account.code,
    name: account.name,
    type: account.type,
    normalBalance: account.normalBalance,
    description: account.description || ''
  })

  useEffect(() => {
    setFormData({
      code: account.code,
      name: account.name,
      type: account.type,
      normalBalance: account.normalBalance,
      description: account.description || ''
    })
  }, [account])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      await updateAccount(account.id, formData)
      toast.success("Account updated successfully")
      setOpen(false)
    } catch (error: any) {
      toast.error(error.message || "Failed to update account")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-xl rounded-[2rem]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">Edit Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-code" className="font-bold text-xs uppercase tracking-widest text-gray-400">Account Code</Label>
              <Input 
                id="edit-code" 
                value={formData.code} 
                onChange={e => setFormData(prev => ({ ...prev, code: e.target.value }))}
                placeholder="e.g. 1130"
                required
                className="rounded-xl border-gray-100 font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type" className="font-bold text-xs uppercase tracking-widest text-gray-400">Type</Label>
              <Select 
                value={formData.type} 
                onValueChange={v => setFormData(prev => ({ 
                    ...prev, 
                    type: v || 'ASSET',
                }))}
                disabled={account.isSystemAccount}
              >
                <SelectTrigger id="edit-type" className="rounded-xl border-gray-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-100">
                  <SelectItem value="ASSET">Asset</SelectItem>
                  <SelectItem value="LIABILITY">Liability</SelectItem>
                  <SelectItem value="EQUITY">Equity</SelectItem>
                  <SelectItem value="REVENUE">Revenue</SelectItem>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-name" className="font-bold text-xs uppercase tracking-widest text-gray-400">Account Name</Label>
            <Input 
              id="edit-name" 
              value={formData.name} 
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Cash in Hand"
              required
              className="rounded-xl border-gray-100"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-balance" className="font-bold text-xs uppercase tracking-widest text-gray-400">Normal Balance</Label>
            <Select 
              value={formData.normalBalance} 
              onValueChange={v => setFormData(prev => ({ ...prev, normalBalance: v || 'DEBIT' }))}
              disabled={account.isSystemAccount}
            >
              <SelectTrigger id="edit-balance" className="rounded-xl border-gray-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-gray-100">
                <SelectItem value="DEBIT">Debit</SelectItem>
                <SelectItem value="CREDIT">Credit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description" className="font-bold text-xs uppercase tracking-widest text-gray-400">Description (Optional)</Label>
            <Input 
              id="edit-description" 
              value={formData.description} 
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of usage..."
              className="rounded-xl border-gray-100"
            />
          </div>

          <DialogFooter>
            <Button 
                type="submit" 
                disabled={isLoading}
                className="w-full h-12 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
