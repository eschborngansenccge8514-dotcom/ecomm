'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Upload, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft,
  Receipt as ReceiptIcon,
  FileText,
  FileSearch,
  Save,
  Info,
  Layers,
  X,
  Plus
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
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { analyseReceipt, saveExpense } from '../actions'
import { getAccounts } from '../../accounting/actions'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type Step = 'IDLE' | 'UPLOADING' | 'ANALYSING' | 'REVIEW' | 'SAVING' | 'SUCCESS' | 'BULK_PROCESSING'

interface QueueItem {
  id: string;
  file: File;
  status: 'uploading' | 'analysing' | 'saving' | 'done' | 'error';
  progress: number;
  error?: string;
  extraction?: any;
}

const TAX_TYPES = [
  { value: 'full', label: '100% Deductible (S33 ITA)', pct: 100 },
  { value: 'partial', label: '50% Entertainment (S39 ITA)', pct: 50 },
  { value: 'none', label: 'Non-Deductible', pct: 0 },
  { value: 'capital_allowance', label: 'Capital Allowance', pct: 100 },
]

export default function UploadPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [step, setStep] = useState<Step>('IDLE')
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  
  useEffect(() => {
    getAccounts().then(setAccounts)
  }, [])

  const bankAccounts = accounts.filter(a => a.type === 'ASSET' && a.code.startsWith('11'))
  
  // Single upload states
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [extraction, setExtraction] = useState<any>({
    vendorName: '',
    receiptDate: new Date().toISOString().split('T')[0],
    category: '',
    totalAmount: 0,
    sstAmount: 0,
    taxDeductible: 'full',
    taxDeductiblePct: 100,
    taxDeductibleReason: 'Select a category to automatically assess tax deductibility.',
    currency: 'MYR',
    paymentAccountId: ''
  })
  const [storagePath, setStoragePath] = useState<string | null>(null)

  const processFile = async (item: QueueItem) => {
    const updateStatus = (status: QueueItem['status'], progress: number, error?: string, extraction?: any) => {
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status, progress, error, extraction } : q))
    }

    try {
      updateStatus('uploading', 10)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Please log in first")

      const fileName = `${user.id}/${Date.now()}-${item.file.name}`
      const { data, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, item.file)

      if (uploadError) throw uploadError
      updateStatus('analysing', 40)
      
      const result = await analyseReceipt(data.path, item.file.type)
      updateStatus('saving', 80)

      await saveExpense({
        ...result.extraction,
        receiptUrl: result.receiptUrl,
        receiptStoragePath: data.path,
        status: 'ai_review' // Bulk uploads saved for review later
      })

      updateStatus('done', 100, undefined, result.extraction)
    } catch (err: any) {
      updateStatus('error', 0, err.message)
    }
  }

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length === 0) return

    if (selectedFiles.length === 1) {
      // Single file fallback to the original detailed review flow
      handleSingleUpload(selectedFiles[0])
      return
    }

    const newItems: QueueItem[] = selectedFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      status: 'uploading',
      progress: 0
    }))

    setQueue(prev => [...prev, ...newItems])
    setStep('BULK_PROCESSING')

    // Process in parallel (simple version, could add a concurrency limit here)
    for (const item of newItems) {
      processFile(item)
    }
  }

  const handleSingleUpload = async (selectedFile: File) => {
    setFile(selectedFile)
    setStep('UPLOADING')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Please log in first")

      const fileName = `${user.id}/${Date.now()}-${selectedFile.name}`
      const { data, error } = await supabase.storage
        .from('receipts')
        .upload(fileName, selectedFile)

      if (error) throw error
      setStoragePath(data.path)
      
      setStep('ANALYSING')
      const result = await analyseReceipt(data.path, selectedFile.type)
      setExtraction(result.extraction)
      setPreviewUrl(result.receiptUrl || URL.createObjectURL(selectedFile))
      setStep('REVIEW')
    } catch (err: any) {
      toast.error(err.message)
      setStep('IDLE')
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setStep('SAVING')
    try {
      await saveExpense({
        ...extraction,
        receiptUrl: previewUrl,
        receiptStoragePath: storagePath
      })
      setStep('SUCCESS')
      toast.success('Expense saved successfully')
      setTimeout(() => router.push('/expenses'), 1500)
    } catch (err: any) {
      toast.error(err.message)
      setStep('REVIEW')
    }
  }

  const updateField = (field: string, value: any) => {
    setExtraction((prev: any) => {
      const next = { ...prev, [field]: value };
      
      // Auto-set Malaysian Tax Deductibility based on category
      if (field === 'category') {
        if (value === 'meals_entertainment') {
          next.taxDeductible = 'partial';
          next.taxDeductiblePct = 50;
          next.taxDeductibleReason = 'Auto-applied: Client entertainment is restricted to 50% deduction under Section 39 of the Income Tax Act 1967.';
        } else if (value === 'equipment_hardware') {
          next.taxDeductible = 'capital_allowance';
          next.taxDeductiblePct = 100;
          next.taxDeductibleReason = 'Auto-applied: Hardware is treated as a Capital Allowance asset, not a direct expense.';
        } else {
          next.taxDeductible = 'full';
          next.taxDeductiblePct = 100;
          next.taxDeductibleReason = 'Auto-applied: Standard operational business expenses are 100% deductible under Section 33.';
        }
      }
      return next;
    })
  }

  const deductibleAmt = Number(extraction?.totalAmount || 0) * (Number(extraction?.taxDeductiblePct || 0) / 100)

  if (step === 'SUCCESS') {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-8 text-center space-y-6 animate-in fade-in duration-700">
        <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/10">
          <CheckCircle2 size={48} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Expense Saved!</h2>
          <p className="text-gray-500 font-medium mt-2">Redirecting you back to your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/expenses" className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-gray-900 transition-colors">
          <ArrowLeft size={16} /> Back to Expenses
        </Link>
      </div>

      {step === 'BULK_PROCESSING' ? (
        <div className="space-y-6 max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Processing Receipts</h2>
            <Badge className="bg-blue-50 text-blue-600 border-blue-100 rounded-lg">
              {queue.filter(q => q.status === 'done').length} / {queue.length} Done
            </Badge>
          </div>
          
          <div className="grid gap-4">
            {queue.map((item) => (
              <Card key={item.id} className="p-4 rounded-2xl border-gray-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 shrink-0">
                  {item.status === 'done' ? (
                    <CheckCircle2 className="text-emerald-500" size={24} />
                  ) : item.status === 'error' ? (
                    <AlertCircle className="text-rose-500" size={24} />
                  ) : (
                    <Loader2 className="animate-spin text-blue-500" size={24} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{item.file.name}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                    {item.status === 'error' ? item.error : item.status}
                  </p>
                </div>
                {item.status !== 'done' && item.status !== 'error' && (
                  <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-300" 
                      style={{ width: `${item.progress}%` }} 
                    />
                  </div>
                )}
                {item.status === 'done' && (
                  <div className="text-right">
                    <p className="text-sm font-black text-gray-900">RM {Number(item.extraction?.totalAmount || 0).toFixed(2)}</p>
                    <p className="text-[10px] font-bold text-emerald-500">Extracted</p>
                  </div>
                )}
              </Card>
            ))}
          </div>

          {queue.every(q => q.status === 'done' || q.status === 'error') && (
            <Button 
              className="w-full h-14 rounded-2xl bg-gray-900 font-bold text-lg"
              onClick={() => router.push('/expenses')}
            >
              Finish & View Expenses
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Left Side: Upload or Preview */}
          <Card className="w-full md:w-1/2 overflow-hidden rounded-[32px] border-gray-100 shadow-sm min-h-[400px] flex flex-col relative bg-white">
            {(step === 'IDLE' || step === 'UPLOADING' || step === 'ANALYSING') ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6">
                {(step === 'IDLE') ? (
                    <>
                      <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center shadow-inner">
                        <Upload size={32} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-gray-900 tracking-tight">Upload Receipt</h3>
                        <p className="text-sm text-gray-400 mt-2 font-medium">Or simply fill out the manual entry form on the right.</p>
                      </div>
                      <label className="w-full flex flex-col items-center group cursor-pointer">
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*,application/pdf" 
                          multiple 
                          onChange={handleBulkUpload} 
                        />
                        <div className="w-full h-32 border-2 border-dashed border-gray-100 rounded-[24px] flex items-center justify-center group-hover:border-blue-200 group-hover:bg-blue-50/30 transition-all">
                          <div className="flex items-center gap-3 text-gray-400 group-hover:text-blue-500">
                             <Plus size={20} />
                             <span className="font-bold">Select Files</span>
                          </div>
                        </div>
                      </label>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                        <Layers size={12} />
                        Supports JPG, PNG, PDF up to 10MB
                      </div>
                    </>
                ) : (
                  <div className="flex flex-col items-center gap-6">
                      <div className="relative">
                        <div className="w-20 h-20 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center text-blue-500">
                          {step === 'UPLOADING' ? <Upload size={24} /> : <FileSearch size={24} />}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 capitalize">{step.toLowerCase()}...</h3>
                        <p className="text-sm text-gray-400 mt-2">
                          {step === 'UPLOADING' ? 'Sending file to secure storage' : 'AI is extracting tax data and line items'}
                        </p>
                      </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 bg-gray-50 relative group flex items-center justify-center">
                {previewUrl ? (
                  <img src={previewUrl} alt="Receipt Preview" className="w-full h-full object-contain" />
                ) : (
                  <div className="p-12 text-center space-y-4">
                     <div className="w-20 h-20 bg-gray-100 text-gray-300 rounded-3xl flex items-center justify-center mx-auto">
                        <FileText size={32} />
                     </div>
                     <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Manual Entry Mode</p>
                  </div>
                )}
                {previewUrl && (
                  <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-4">
                    <button className="p-2 bg-white rounded-xl shadow-lg text-gray-500 hover:text-gray-900 transition-colors" onClick={() => window.open(previewUrl, '_blank')}>
                        <Info size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Right Side: Review Form / Manual Interface */}
          <div className={cn("w-full md:w-1/2 space-y-6 transition-all duration-500 opacity-100 translate-y-0", (step === 'UPLOADING' || step === 'ANALYSING') ? 'pointer-events-none opacity-50' : '')}>
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                  <span className={cn("w-1.5 h-6 rounded-full", previewUrl ? 'bg-emerald-500' : 'bg-indigo-500')} />
                  {previewUrl ? 'Review AI Extraction' : 'Manual Expense Details'}
                </h2>
                {extraction?.confidenceScore && (
                  <Badge variant="outline" className={cn(
                    "rounded-xl border font-bold py-1",
                    Number(extraction.confidenceScore) > 0.8 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                  )}>
                    {Math.round(extraction.confidenceScore * 100)}% Match
                  </Badge>
                )}
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Vendor Name</Label>
                    <Input 
                      value={extraction?.vendorName || ''} 
                      onChange={(e) => updateField('vendorName', e.target.value)}
                      className="h-12 rounded-2xl border-gray-100 focus:ring-blue-500/10 font-bold"
                      placeholder="e.g. Tenaga Nasional Berhad"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Receipt Date</Label>
                    <Input 
                      type="date"
                      value={extraction?.receiptDate ? new Date(extraction.receiptDate).toISOString().split('T')[0] : ''} 
                      onChange={(e) => updateField('receiptDate', e.target.value)}
                      className="h-12 rounded-2xl border-gray-100 font-bold"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Category</Label>
                    <Select 
                      value={extraction?.category || ''} 
                      onValueChange={(v) => updateField('category', v)}
                      required
                    >
                      <SelectTrigger className="h-12 rounded-2xl border-gray-100 font-bold">
                        <SelectValue placeholder="Select Category..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl font-bold">
                        <SelectItem value="utilities">💡 Utilities</SelectItem>
                        <SelectItem value="office_supplies">📓 Office Supplies</SelectItem>
                        <SelectItem value="rent_premises">🏢 Rent Premises</SelectItem>
                        <SelectItem value="marketing_advertising">📣 Marketing & Adv.</SelectItem>
                        <SelectItem value="professional_services">⚖️ Professional Services</SelectItem>
                        <SelectItem value="software_subscriptions">💻 Software & Subs</SelectItem>
                        <SelectItem value="insurance">🛡️ Insurance</SelectItem>
                        <SelectItem value="repairs_maintenance">🔧 Repairs & Maint.</SelectItem>
                        <SelectItem value="postage_courier">📮 Postage & Courier</SelectItem>
                        <SelectItem value="bank_charges">🏦 Bank Charges</SelectItem>
                        <SelectItem value="staff_hr">👥 Staff & HR</SelectItem>
                        <SelectItem value="raw_materials_inventory">🏭 Raw Materials</SelectItem>
                        <SelectItem value="transportation_vehicle">🚗 Transportation</SelectItem>
                        <SelectItem value="meals_entertainment">🍽️ Meals/Entertainment</SelectItem>
                        <SelectItem value="equipment_hardware">🖥️ Equipment & Hardware</SelectItem>
                        <SelectItem value="other">📦 Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Paid From</Label>
                    <Select 
                      value={extraction?.paymentAccountId || ''} 
                      onValueChange={(v) => updateField('paymentAccountId', v)}
                    >
                      <SelectTrigger className="h-12 rounded-2xl border-gray-100 font-bold">
                        <SelectValue placeholder="Select Source...">
                          {extraction?.paymentAccountId ? bankAccounts.find(acc => acc.id === extraction.paymentAccountId)?.name : "Select Source..."}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl font-bold">
                        {bankAccounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Amount (MYR)</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">RM</span>
                      <Input 
                        type="number" step="0.01"
                        value={extraction?.totalAmount || 0} 
                        onChange={(e) => updateField('totalAmount', e.target.value)}
                        className="h-12 rounded-2xl border-gray-100 pl-12 font-black text-lg"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">SST Amount</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">RM</span>
                      <Input 
                        type="number" step="0.01"
                        value={extraction?.sstAmount || 0} 
                        onChange={(e) => updateField('sstAmount', e.target.value)}
                        className="h-12 rounded-2xl border-gray-100 pl-12 font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-gray-50 rounded-[32px] border border-gray-100 space-y-4">
                  <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-gray-900 tracking-tight flex items-center gap-2">
                        <FileText size={16} className="text-blue-500" />
                        Malaysian Tax Deductibility
                      </h4>
                      <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-md">ITA 1967</span>
                  </div>
                  <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tax Treatment</span>
                            <span className="text-sm font-black text-blue-600">
                                {extraction?.taxDeductible === 'partial' ? '50% Deductible (S39)' : 
                                 extraction?.taxDeductible === 'capital_allowance' ? 'Capital Allowance' : 
                                 '100% Deductible (S33)'}
                            </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Deductible Amount</span>
                            <span className="text-lg font-black text-gray-900">RM {deductibleAmt.toFixed(2)}</span>
                        </div>
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", previewUrl ? 'bg-emerald-50 text-emerald-500' : 'bg-indigo-50 text-indigo-500')}>
                            <CheckCircle2 size={24} />
                        </div>
                      </div>
                      
                      <p className="text-[10px] text-gray-400 font-medium italic">
                        ℹ️ {extraction?.taxDeductibleReason || 'AI identified this as a business expense.'}
                      </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  {previewUrl && (
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setStep('IDLE')
                        setExtraction({
                          vendorName: '',
                          receiptDate: new Date().toISOString().split('T')[0],
                          category: '',
                          totalAmount: 0,
                          sstAmount: 0,
                          taxDeductible: 'full',
                          taxDeductiblePct: 100,
                          taxDeductibleReason: 'Select a category to automatically assess tax deductibility.',
                          currency: 'MYR',
                          paymentAccountId: ''
                        })
                        setPreviewUrl(null)
                      }}
                      className="flex-1 rounded-[24px] h-14 font-bold border-gray-200"
                    >
                      Clear Receipt
                    </Button>
                  )}
                  <Button 
                    type="submit" 
                    disabled={step === 'SAVING'}
                    className={cn(
                      "flex-[2] rounded-[24px] h-14 text-white font-black text-lg shadow-xl transition-all active:scale-95 gap-3",
                      !previewUrl ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100" : "bg-gray-900 hover:bg-gray-800 shadow-gray-200"
                    )}
                  >
                    {step === 'SAVING' ? <Loader2 className="animate-spin" /> : <Save size={24} />}
                    {step === 'SAVING' ? 'Saving...' : 'Save Expense'}
                  </Button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
