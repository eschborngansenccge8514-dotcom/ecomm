'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { 
  Search, 
  Filter, 
  Eye, 
  Trash2, 
  Clock, 
  Receipt,
  Download,
  AlertCircle,
  CheckCircle2,
  MoreVertical,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { deleteExpense, exportExpensesCsv } from '../actions'
import { toast } from 'react-hot-toast'
import { 
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Calendar
} from 'lucide-react'

const CATEGORY_FILTERS = [
  { key: 'all', label: 'All Expenses', emoji: '📊' },
  { key: 'utilities', label: 'Utilities', emoji: '💡' },
  { key: 'meals_entertainment', label: 'Meals/Ent', emoji: '🍽️' },
  { key: 'rent_premises', label: 'Rent', emoji: '🏢' },
  { key: 'marketing_advertising', label: 'Marketing', emoji: '📣' },
  { key: 'office_supplies', label: 'Supplies', emoji: '📓' },
  { key: 'transportation_vehicle', label: 'Transport', emoji: '🚗' },
]

export function ExpensesTable({ 
  expenses, 
  totalCount,
  currentCategory
}: { 
  expenses: any[],
  totalCount: number,
  currentCategory: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')

  const navigate = (params: Record<string, string | null>) => {
    const sp = new URLSearchParams(searchParams.toString())
    Object.entries(params).forEach(([k, v]) => {
      if (v) sp.set(k, v); else sp.delete(k)
    })
    // Reset page if filters change (except when paging itself)
    if (!('page' in params)) sp.delete('page')
    router.push(`/expenses?${sp.toString()}`)
  }

  const page = parseInt(searchParams.get('page') || '1')
  const totalPages = Math.ceil(totalCount / 20)
  const startDate = searchParams.get('startDate') || ''
  const endDate = searchParams.get('endDate') || ''

  const handleExport = async () => {
    const tid = toast.loading('Generating CSV...')
    try {
      const csv = await exportExpensesCsv({
        category: currentCategory,
        search: searchQuery,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      })
      
      if (!csv) {
        toast.error('No data to export', { id: tid })
        return
      }

      const blob = new Blob([csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `expenses-${format(new Date(), 'yyyy-MM-dd')}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.success('Exported successfully', { id: tid })
    } catch (err: any) {
      toast.error(err.message, { id: tid })
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    navigate({ search: searchQuery })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return
    
    const tid = toast.loading('Deleting expense...')
    try {
      await deleteExpense(id)
      toast.success('Expense deleted', { id: tid })
    } catch (err: any) {
      toast.error(err.message, { id: tid })
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters & Search */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex bg-white rounded-2xl border border-gray-100 p-1 gap-1 overflow-x-auto no-scrollbar items-center">
            {CATEGORY_FILTERS.map(f => (
              <button key={f.key}
                onClick={() => navigate({ category: f.key })}
                className={cn(
                  'px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-2 whitespace-nowrap',
                  currentCategory === f.key
                    ? 'bg-gray-900 text-white shadow-md shadow-gray-200'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                )}
              >
                <span>{f.emoji}</span>
                {f.label}
              </button>
            ))}
            <div className="w-px h-6 bg-gray-100 mx-2 shrink-0" />
            <div className="flex items-center gap-2 px-2 text-gray-400">
               <Calendar size={14} />
               <input 
                 type="date" 
                 value={startDate}
                 onChange={(e) => navigate({ startDate: e.target.value })}
                 className="bg-transparent border-none text-[11px] font-bold text-gray-900 focus:ring-0 p-0"
               />
               <span className="text-[10px] font-black">—</span>
               <input 
                 type="date" 
                 value={endDate}
                 onChange={(e) => navigate({ endDate: e.target.value })}
                 className="bg-transparent border-none text-[11px] font-bold text-gray-900 focus:ring-0 p-0"
               />
               {(startDate || endDate) && (
                 <button onClick={() => navigate({ startDate: null, endDate: null })} className="p-1 hover:bg-gray-50 rounded-md text-rose-500">
                   <Trash2 size={12} />
                 </button>
               )}
            </div>
          </div>

          <Button 
            variant="outline" 
            onClick={handleExport}
            className="rounded-2xl h-11 px-4 border-gray-200 font-bold text-xs"
          >
            <Download size={16} className="mr-2 text-gray-500" />
            Export CSV
          </Button>
        </div>

        <form onSubmit={handleSearch} className="relative group max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
          <Input 
            placeholder="Search vendor name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 h-12 rounded-2xl border-gray-100 bg-white focus:ring-2 focus:ring-blue-500/10 transition-all text-sm"
          />
        </form>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Vendor</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Total</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Deductible</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                        <Receipt size={32} />
                      </div>
                      <div>
                        <p className="text-gray-900 font-semibold">No expenses found</p>
                        <p className="text-sm text-gray-400">Upload your first receipt to get started</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense.id} className="group hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900">
                          {expense.receipt_date ? format(new Date(expense.receipt_date), 'd MMM yyyy') : 'No Date'}
                        </span>
                        <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                          <Clock size={10} />
                          {format(new Date(expense.created_at), 'h:mm a')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-xs shrink-0">
                          {expense.vendor_name?.charAt(0) || '?'}
                        </div>
                        <span className="text-sm font-bold text-gray-900 truncate max-w-[150px]">
                          {expense.vendor_name || 'Unknown Vendor'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <Badge variant="outline" className="rounded-xl bg-gray-50 border-gray-100 text-gray-600 font-bold py-1">
                        {expense.category?.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-black text-gray-900">
                        RM {Number(expense.total_amount).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-emerald-600">
                          RM {Number(expense.deductible_amount).toFixed(2)}
                        </span>
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-tight",
                          expense.tax_deductible === 'full' ? 'text-emerald-500' : 
                          expense.tax_deductible === 'none' ? 'text-rose-500' : 'text-amber-500'
                        )}>
                          {expense.tax_deductible?.replace(/_/g, ' ')} ({expense.tax_deductible_pct}%)
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {expense.status === 'confirmed' ? (
                        <div className="flex items-center gap-1.5 text-emerald-600">
                          <CheckCircle2 size={16} />
                          <span className="text-xs font-bold">Confirmed</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-600">
                          <AlertCircle size={16} />
                          <span className="text-xs font-bold">AI Review</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className={cn(
                            buttonVariants({ variant: 'ghost', size: 'icon' }),
                            "h-8 w-8 p-0 rounded-lg"
                          )}
                        >
                          <MoreVertical size={16} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={() => router.push(`/expenses/${expense.id}`)}>
                            <Eye size={14} className="mr-2" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={() => handleDelete(expense.id)}>
                            <Trash2 size={14} className="mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white p-4 rounded-[24px] border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-400">
            Showing <span className="text-gray-900">{(page - 1) * 20 + 1}</span> to <span className="text-gray-900">{Math.min(page * 20, totalCount)}</span> of <span className="text-gray-900">{totalCount}</span> expenses
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => navigate({ page: (page - 1).toString() })}
              className="rounded-xl h-9 border-gray-200 font-bold text-xs"
            >
              <ChevronLeft size={14} className="mr-1" /> Previous
            </Button>
            <div className="flex items-center gap-1">
               {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                 const p = i + 1;
                 return (
                   <button
                     key={p}
                     onClick={() => navigate({ page: p.toString() })}
                     className={cn(
                       "w-9 h-9 rounded-xl text-xs font-bold transition-all",
                       page === p ? "bg-gray-900 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"
                     )}
                   >
                     {p}
                   </button>
                 )
               })}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => navigate({ page: (page + 1).toString() })}
              className="rounded-xl h-9 border-gray-200 font-bold text-xs"
            >
              Next <ChevronRightIcon size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
