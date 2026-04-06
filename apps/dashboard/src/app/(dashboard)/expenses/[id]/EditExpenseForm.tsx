'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Save, 
  Trash2, 
  Loader2, 
  Calculator,
  RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { updateExpense, deleteExpense } from '../actions'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'

const TAX_TYPES = [
  { value: 'full', label: '100% Deductible (S33 ITA)', pct: 100 },
  { value: 'partial', label: '50% Entertainment (S39 ITA)', pct: 50 },
  { value: 'none', label: 'Non-Deductible', pct: 0 },
  { value: 'capital_allowance', label: 'Capital Allowance', pct: 100 },
]

export function EditExpenseForm({ expense }: { expense: any }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState({
    vendorName: expense.vendor_name,
    receiptDate: expense.receipt_date ? new Date(expense.receipt_date).toISOString().split('T')[0] : '',
    totalAmount: expense.total_amount,
    category: expense.category,
    taxDeductible: expense.tax_deductible,
    taxDeductiblePct: expense.tax_deductible_pct,
    notes: expense.notes || ''
  })

  const updateField = (field: string, value: any) => {
    setData(prev => ({ ...prev, [field]: value }))
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await updateExpense(expense.id, {
        vendor_name: data.vendorName,
        receipt_date: data.receiptDate,
        total_amount: Number(data.totalAmount),
        category: data.category,
        tax_deductible: data.taxDeductible,
        tax_deductible_pct: data.taxDeductiblePct,
        notes: data.notes
      })
      toast.success('Record updated')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this expense?')) return
    setLoading(true)
    try {
      await deleteExpense(expense.id)
      toast.success('Expense deleted')
      router.push('/expenses')
    } catch (err: any) {
      toast.error(err.message)
      setLoading(false)
    }
  }

  const deductibleAmt = Number(data.totalAmount) * (Number(data.taxDeductiblePct) / 100)

  return (
    <form onSubmit={handleUpdate} className="space-y-6 animate-in slide-in-from-right-4 duration-500 delay-200">
       <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 col-span-2">
            <Label className="text-xs font-bold text-gray-400">Vendor</Label>
            <Input 
              value={data.vendorName} 
              onChange={(e) => updateField('vendorName', e.target.value)}
              className="h-12 rounded-2xl border-gray-100"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold text-gray-400">Receipt Date</Label>
            <Input 
              type="date"
              value={data.receiptDate} 
              onChange={(e) => updateField('receiptDate', e.target.value)}
              className="h-12 rounded-2xl border-gray-100"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold text-gray-400">Category</Label>
            <Select 
              value={data.category} 
              onValueChange={(v) => updateField('category', v)}
            >
              <SelectTrigger className="h-12 rounded-2xl border-gray-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="utilities">💡 Utilities</SelectItem>
                <SelectItem value="meals_entertainment">🍽️ Meals/Entertainment</SelectItem>
                <SelectItem value="rent_premises">🏢 Rent</SelectItem>
                <SelectItem value="marketing_advertising">📣 Marketing</SelectItem>
                <SelectItem value="office_supplies">📓 Office Supplies</SelectItem>
                <SelectItem value="software_subscriptions">💻 Software</SelectItem>
                <SelectItem value="transportation_vehicle">🚗 Transportation</SelectItem>
                <SelectItem value="other">📦 Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold text-gray-400">Total Amount</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">RM</span>
              <Input 
                type="number" step="0.01"
                value={data.totalAmount} 
                onChange={(e) => updateField('totalAmount', e.target.value)}
                className="h-12 rounded-2xl border-gray-100 pl-12"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold text-gray-400">Tax Type</Label>
            <Select 
              value={data.taxDeductible} 
              onValueChange={(v) => {
                const type = TAX_TYPES.find(t => t.value === v)
                updateField('taxDeductible', v)
                updateField('taxDeductiblePct', type?.pct || 100)
              }}
            >
              <SelectTrigger className="h-12 rounded-2xl border-gray-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {TAX_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
       </div>

       <div className="p-6 bg-emerald-50/50 rounded-[32px] border border-emerald-100/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 animate-pulse">
                <Calculator size={20} />
             </div>
             <div className="flex flex-col">
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Deductible</span>
                <span className="text-2xl font-black text-gray-900 tracking-tight">RM {deductibleAmt.toFixed(2)}</span>
             </div>
          </div>
          <RefreshCw className={cn("text-emerald-300", loading && "animate-spin")} size={24} />
       </div>

       <div className="space-y-2">
          <Label className="text-xs font-bold text-gray-400">Additional Notes</Label>
          <textarea 
            value={data.notes} 
            onChange={(e) => updateField('notes', e.target.value)}
            className="w-full h-24 p-4 rounded-3xl border border-gray-100 focus:ring-blue-500/10 text-sm font-medium resize-none"
            placeholder="Add any internal remarks..."
          />
       </div>

       <div className="flex gap-4">
          <Button 
            disabled={loading}
            className="flex-1 rounded-[24px] h-14 bg-gray-900 hover:bg-gray-800 text-white font-black text-lg gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
            Update Record
          </Button>
          <Button 
            type="button"
            variant="outline"
            disabled={loading}
            onClick={handleDelete}
            className="w-14 h-14 rounded-[24px] border-gray-100 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-500 shrink-0 transition-all"
          >
            <Trash2 size={20} />
          </Button>
       </div>
    </form>
  )
}
