'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatCurrency, cn } from '@/lib/utils'
import { findPotentialMatches, confirmMatch, importBankStatement, postManualReconcile, parseBankStatementWithAI, bulkAutoMatch } from '../actions'
import { 
  Plus, 
  Search, 
  ArrowRightLeft, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  UploadCloud,
  Loader2,
  FileSpreadsheet,
  Zap
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface ReconcileProps {
  initialAccounts: any[]
  initialLines: any[]
  coaAccounts: any[]
}

export function ReconcileClient({ initialAccounts, initialLines, coaAccounts }: ReconcileProps) {
  const router = useRouter()
  const [lines, setLines] = useState(initialLines)
  const [selectedAccount, setSelectedAccount] = useState(initialAccounts[0])
  const [activeLineId, setActiveLineId] = useState<string | null>(lines[0]?.id)
  const [isImporting, setIsImporting] = useState(false)
  const [isBulkMatching, setIsBulkMatching] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [manualAccountSearch, setManualAccountSearch] = useState('')
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeLine = lines.find(l => l.id === activeLineId)

  // Focus management
  useEffect(() => {
    if (!activeLineId && lines.length > 0) {
      setActiveLineId(lines[0].id)
    }
  }, [lines, activeLineId])

  const handleManualPost = async (coaId: string) => {
    if (!activeLineId) return
    try {
      setIsPosting(true)
      await postManualReconcile(activeLineId, coaId)
      // Optimistic Update
      const remainingLines = lines.filter(l => l.id !== activeLineId)
      setLines(remainingLines)
      setActiveLineId(remainingLines[0]?.id || null)
      setManualAccountSearch('')
      toast.success('Transaction reconciled via manual post')
    } catch (e: any) {
      toast.error(`Posting failed: ${e.message}`)
    } finally {
      setIsPosting(false)
    }
  }

  const handleBulkMatch = async () => {
    if (!selectedAccount) return
    try {
      setIsBulkMatching(true)
      const res = await bulkAutoMatch(selectedAccount.id)
      toast.success(`Auto-matched ${res.count} transactions!`)
      router.refresh()
      window.location.reload()
    } catch (e: any) {
      toast.error('Bulk match failed')
    } finally {
      setIsBulkMatching(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedAccount) return

    setIsImporting(true)
    const reader = new FileReader()
    const isImageOrPdf = file.type.includes('image') || file.type.includes('pdf')
    
    reader.onload = async (event) => {
      let parsedLines = []
      
      if (isImageOrPdf) {
        toast.loading('Gemini is scanning your bank statement...', { id: 'parsing' })
        try {
          const base64Data = event.target?.result as string
          parsedLines = await parseBankStatementWithAI(base64Data, file.type)
          toast.success('Gemini extraction complete', { id: 'parsing' })
        } catch (e: any) {
          toast.error(`AI Scan Failed: ${e.message}`, { id: 'parsing' })
          setIsImporting(false)
          return
        }
      } else {
        const csvData = event.target?.result as string
        const rows = csvData.split(/\r?\n/).filter(row => row.trim().length > 0)
        const firstRow = rows[0]?.split(',')
        const startIdx = isNaN(parseFloat(firstRow?.[2] || 'NaN')) ? 1 : 0
        
        parsedLines = rows.slice(startIdx)
          .map(row => {
            const parts = row.split(',').map(p => p.trim())
            if (parts.length < 3) return null
            const [date, description, amount] = parts
            return { date, description, amount: parseFloat(amount) }
          })
          .filter(Boolean)
      }

      try {
        const res = await importBankStatement(selectedAccount.id, selectedAccount.merchant_id, parsedLines)
        if (res.success) {
          toast.success(`Imported ${res.count} transactions`)
          setLines(prev => [...(res.data || []), ...prev])
          router.refresh()
        }
      } catch (e: any) {
        toast.error(`Import failed: ${e.message}`)
      } finally {
        setIsImporting(false)
      }
    }

    if (isImageOrPdf) reader.readAsDataURL(file)
    else reader.readAsText(file)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 ring-offset-background">
      <input type="file" id="reconcile-file-upload" ref={fileInputRef} onChange={handleFileUpload} accept=".csv,text/csv,application/vnd.ms-excel,image/*,application/pdf" className="sr-only" />
      
      {/* ── Left: Statement Feed ────────────────────────────────────────── */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
           <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Selected Bank Account</label>
           {initialAccounts.length > 0 ? (
             <select 
               value={selectedAccount?.id}
               onChange={(e) => setSelectedAccount(initialAccounts.find(a => a.id === e.target.value))}
               className="w-full h-12 px-4 rounded-xl border border-gray-100 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
             >
                {initialAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.coa_accounts?.code || 'No Code'})</option>
                ))}
             </select>
           ) : (
             <Link href="/accounting/coa" className="flex items-center justify-center gap-2 w-full h-12 px-4 rounded-xl bg-blue-50 text-blue-600 font-bold text-xs uppercase tracking-widest hover:bg-blue-100 transition-all border border-blue-100">
                <Plus size={16} /> Setup Bank Account
             </Link>
           )}
        </div>

        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden flex flex-col h-[600px]">
           <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
              <div className="flex items-center gap-3">
                 <h3 className="font-black text-gray-900 uppercase tracking-tighter text-xs">Bank Feed</h3>
                 {lines.length > 0 && selectedAccount && (
                   <button onClick={handleBulkMatch} disabled={isBulkMatching} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all disabled:opacity-50">
                      <Zap size={10} fill="currentColor" />
                      {isBulkMatching ? 'Searching...' : 'Auto-Match'}
                   </button>
                 )}
              </div>
              <button 
                onClick={() => selectedAccount ? fileInputRef.current?.click() : toast.error('Select an account first')}
                disabled={isImporting}
                className={cn("flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all", !selectedAccount ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-50 text-blue-600 hover:bg-blue-100")}>
                {isImporting ? <Loader2 className="animate-spin" size={16} /> : <FileSpreadsheet size={16} />}
                {isImporting ? 'Scanning...' : 'Import'}
              </button>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {lines.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 opacity-50">
                   <CheckCircle2 size={32} className="text-emerald-500" />
                   <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Feed reconciled!</p>
                </div>
              ) : (
                lines.map(line => (
                  <button key={line.id} onClick={() => setActiveLineId(line.id)}
                    className={cn("w-full p-5 rounded-3xl transition-all text-left border flex flex-col gap-2 relative", activeLineId === line.id ? "bg-slate-900 border-slate-900 shadow-xl" : "bg-white border-gray-50 hover:border-blue-200")}>
                    <div className="flex justify-between items-start">
                       <span className={cn("text-[9px] font-black uppercase tracking-widest", activeLineId === line.id ? "text-slate-400" : "text-gray-400")}>{new Date(line.transaction_date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })}</span>
                       <span className={cn("font-black tabular-nums", activeLineId === line.id ? "text-white" : "text-gray-900")}>{formatCurrency(line.amount)}</span>
                    </div>
                    <p className={cn("font-bold text-[10px] truncate uppercase tracking-tight", activeLineId === line.id ? "text-slate-100" : "text-gray-600")}>{line.description}</p>
                    {activeLineId === line.id && <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-8 bg-blue-500 rounded-full" />}
                  </button>
                ))
              )}
           </div>
        </div>
      </div>

      {/* ── Right: Match Maker ────────────────────────────────────────── */}
      <div className="lg:col-span-8 space-y-8">
        {!activeLine ? (
          <div className="h-[600px] bg-gray-50/50 rounded-[3rem] border-2 border-dashed border-gray-100 flex items-center justify-center text-gray-400 font-black uppercase tracking-widest text-xs text-center p-12">
            Select a bank transaction
          </div>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
             <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Bank Transaction</p>
                   <h2 className="text-2xl font-black text-gray-900">{activeLine.description}</h2>
                   <p className="text-gray-400 font-bold text-xs">{new Date(activeLine.transaction_date).toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                <div className="text-right">
                   <p className="text-3xl font-black text-gray-900">{formatCurrency(activeLine.amount)}</p>
                   <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase">{selectedAccount?.bank_name}</span>
                </div>
             </div>

             <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-8">
                <div className="flex items-start gap-4 p-6 bg-orange-50 rounded-3xl border border-orange-100">
                   <AlertCircle className="text-orange-500 mt-1" size={20} />
                   <div className="flex-1 space-y-2">
                      <h4 className="font-black text-orange-900 uppercase text-xs">No Direct Match Found</h4>
                      <p className="text-[10px] text-orange-700 leading-relaxed font-bold">
                        We couldn't find an existing Journal Entry for this transaction. Please manually select the category account it should be posted to.
                      </p>
                   </div>
                </div>

                <div className="space-y-4">
                   <div className="flex justify-between items-end px-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Account</label>
                      {manualAccountSearch && <button onClick={() => setManualAccountSearch('')} className="text-[10px] font-black text-blue-600 uppercase">Clear</button>}
                   </div>
                   
                   <div className="relative group">
                      <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                      <input 
                        type="text" placeholder="Search Account Name or Code..."
                        value={manualAccountSearch} onChange={(e) => setManualAccountSearch(e.target.value)}
                        className="w-full h-16 pl-14 pr-6 rounded-[1.5rem] bg-gray-50/50 border-2 border-transparent focus:bg-white focus:border-blue-100 transition-all font-bold text-gray-900"
                      />
                   </div>

                   <div className="max-h-[350px] overflow-y-auto pr-2 space-y-2">
                      {coaAccounts
                        .filter(acc => acc.name.toLowerCase().includes(manualAccountSearch.toLowerCase()) || acc.code.includes(manualAccountSearch))
                        .slice(0, 50)
                        .map(acc => (
                           <button key={acc.id} disabled={isPosting} onClick={() => handleManualPost(acc.id)}
                             className="w-full p-5 rounded-2xl border border-gray-50 hover:border-blue-200 hover:bg-blue-50/10 transition-all text-left flex justify-between items-center group">
                              <div className="flex items-center gap-4">
                                 <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors"><Plus size={16} /></div>
                                 <div>
                                    <p className="font-black text-gray-900 uppercase text-xs group-hover:text-blue-700 transition-colors">{acc.name}</p>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{acc.code} • {acc.type}</p>
                                 </div>
                              </div>
                              <ArrowRightLeft size={16} className="text-gray-200 group-hover:text-blue-400 transition-all translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100" />
                           </button>
                        ))
                      }
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  )
}
