'use client'

import { useState, useEffect } from "react"
import { 
  Plus, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Scale, 
  ArrowRightLeft,
  Calendar,
  FileText,
  Calculator
} from "lucide-react"
import { createManualJournalEntry, getAccounts } from "../../actions"
import { toast } from "react-hot-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export function ManualEntryDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<any[]>([])
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState("")
  const [lines, setLines] = useState([
    { accountId: "", debit: 0, credit: 0 },
    { accountId: "", debit: 0, credit: 0 },
  ])

  useEffect(() => {
    if (open) {
      getAccounts().then(setAccounts)
    }
  }, [open])

  const addLine = () => setLines([...lines, { accountId: "", debit: 0, credit: 0 }])
  const removeLine = (index: number) => setLines(lines.filter((_, i) => i !== index))

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...lines]
    newLines[index] = { ...newLines[index], [field]: value }
    
    // If debit is entered, clear credit and vice versa
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
    
    // Calculate what this line needs to contribute to make diff 0
    // If diff is positive (more DR), we need CR
    // If diff is negative (more CR), we need DR
    
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

  const handleSubmit = async () => {
    if (!description) return toast.error("Please enter a description")
    if (!isBalanced) return toast.error("Journal entry must be balanced (Debits = Credits)")
    if (lines.some(l => !l.accountId)) return toast.error("Please select an account for all lines")

    try {
      setLoading(true)
      await createManualJournalEntry({
        date: new Date(date),
        description,
        lines: lines.map(l => ({
            ...l,
            debit: Number(l.debit),
            credit: Number(l.credit)
        }))
      })
      toast.success("Journal entry recorded successfully")
      setOpen(false)
      setDescription("")
      setLines([
        { accountId: "", debit: 0, credit: 0 },
        { accountId: "", debit: 0, credit: 0 },
      ])
    } catch (error: any) {
      toast.error(error.message || "Failed to record entry")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-black hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-100 outline-none h-auto">
           <Plus size={18} />
           New Manual Entry
        </Button>
      } />
      <DialogContent className="max-w-6xl w-full rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-white sm:max-w-6xl">
        <DialogHeader className="p-8 bg-gray-900 text-white relative overflow-hidden">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <DialogTitle className="text-3xl font-black tracking-tight">Post Journal Entry</DialogTitle>
              <p className="text-gray-400 font-medium mt-1">Manual double-entry bookkeeping</p>
            </div>
            <div className={cn(
                "px-6 py-2 rounded-2xl flex items-center gap-2 border-2 transition-all outline-none",
                isBalanced ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400" : "bg-amber-500/10 border-amber-500/50 text-amber-400"
            )}>
                {isBalanced ? <CheckCircle2 size={20} /> : <Scale size={20} />}
                <span className="font-black text-sm uppercase tracking-widest">
                    {isBalanced ? 'Balanced' : 'Out of Balance'}
                </span>
            </div>
          </div>
          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
        </DialogHeader>

        <div className="p-8 space-y-8">
          {/* Main Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5 px-1">
                 <Calendar size={12} />
                 Transaction Date
              </label>
              <input 
                type="date" 
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border-2 border-gray-50 focus:border-blue-500/20 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all font-bold text-gray-900"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5 px-1">
                 <FileText size={12} />
                 Narration / Memo
              </label>
              <input 
                type="text" 
                placeholder="e.g. Monthly Rent Payment - April 2026"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border-2 border-gray-50 focus:border-blue-500/20 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all font-bold text-gray-900 placeholder:text-gray-300"
              />
            </div>
          </div>

          {/* Lines */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
               <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                  <ArrowRightLeft size={16} className="text-blue-600" />
                  Ledger Lines
               </h3>
               <Button 
                variant="ghost"
                size="sm"
                onClick={addLine}
                className="text-blue-600 font-black hover:bg-blue-50 rounded-xl px-4"
               >
                 <Plus size={16} className="mr-1" /> Add Line
               </Button>
            </div>

            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              {lines.map((line, index) => (
                <div key={index} className="group relative flex gap-3 items-start animate-in fade-in slide-in-from-left-4 duration-300">
                  <div className="flex-1">
                    <Select value={line.accountId} onValueChange={val => updateLine(index, 'accountId', val)}>
                        <SelectTrigger className="w-full h-[52px] px-5 rounded-2xl bg-gray-50 border-2 border-transparent hover:border-gray-200 transition-all font-bold text-gray-900">
                           <SelectValue placeholder="Select Account...">
                              {accounts.find(a => a.id === line.accountId) 
                                ? `${accounts.find(a => a.id === line.accountId).code} - ${accounts.find(a => a.id === line.accountId).name}`
                                : undefined
                              }
                           </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-gray-100 shadow-2xl">
                           {accounts.map(acc => (
                             <SelectItem key={acc.id} value={acc.id} className="py-3 rounded-xl">
                               <div className="flex items-center gap-3">
                                  <span className="font-mono text-[10px] font-black bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{acc.code}</span>
                                  <span className="font-bold">{acc.name}</span>
                               </div>
                             </SelectItem>
                           ))}
                        </SelectContent>
                    </Select>
                  </div>

                  <div className="w-40 relative group/input">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-blue-400 group-focus-within/input:text-blue-600 transition-colors">DR</span>
                    <input 
                      type="number"
                      placeholder="0.00"
                      value={line.debit || ""}
                      onChange={e => updateLine(index, 'debit', e.target.value)}
                      className="w-full pl-12 pr-4 h-[52px] rounded-2xl bg-blue-50/30 border-2 border-transparent focus:border-blue-500/20 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all font-mono font-black text-blue-700 text-right"
                    />
                  </div>

                  <div className="w-40 relative group/input">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-purple-400 group-focus-within/input:text-purple-600 transition-colors">CR</span>
                    <input 
                      type="number"
                      placeholder="0.00"
                      value={line.credit || ""}
                      onChange={e => updateLine(index, 'credit', e.target.value)}
                      className="w-full pl-12 pr-4 h-[52px] rounded-2xl bg-purple-50/30 border-2 border-transparent focus:border-purple-500/20 focus:bg-white focus:ring-4 focus:ring-purple-500/5 transition-all font-mono font-black text-purple-700 text-right"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                     <button 
                        onClick={() => removeLine(index)}
                        disabled={lines.length <= 2}
                        className="p-2 text-gray-300 hover:text-red-500 disabled:opacity-0 transition-all rounded-lg hover:bg-red-50"
                        title="Remove Line"
                      >
                        <Trash2 size={16} />
                      </button>
                      <button 
                        onClick={() => autoBalance(index)}
                        className="p-2 text-gray-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-blue-50"
                        title="Auto-balance this line"
                      >
                        <Calculator size={16} />
                      </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="p-8 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center gap-6">
          <div className="flex-1 flex gap-8">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-gray-400 block tracking-widest pl-1">Total Debit</span>
              <div className="px-4 py-2 bg-white rounded-xl border border-gray-200 shadow-sm min-w-[120px]">
                 <span className="font-mono font-black text-blue-600 text-lg">{totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-gray-400 block tracking-widest pl-1">Total Credit</span>
              <div className="px-4 py-2 bg-white rounded-xl border border-gray-200 shadow-sm min-w-[120px]">
                 <span className="font-mono font-black text-purple-600 text-lg">{totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
             {!isBalanced && totalDebits > 0 && (
               <div className="px-5 py-2.5 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100 flex items-center gap-3 animate-pulse">
                  <AlertCircle size={18} />
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black uppercase leading-none mb-1">Difference</span>
                     <span className="font-mono font-black text-sm">{Math.abs(difference).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
               </div>
             )}
             
             <Button 
               onClick={handleSubmit} 
               disabled={loading || !isBalanced}
               className="h-14 px-10 rounded-2xl bg-gray-900 text-white font-black hover:bg-black transition-all shadow-xl shadow-gray-200 disabled:opacity-30 flex items-center gap-3"
             >
               {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
               Post Journal Entry
             </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
