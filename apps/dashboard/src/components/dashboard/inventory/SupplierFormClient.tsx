'use client'

import React, { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Truck, 
  Save, 
  Trash2, 
  Plus, 
  Search, 
  Check, 
  X,
  Package,
  DollarSign,
  ChevronLeft
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { 
  createSupplier, 
  updateSupplier, 
  deleteSupplier,
  getProductSuppliers,
  linkProductSupplier,
  unlinkProductSupplier
} from '@/lib/supplier-actions'
import { searchProducts } from '@/lib/inventory-actions'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'

export function SupplierFormClient({ initialData }: { initialData?: any }) {
  const router = useRouter()
  const [formData, setFormData] = useState(initialData ?? {
    name: '',
    code: '',
    email: '',
    phone: '',
    lead_time_days: 7,
    payment_terms: '',
    contact_person: '',
    notes: '',
    is_active: true,
    preferred_contact_method: 'email'
  })
  
  const [links, setLinks] = useState<any[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (initialData?.id) {
      // In a real app we'd fetch product links specifically for THIS supplier
      // For now we'll just handle the supplier CRUD
    }
  }, [initialData])

  const handleSave = () => {
    startTransition(async () => {
      try {
        if (initialData?.id) {
          await updateSupplier(initialData.id, formData)
          toast.success('Supplier updated')
        } else {
          await createSupplier(formData)
          toast.success('Supplier created')
        }
        router.push('/inventory/suppliers')
        router.refresh()
      } catch (error) {
        toast.error('Failed to save supplier')
        console.error(error)
      }
    })
  }

  const handleDelete = () => {
    if (!confirm('Are you sure you want to delete this supplier?')) return
    startTransition(async () => {
      try {
        await deleteSupplier(initialData.id)
        toast.success('Supplier deleted')
        router.push('/inventory/suppliers')
      } catch (error) {
        toast.error('Failed to delete supplier')
      }
    })
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ChevronLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {initialData ? 'Edit Supplier' : 'New Supplier'}
            </h1>
            <p className="text-sm text-gray-500">Configure vendor details and procurement rules.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {initialData && (
            <Button variant="ghost" onClick={handleDelete} className="text-red-500 hover:text-red-600 hover:bg-red-50">
              <Trash2 size={18} className="mr-2" />
              Delete
            </Button>
          )}
          <Button onClick={handleSave} disabled={isPending} className="rounded-xl px-6">
            <Save size={18} className="mr-2" />
            {isPending ? 'Saving...' : 'Save Supplier'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Supplier Name</Label>
                <Input id="name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Acme Wholesale" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Supplier Code</Label>
                <Input id="code" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} placeholder="e.g. SUP-001" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact">Contact Person</Label>
                <Input id="contact" value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead">Default Lead Time (Days)</Label>
                <Input id="lead" type="number" value={formData.lead_time_days} onChange={e => setFormData({...formData, lead_time_days: parseInt(e.target.value)})} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Communication & Payment</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="terms">Payment Terms</Label>
                <Input id="terms" value={formData.payment_terms} onChange={e => setFormData({...formData, payment_terms: e.target.value})} placeholder="e.g. Net 30, COD" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} rows={4} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold">Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="active">Active Supplier</Label>
                <input 
                  type="checkbox" 
                  id="active" 
                  checked={formData.is_active} 
                  onChange={e => setFormData({...formData, is_active: e.target.checked})} 
                  className="w-5 h-5 rounded accent-blue-600"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-gray-50">
                <Label htmlFor="contact_method">PO Contact Method</Label>
                <select 
                  id="contact_method"
                  value={formData.preferred_contact_method}
                  onChange={e => setFormData({...formData, preferred_contact_method: e.target.value})}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
                <p className="text-[10px] text-gray-400">Channel used to send digital POs.</p>
              </div>
            </CardContent>
          </Card>

          {/* Product Linking Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold">Product Catalog</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-500 mb-4 italic">
                Link products to this supplier after saving to manage per-item costs and lead times.
              </div>
              {initialData?.id ? (
                <p className="text-xs text-blue-600 font-semibold cursor-pointer hover:underline">
                  Coming soon: Interactive catalog management
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
