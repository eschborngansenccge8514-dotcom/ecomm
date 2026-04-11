'use client'

import { useState } from "react"
import { Plus } from "lucide-react"
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
import { createAccount } from "../../actions"
import { toast } from "react-hot-toast"

export function AddAccountDialog({ type: initialType }: { type?: string }) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  const [formData, setFormData] = useState<{
    code: string;
    name: string;
    type: string;
    normalBalance: string;
    description: string;
  }>({
    code: '',
    name: '',
    type: initialType || 'ASSET',
    normalBalance: initialType === 'LIABILITY' || initialType === 'EQUITY' || initialType === 'REVENUE' ? 'CREDIT' : 'DEBIT',
    description: ''
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      await createAccount(formData)
      toast.success("Account created successfully")
      setOpen(false)
      setFormData({
        code: '',
        name: '',
        type: initialType || 'ASSET',
        normalBalance: initialType === 'LIABILITY' || initialType === 'EQUITY' || initialType === 'REVENUE' ? 'CREDIT' : 'DEBIT',
        description: ''
      })
    } catch (error: any) {
      toast.error(error.message || "Failed to create account")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <button className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
          <Plus size={16} className="text-gray-600" />
        </button>
      } />
      <DialogContent className="sm:max-w-xl rounded-[2rem]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">Add New Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code" className="font-bold text-xs uppercase tracking-widest text-gray-400">Account Code</Label>
              <Input 
                id="code" 
                value={formData.code} 
                onChange={e => setFormData(prev => ({ ...prev, code: e.target.value }))}
                placeholder="e.g. 1130"
                required
                className="rounded-xl border-gray-100 font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type" className="font-bold text-xs uppercase tracking-widest text-gray-400">Type</Label>
              <Select 
                value={formData.type} 
                onValueChange={v => setFormData(prev => ({ 
                    ...prev, 
                    type: v || 'ASSET',
                    normalBalance: v === 'LIABILITY' || v === 'EQUITY' || v === 'REVENUE' ? 'CREDIT' : 'DEBIT'
                }))}
              >
                <SelectTrigger id="type" className="rounded-xl border-gray-100">
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
            <Label htmlFor="name" className="font-bold text-xs uppercase tracking-widest text-gray-400">Account Name</Label>
            <Input 
              id="name" 
              value={formData.name} 
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Cash in Hand"
              required
              className="rounded-xl border-gray-100"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="balance" className="font-bold text-xs uppercase tracking-widest text-gray-400">Normal Balance</Label>
            <Select 
              value={formData.normalBalance} 
              onValueChange={v => setFormData(prev => ({ ...prev, normalBalance: v || 'DEBIT' }))}
            >
              <SelectTrigger id="balance" className="rounded-xl border-gray-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-gray-100">
                <SelectItem value="DEBIT">Debit</SelectItem>
                <SelectItem value="CREDIT">Credit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="font-bold text-xs uppercase tracking-widest text-gray-400">Description (Optional)</Label>
            <Input 
              id="description" 
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
              {isLoading ? 'Creating...' : 'Create Account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
