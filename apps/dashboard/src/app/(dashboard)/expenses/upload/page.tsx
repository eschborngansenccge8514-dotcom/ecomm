'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Upload, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft,
  Receipt,
  FileText,
  FileSearch,
  Save,
  Info
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
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type Step = 'IDLE' | 'UPLOADING' | 'ANALYSING' | 'REVIEW' | 'SAVING' | 'SUCCESS'

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
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [extraction, setExtraction] = useState<any>(null)
  const [storagePath, setStoragePath] = useState<string | null>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
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
      
      // Move to Analysis
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
    setExtraction((prev: any) => ({ ...prev, [field]: value }))
  }

  // Calculate live deductible amount
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
      <Link href="/expenses" className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-gray-900 transition-colors">
        <ArrowLeft size={16} /> Back to Expenses
      </Link>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Left Side: Upload or Preview */}
        <Card className="w-full md:w-1/2 overflow-hidden rounded-[32px] border-gray-100 shadow-sm min-h-[400px] flex flex-col relative">
          {(step === 'IDLE' || step === 'UPLOADING' || step === 'ANALYSING') ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6">
               {(step === 'IDLE') ? (
                 <>
                   <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center">
                     <Upload size={32} />
                   </div>
                   <div>
                     <h3 className="text-xl font-bold text-gray-900">Upload Receipt</h3>
                     <p className="text-sm text-gray-400 mt-2">Drag and drop or click to pick a file (JPG, PNG, WebP, PDF)</p>
                   </div>
                   <label className="cursor-pointer">
                     <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleUpload} />
                     <Button className="rounded-2xl h-12 px-8 bg-gray-900 font-bold hover:bg-gray-800 pointer-events-none">
                       Choose File
                     </Button>
                   </label>
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
            <div className="flex-1 bg-gray-100 relative group">
              <img src={previewUrl!} alt="Receipt Preview" className="w-full h-full object-contain" />
              <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-4">
                 <button className="p-2 bg-white rounded-xl shadow-lg text-gray-500 hover:text-gray-900 transition-colors" onClick={() => window.open(previewUrl!, '_blank')}>
                    <Info size={16} />
                 </button>
              </div>
            </div>
          )}
        </Card>

        {/* Right Side: AI Review Form */}
        <div className={cn("w-full md:w-1/2 space-y-6 transition-all duration-500", (step === 'REVIEW' || step === 'SAVING') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none')}>
           <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <span className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                Review AI Extraction
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

           {Number(extraction?.confidenceScore || 1) < 0.7 && (
             <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex gap-3 text-amber-800">
                <AlertCircle className="shrink-0" size={20} />
                <p className="text-xs font-bold leading-relaxed">
                  Low confidence extraction. Please verify all details, particularly the date and Malaysian SST amount.
                </p>
             </div>
           )}

           <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Vendor Name</Label>
                  <Input 
                    value={extraction?.vendorName || ''} 
                    onChange={(e) => updateField('vendorName', e.target.value)}
                    className="h-12 rounded-2xl border-gray-100 focus:ring-blue-500/10"
                    placeholder="e.g. Tenaga Nasional Berhad"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Receipt Date</Label>
                  <Input 
                    type="date"
                    value={extraction?.receiptDate || ''} 
                    onChange={(e) => updateField('receiptDate', e.target.value)}
                    className="h-12 rounded-2xl border-gray-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Category</Label>
                  <Select 
                    value={extraction?.category || 'other'} 
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
                  <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Amount (MYR)</Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">RM</span>
                    <Input 
                      type="number" step="0.01"
                      value={extraction?.totalAmount || 0} 
                      onChange={(e) => updateField('totalAmount', e.target.value)}
                      className="h-12 rounded-2xl border-gray-100 pl-12"
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
                      className="h-12 rounded-2xl border-gray-100 pl-12"
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
                    <Select 
                      value={extraction?.taxDeductible || 'full'} 
                      onValueChange={(v) => {
                        const type = TAX_TYPES.find(t => t.value === v)
                        updateField('taxDeductible', v)
                        updateField('taxDeductiblePct', type?.pct || 100)
                      }}
                    >
                      <SelectTrigger className="bg-white rounded-2xl border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {TAX_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                       <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Deductible Amount</span>
                          <span className="text-lg font-black text-gray-900">RM {deductibleAmt.toFixed(2)}</span>
                       </div>
                       <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
                          <CheckCircle2 size={24} />
                       </div>
                    </div>
                    
                    <p className="text-[10px] text-gray-400 font-medium italic">
                      ℹ️ {extraction?.taxDeductibleReason || 'AI identified this as a valid business expense.'}
                    </p>
                 </div>
              </div>

              <Button 
                type="submit" 
                disabled={step === 'SAVING'}
                className="w-full rounded-[24px] h-14 bg-gray-900 hover:bg-gray-800 text-white font-black text-lg shadow-xl shadow-gray-200 transition-all active:scale-95 gap-3"
              >
                {step === 'SAVING' ? <Loader2 className="animate-spin" /> : <Save size={24} />}
                {step === 'SAVING' ? 'Confirming...' : 'Save & Confirm Expense'}
              </Button>
           </form>
        </div>
      </div>
    </div>
  )
}
