'use client'

import { useState, useEffect } from "react"
import { 
  ArrowLeft,
  Trash2, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Scale, 
  ArrowRightLeft,
  Calendar,
  FileText,
  Calculator,
  Save,
  BookOpen,
  Plus
} from "lucide-react"
import { updateJournalEntry, getAccounts } from "../../actions"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"

export function JournalEntryDetail({ entry }: { entry: any }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<any[]>([])
  
  const [date, setDate] = useState(new Date(entry.date).toISOString().split('T')[0])
  const [description, setDescription] = useState(entry.description)
  const [lines, setLines] = useState(
    entry.lines.map((l: any) => ({
      accountId: l.accountId,
      debit: Number(l.debit),
      credit: Number(l.credit),
      id: l.id
    }))
  )

  useEffect(() => {
    getAccounts().then(setAccounts)
  }, [])

  const addLine = () => setLines([...lines, { accountId: "", debit: 0, credit: 0 }])
  const removeLine = (index: number) => setLines(lines.filter((_, i) => i !== index))

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...lines]
    newLines[index] = { ...newLines[index], [field]: value }
    
    if (field === 'debit' && value > 0) newLines[index].credit = 0
    if (field === 'credit' && value > 0) newLines[index].debit = 0
    
    setLines(newLines)
  }

  const totalDebits = lines.reduce((sum, l) => sum + Number(l.debit), 0)
  const totalCredits = lines.reduce((sum, l) => sum + Number(l.credit), 0)
  const difference = totalDebits - totalCredits
  const isBalanced = Math.abs(difference) < 0.01 && totalDebits > 0

  const autoBalance = (index: number) => {
    const currentDiff = totalDebits - totalCredits
    const line = lines[index]
    
    const newLines = [...lines]
    if (currentDiff > 0) {
        newLines[index].credit = Number(line.credit) + currentDiff
        newLines[index].debit = 0
    } else {
        newLines[index].debit = Number(line.debit) + Math.abs(currentDiff)
        newLines[index].credit = 0
    }
    setLines(newLines)
  }

  const handleSave = async () => {
    if (!description) return toast.error("Please enter a description")
    if (!isBalanced) return toast.error("Journal entry must be balanced (Debits = Credits)")
    if (lines.some(l => !l.accountId)) return toast.error("Please select an account for all lines")

    try {
      setLoading(true)
      await updateJournalEntry(entry.id, {
        date: new Date(date),
        description,
        lines: lines.map(l => ({
            ...l,
            debit: Number(l.debit),
            credit: Number(l.credit)
        }))
      })
      toast.success("Journal entry updated successfully")
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || "Failed to update entry")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <Link 
          href="/accounting/journal" 
          className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm"
        >
          <ArrowLeft size={16} /> Back to Journal
        </Link>

        <div className={cn(
            "px-6 py-2 rounded-2xl flex items-center gap-2 border-2 transition-all outline-none",
            isBalanced ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-600" : "bg-amber-500/10 border-amber-500/50 text-amber-600"
        )}>
            {isBalanced ? <CheckCircle2 size={20} /> : <Scale size={20} />}
            <span className="font-black text-xs uppercase tracking-widest text-gray-900">
                {isBalanced ? 'Balanced' : 'Out of Balance'}
            </span>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-10 bg-gray-900 text-white relative overflow-hidden">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                 <span className="bg-blue-600 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded">
                    {entry.sourceType}
                 </span>
                 <span className="text-gray-400 font-mono text-xs">{entry.entryNumber}</span>
              </div>
              <h1 className="text-4xl font-black tracking-tight">Journal Entry Details</h1>
              <p className="text-gray-400 font-medium mt-1">Review and modify historical ledger entries</p>
            </div>
            
            <Button 
                onClick={handleSave} 
                disabled={loading || !isBalanced}
                className="h-14 px-10 rounded-2xl bg-white text-gray-900 font-black hover:bg-gray-100 transition-all shadow-xl disabled:opacity-30 flex items-center gap-3"
            >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                Save Changes
            </Button>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
        </div>

        <div className="p-10 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5 px-1">
                 <Calendar size={12} />
                 Transaction Date
              </label>
              <input 
                type="date" 
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-2 border-gray-50 focus:border-blue-500/20 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all font-bold text-gray-900"
              />
            </div>
            <div className="md:col-span-2 space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5 px-1">
                 <FileText size={12} />
                 Narration / Memo
              </label>
              <input 
                type="text" 
                placeholder="e.g. Monthly Rent Payment - April 2026"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-2 border-gray-50 focus:border-blue-500/20 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all font-bold text-gray-900 placeholder:text-gray-300"
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
               <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <ArrowRightLeft size={20} className="text-blue-600" />
                  Ledger Lines
               </h3>
               <Button 
                variant="ghost"
                size="sm"
                onClick={addLine}
                className="text-blue-600 font-black hover:bg-blue-50 rounded-xl px-4 h-10"
               >
                 <Plus size={18} className="mr-2" /> Add Line
               </Button>
            </div>

            <div className="space-y-4">
              {lines.map((line, index) => (
                <div key={index} className="group relative flex gap-4 items-start animate-in fade-in slide-in-from-left-4 duration-300">
                  <div className="flex-1">
                    <Select value={line.accountId} onValueChange={val => updateLine(index, 'accountId', val)}>
                        <SelectTrigger className="w-full h-16 px-6 rounded-2xl bg-gray-50 border-2 border-transparent hover:border-gray-200 transition-all font-bold text-gray-900">
                           <SelectValue placeholder="Select Account...">
                              {accounts.find(a => a.id === line.accountId) 
                                ? `${accounts.find(a => a.id === line.accountId).code} - ${accounts.find(a => a.id === line.accountId).name}`
                                : undefined
                              }
                           </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-gray-100 shadow-2xl">
                           {accounts.map(acc => (
                             <SelectItem key={acc.id} value={acc.id} className="py-4 rounded-xl">
                               <div className="flex items-center gap-3">
                                  <span className="font-mono text-[10px] font-black bg-gray-100 px-2 py-1 rounded text-gray-500">{acc.code}</span>
                                  <span className="font-bold">{acc.name}</span>
                               </div>
                             </SelectItem>
                           ))}
                        </SelectContent>
                    </Select>
                  </div>

                  <div className="w-48 relative group/input">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-blue-400 group-focus-within/input:text-blue-600 transition-colors">DR</span>
                    <input 
                      type="number"
                      placeholder="0.00"
                      value={line.debit || ""}
                      onChange={e => updateLine(index, 'debit', e.target.value)}
                      className="w-full pl-14 pr-6 h-16 rounded-2xl bg-blue-50/30 border-2 border-transparent focus:border-blue-500/20 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all font-mono font-black text-blue-700 text-right text-lg"
                    />
                  </div>

                  <div className="w-48 relative group/input">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-purple-400 group-focus-within/input:text-purple-600 transition-colors">CR</span>
                    <input 
                      type="number"
                      placeholder="0.00"
                      value={line.credit || ""}
                      onChange={e => updateLine(index, 'credit', e.target.value)}
                      className="w-full pl-14 pr-6 h-16 rounded-2xl bg-purple-50/30 border-2 border-transparent focus:border-purple-500/20 focus:bg-white focus:ring-4 focus:ring-purple-500/5 transition-all font-mono font-black text-purple-700 text-right text-lg"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                     <button 
                        onClick={() => removeLine(index)}
                        disabled={lines.length <= 2}
                        className="p-3 text-gray-300 hover:text-red-500 disabled:opacity-0 transition-all rounded-xl hover:bg-red-50"
                        title="Remove Line"
                      >
                        <Trash2 size={20} />
                      </button>
                      <button 
                        onClick={() => autoBalance(index)}
                        className="p-3 text-gray-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all rounded-xl hover:bg-blue-50"
                        title="Auto-balance this line"
                      >
                        <Calculator size={20} />
                      </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-10 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center gap-10">
          <div className="flex-1 flex gap-12">
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase text-gray-400 block tracking-widest pl-1">Total Debit</span>
              <div className="px-6 py-4 bg-white rounded-2xl border border-gray-200 shadow-sm min-w-[160px]">
                 <span className="font-mono font-black text-blue-600 text-2xl">{totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase text-gray-400 block tracking-widest pl-1">Total Credit</span>
              <div className="px-6 py-4 bg-white rounded-2xl border border-gray-200 shadow-sm min-w-[160px]">
                 <span className="font-mono font-black text-purple-600 text-2xl">{totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {!isBalanced && totalDebits > 0 && (
            <div className="px-6 py-4 bg-amber-50 text-amber-600 rounded-[2rem] border border-amber-100 flex items-center gap-4 animate-pulse">
               <AlertCircle size={24} />
               <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase leading-none mb-1">Difference</span>
                  <span className="font-mono font-black text-lg">{Math.abs(difference).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
