'use client'

import React, { useState, useTransition } from 'react'
import { 
  X, 
  MapPin, 
  Mail, 
  Phone, 
  User, 
  Building2,
  Save,
  Loader2
} from 'lucide-react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createSupplier } from '@/lib/supplier-actions'
import { toast } from 'react-hot-toast'

export function SupplierAddModal({ 
  isOpen, 
  onClose, 
  onSuccess 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: (newSupplier: any) => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    contactPerson: '',
    address: '',
    notes: ''
  })
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.code) {
      toast.error('Name and Code are required')
      return
    }

    startTransition(async () => {
      try {
        const result = await createSupplier({
          name: formData.name,
          code: formData.code,
          email: formData.email,
          phone: formData.phone,
          contactPerson: formData.contactPerson,
          address: formData.address,
          notes: formData.notes
        })
        
        toast.success(`Supplier "${result.name}" added successfully`)
        onSuccess(result)
        onClose()
        setFormData({
          name: '',
          code: '',
          email: '',
          phone: '',
          contactPerson: '',
          address: '',
          notes: ''
        })
      } catch (err: any) {
        toast.error(err.message || 'Failed to create supplier')
      }
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="bg-blue-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Building2 size={24} />
                Add New Supplier
              </DialogTitle>
              <button 
                type="button" 
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-blue-100 text-xs mt-1 font-medium italic opacity-80">
              Create a new vendor profile for procurement.
            </p>
          </DialogHeader>

          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-[10px] font-bold uppercase text-gray-400">Supplier Name *</Label>
                <Input 
                  id="name" 
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Acme Wholesale"
                  className="rounded-xl border-gray-100 focus:border-blue-500 shadow-sm"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code" className="text-[10px] font-bold uppercase text-gray-400">Supplier Code *</Label>
                <Input 
                  id="code" 
                  value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g. SUP-100"
                  className="rounded-xl border-gray-100 focus:border-blue-500 shadow-sm font-mono text-xs uppercase"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[10px] font-bold uppercase text-gray-400">Email Address</Label>
                <div className="relative">
                  <Input 
                    id="email" 
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="sales@vendor.com"
                    className="pl-9 rounded-xl border-gray-100 shadow-sm"
                  />
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-[10px] font-bold uppercase text-gray-400">Phone Number</Label>
                <div className="relative">
                  <Input 
                    id="phone" 
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+60 12-345 6789"
                    className="pl-9 rounded-xl border-gray-100 shadow-sm"
                  />
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact" className="text-[10px] font-bold uppercase text-gray-400">Contact Person</Label>
              <div className="relative">
                <Input 
                  id="contact" 
                  value={formData.contactPerson}
                  onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                  placeholder="First and last name"
                  className="pl-9 rounded-xl border-gray-100 shadow-sm"
                />
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="text-[10px] font-bold uppercase text-gray-400">Physical Address</Label>
              <div className="relative">
                <Textarea 
                  id="address" 
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street, City, Postcode, State"
                  className="pl-9 rounded-xl border-gray-100 shadow-sm resize-none h-20"
                />
                <MapPin size={14} className="absolute left-3 top-3 text-gray-400" />
              </div>
            </div>
          </div>

          <DialogFooter className="bg-gray-50 p-6 flex gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="flex-1 rounded-xl h-11 font-bold text-gray-500 border-gray-200"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isPending}
              className="flex-1 rounded-xl h-11 font-bold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100"
            >
              {isPending ? (
                <>
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save size={18} className="mr-2" />
                  Create Supplier
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
