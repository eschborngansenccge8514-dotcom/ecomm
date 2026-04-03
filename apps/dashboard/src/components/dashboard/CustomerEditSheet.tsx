'use client'
import { useState, useEffect } from 'react'
import { 
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter 
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

export function CustomerEditSheet({ customer, open, onOpenChange, onSuccess }: {
  customer: any
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (customer) {
      setFormData({
        full_name: customer.full_name || '',
        email: customer.email || '',
        phone: customer.phone || '',
      })
      setError(null)
    }
  }, [customer])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
        })
        .eq('id', customer.id)

      if (updateError) throw updateError
      
      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      setError(err.message || 'Failed to update customer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md bg-white border-l border-gray-100 p-0 overflow-hidden flex flex-col">
        <SheetHeader className="p-8 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4">
            <UserIcon size={24} />
          </div>
          <SheetTitle className="text-2xl font-black text-gray-900 tracking-tight">Edit Profile</SheetTitle>
          <SheetDescription className="text-gray-500 font-medium">
            Update customer information and contact details.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-8 py-4 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Full Name</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={e => setFormData(v => ({ ...v, full_name: e.target.value }))}
                className="h-12 rounded-xl border-gray-100 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all font-bold"
                placeholder="Enter customer name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={e => setFormData(v => ({ ...v, email: e.target.value }))}
                className="h-12 rounded-xl border-gray-100 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all font-bold"
                placeholder="email@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Phone Number</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={e => setFormData(v => ({ ...v, phone: e.target.value }))}
                className="h-12 rounded-xl border-gray-100 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all font-bold"
                placeholder="+60 12-345 6789"
              />
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 flex items-start gap-3 text-rose-600 animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p className="text-sm font-bold">{error}</p>
            </div>
          )}
        </form>

        <SheetFooter className="p-8 pt-4 bg-gray-50/50 border-t border-gray-100">
          <div className="flex gap-3 w-full">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1 h-12 rounded-xl border-gray-200 font-black text-[11px] uppercase tracking-widest hover:bg-white"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={loading}
              className="flex-1 h-12 rounded-xl bg-gray-900 hover:bg-black text-white font-black text-[11px] uppercase tracking-widest transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function UserIcon({ size }: { size: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}
