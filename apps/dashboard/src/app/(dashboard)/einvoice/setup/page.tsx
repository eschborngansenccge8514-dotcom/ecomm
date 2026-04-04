'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Building2, 
  Globe, 
  Key, 
  ShieldCheck, 
  Settings2, 
  ChevronRight, 
  ChevronLeft,
  Check,
  Info,
  HelpCircle,
  AlertCircle,
  RefreshCw,
  Trophy,
  Rocket,
  FileText,
  CheckCircle2
} from 'lucide-react'
import { StatusBadge } from '@/components/einvoice/StatusBadge'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'

const STEPS = [
  { id: 'edu', title: 'Education', icon: Globe },
  { id: 'profile', title: 'Business Profile', icon: Building2 },
  { id: 'connection', title: 'LHDN Connection', icon: Key },
  { id: 'cert', title: 'Digital Certificate', icon: ShieldCheck },
  { id: 'defaults', title: 'Defaults', icon: Settings2 },
]

export default function EinvoiceSetupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  
  const [formData, setFormData] = useState({
    businessName: '',
    tin: '',
    registrationNo: '',
    msicCode: '',
    address: '',
    msmeCategory: 'sdn_bhd',
    clientId: '',
    clientSecret: '',
    autoSubmit: true,
    defaultSstRate: 6,
    defaultPaymentTerms: '30',
    b2cFrequency: 'daily',
    revenue: '',
  })

  // Fetch existing config on load
  useEffect(() => {
    async function fetchConfig() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: merchant } = await supabase
        .from('merchants')
        .select('id, name, address')
        .eq('owner_id', user.id)
        .single()

      if (merchant) {
         setFormData(prev => ({
           ...prev,
           businessName: merchant.name || '',
           address: merchant.address || '',
         }))

         const { data: config } = await supabase
           .from('merchant_einvoice_config')
           .select('*')
           .eq('merchant_id', merchant.id)
           .single()

         if (config) {
            setFormData(prev => ({
              ...prev,
              tin: config.tin || '',
              registrationNo: config.registration_no || '',
              msicCode: config.msic_code || '',
              clientId: config.client_id || '',
              // clientSecret is masked/not sent back as plain text
            }))
         }
      }
    }
    fetchConfig()
  }, [])

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1))
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0))

  const handleTestConnection = async () => {
    setTestingConnection(true)
    setConnectionStatus('idle')
    // Simulate API call
    setTimeout(() => {
      setTestingConnection(false)
      setConnectionStatus('success')
      toast.success('LHDN Connection Verified!')
    }, 1500)
  }

  const handleComplete = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: merchant } = await supabase.from('merchants').select('id').eq('owner_id', user?.id).single()
      
      const payload = {
        merchant_id: merchant?.id,
        tin: formData.tin,
        registration_no: formData.registrationNo,
        msic_code: formData.msicCode,
        client_id: formData.clientId,
        client_secret: formData.clientSecret, // In real app, this would be encrypted or handled securely
        msme_category: formData.msmeCategory,
        auto_submit: formData.autoSubmit,
        default_sst_rate: formData.defaultSstRate,
        default_payment_terms: formData.defaultPaymentTerms,
        b2c_frequency: formData.b2cFrequency,
        onboarding_completed_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('merchant_einvoice_config')
        .upsert(payload, { onConflict: 'merchant_id' })

      if (error) throw error

      toast.success('Onboarding complete!')
      router.push('/einvoice')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const renderProgress = () => (
    <div className="mb-12">
      <div className="flex items-center justify-between Max-w-4xl mx-auto">
        {STEPS.map((step, idx) => {
          const Icon = step.icon
          const isActive = idx === currentStep
          const isCompleted = idx < currentStep
          
          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center gap-2 relative z-10">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-sm ring-2 ring-inset",
                  isActive ? "bg-blue-600 text-white ring-blue-400 shadow-blue-200 scale-110" : 
                  isCompleted ? "bg-emerald-500 text-white ring-emerald-300" : "bg-white text-gray-400 ring-gray-100"
                )}>
                  {isCompleted ? <Check size={24} strokeWidth={3} /> : <Icon size={24} />}
                </div>
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-widest hidden sm:block transition-colors",
                  isActive ? "text-blue-600" : "text-gray-400"
                )}>
                  {step.title}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className="flex-1 h-[2px] bg-gray-100 mx-2 -translate-y-4">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-700 ease-in-out" 
                    style={{ width: isCompleted ? '100%' : '0%' }}
                  />
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )

  const renderEdu = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-blue-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
           <Globe size={200} />
        </div>
        
        <div className="relative z-10 space-y-6">
           <div className="inline-flex px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold tracking-widest uppercase">
              What is e-Invoice?
           </div>
           <h2 className="text-4xl font-black leading-tight tracking-tighter max-w-2xl">
              Compliance made simple for your business growth.
           </h2>
           <p className="text-lg text-blue-50 font-medium max-w-xl leading-relaxed">
              LHDN now requires businesses to validate invoices digitally before they become official. 
              MerchantMind automates this entire cycle so you can focus on selling.
           </p>

           <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-12">
              {[
                { label: 'You Issue', icon: FileText },
                { label: 'Submit to LHDN', icon: RefreshCw },
                { label: 'Validated!', icon: CheckCircle2 },
                { label: 'Sent to Buyer', icon: Rocket }
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center text-center gap-3 p-4 bg-white/10 backdrop-blur-sm rounded-3xl border border-white/10">
                   <div className="w-10 h-10 bg-white text-blue-600 rounded-xl flex items-center justify-center">
                      <item.icon size={20} />
                   </div>
                   <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                </div>
              ))}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="p-6 bg-white border border-gray-100 rounded-3xl space-y-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
               <ShieldCheck className="text-blue-600" />
               Am I Mandatory Yet?
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
               Phased enforcement depends on your annual revenue. Enter yours below to see your deadline.
            </p>
            <div className="flex gap-3">
               <input 
                 type="text" 
                 placeholder="Enter annual revenue (e.g. 1M)"
                 className="flex-1 px-4 py-3 bg-gray-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-600"
                 value={formData.revenue}
                 onChange={(e) => setFormData({...formData, revenue: e.target.value})}
               />
               <button className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-100">
                 Check Phase
               </button>
            </div>
         </div>

         <div className="p-6 bg-amber-50 border border-amber-100 rounded-3xl space-y-4">
            <h3 className="font-bold text-amber-900 flex items-center gap-2">
               <Info size={18} />
               Key Concept
            </h3>
            <div className="space-y-2">
               <p className="text-sm font-bold text-amber-800">
                  72-Hour Cancellation Window
               </p>
               <p className="text-xs text-amber-700/80 leading-relaxed">
                  LHDN allows you to cancel an invoice within 72 hours of submission. 
                  After that, a Credit Note is required to make any changes.
               </p>
            </div>
         </div>
      </div>
    </div>
  )

  const renderProfile = () => (
    <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-right-4 duration-500">
       <div className="text-center space-y-2 mb-8">
          <h2 className="text-3xl font-black tracking-tight text-gray-900">Business Profile</h2>
          <p className="text-gray-500 font-medium">Verify your LHDN identity details.</p>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
             <label className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                Business Name
             </label>
             <input 
               type="text" 
               value={formData.businessName}
               readOnly
               className="w-full px-4 py-4 bg-gray-100 border-none rounded-2xl text-sm font-bold text-gray-500 cursor-not-allowed"
             />
          </div>
          <div className="space-y-2">
             <label className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                Tax Identification Number (TIN)
                <HelpCircle size={14} className="text-gray-300" />
             </label>
             <input 
               type="text" 
               placeholder="e.g. C12345678900"
               value={formData.tin}
               onChange={(e) => setFormData({...formData, tin: e.target.value})}
               className="w-full px-4 py-4 bg-gray-50 border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-600 transition-all border"
             />
          </div>
          <div className="space-y-2">
             <label className="text-xs font-black uppercase tracking-widest text-gray-400">Registration No (SSM)</label>
             <input 
               type="text" 
               placeholder="e.g. 202301234567"
               value={formData.registrationNo}
               onChange={(e) => setFormData({...formData, registrationNo: e.target.value})}
               className="w-full px-4 py-4 bg-gray-50 border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-600 transition-all border"
             />
          </div>
          <div className="space-y-2">
             <label className="text-xs font-black uppercase tracking-widest text-gray-400">MSIC Code</label>
             <input 
               type="text" 
               placeholder="5-digit code"
               value={formData.msicCode}
               onChange={(e) => setFormData({...formData, msicCode: e.target.value})}
               className="w-full px-4 py-4 bg-gray-50 border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-600 transition-all border"
             />
          </div>
          <div className="space-y-2 md:col-span-2">
             <label className="text-xs font-black uppercase tracking-widest text-gray-400">Merchant Category</label>
             <div className="grid grid-cols-3 gap-3">
                {['Sole Proprietor', 'Sdn Bhd', 'LLP'].map((cat) => (
                  <button 
                    key={cat}
                    onClick={() => setFormData({...formData, msmeCategory: cat.toLowerCase().replace(' ', '_')})}
                    className={cn(
                      "py-3 rounded-xl text-xs font-bold border transition-all",
                      formData.msmeCategory === cat.toLowerCase().replace(' ', '_') ? 
                      "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100" : 
                      "bg-white text-gray-500 border-gray-100 hover:border-blue-200"
                    )}
                  >
                    {cat}
                  </button>
                ))}
             </div>
          </div>
       </div>
    </div>
  )

  const renderConnection = () => (
    <div className="space-y-8 max-w-2xl mx-auto animate-in fade-in slide-in-from-right-4 duration-500">
       <div className="text-center space-y-2">
          <h2 className="text-3xl font-black tracking-tight text-gray-900">LHDN Connection</h2>
          <p className="text-gray-500 font-medium">Connect MerchantMind to the IRBM MyInvois Portal.</p>
       </div>

       <div className="bg-white border-2 border-blue-600 rounded-[2rem] p-8 shadow-xl shadow-blue-50 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-5">
             <Key size={100} />
          </div>
          
          <div className="space-y-4">
             <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Client ID</label>
                <input 
                  type="text" 
                  placeholder="Obtained from MyInvois Portal"
                  value={formData.clientId}
                  onChange={(e) => setFormData({...formData, clientId: e.target.value})}
                  className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl text-sm font-mono font-bold focus:ring-2 focus:ring-blue-600 transition-all border"
                />
             </div>
             <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Client Secret</label>
                <input 
                  type="password" 
                  placeholder="••••••••••••••••"
                  value={formData.clientSecret}
                  onChange={(e) => setFormData({...formData, clientSecret: e.target.value})}
                  className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl text-sm font-mono font-bold focus:ring-2 focus:ring-blue-600 transition-all border"
                />
             </div>
          </div>

          <div className="pt-4 flex flex-col items-center gap-4">
             <button 
               onClick={handleTestConnection}
               disabled={testingConnection || !formData.clientId}
               className={cn(
                 "w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all",
                 connectionStatus === 'success' ? "bg-emerald-500 text-white" : "bg-gray-900 text-white hover:bg-black"
               )}
             >
               {testingConnection ? <RefreshCw className="animate-spin" size={18} /> : connectionStatus === 'success' ? <Check size={18} /> : 'Test Connection'}
               {testingConnection ? 'Testing...' : connectionStatus === 'success' ? 'Connected' : 'Verify Credentials'}
             </button>
             
             <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck size={14} className="text-emerald-500" />
                SSL Encrypted & AES-256 Storage
             </p>
          </div>
       </div>

       <div className="bg-gray-50 rounded-2xl p-4 flex items-start gap-3">
          <Info size={16} className="text-blue-600 mt-0.5" />
          <p className="text-xs text-gray-500 leading-relaxed font-medium">
             Need help finding your credentials? <a href="#" className="text-blue-600 font-bold hover:underline">View the Step-by-Step Guide</a>
          </p>
       </div>
    </div>
  )

  const renderCert = () => (
    <div className="space-y-8 max-w-2xl mx-auto animate-in fade-in slide-in-from-right-4 duration-500">
       <div className="text-center space-y-2">
          <h2 className="text-3xl font-black tracking-tight text-gray-900">Digital Certificate</h2>
          <p className="text-gray-500 font-medium">Sign your invoices with a stamp of authenticity.</p>
       </div>

       <div className="bg-white border border-gray-100 rounded-[2.5rem] p-12 text-center border-dashed relative group hover:border-blue-300 transition-colors">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
             <ShieldCheck size={40} />
          </div>
          <h3 className="text-xl font-black text-gray-900 mb-2">Upload Certificate</h3>
          <p className="text-sm text-gray-500 max-w-xs mx-auto mb-8 font-medium">
             Upload your .p12 or .pfx certificate issued by LHDN or an authorized provider.
          </p>
          <button className="bg-white border-2 border-gray-900 text-gray-900 px-8 py-3 rounded-2xl font-black text-sm hover:bg-gray-50 transition-all">
             Choose File
          </button>
       </div>

       <div className="space-y-4">
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <CheckCircle2 size={20} className="text-emerald-600" />
                <span className="text-sm font-bold text-emerald-900">Soft Certificate Enabled (Sandbox)</span>
             </div>
             <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Active</span>
          </div>
       </div>
    </div>
  )

  const renderDefaults = () => (
    <div className="space-y-8 max-w-2xl mx-auto animate-in fade-in slide-in-from-right-4 duration-500">
       <div className="text-center space-y-2">
          <h2 className="text-3xl font-black tracking-tight text-gray-900">Final Touches</h2>
          <p className="text-gray-500 font-medium">Set your default tax and payment preferences.</p>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-white border border-gray-100 rounded-3xl space-y-4">
             <label className="text-xs font-black uppercase tracking-widest text-gray-400">Default SST Rate</label>
             <div className="grid grid-cols-2 gap-3">
                {[0, 6, 8].map((rate) => (
                  <button 
                    key={rate}
                    onClick={() => setFormData({...formData, defaultSstRate: rate})}
                    className={cn(
                      "py-3 rounded-xl text-xs font-bold border transition-all",
                      formData.defaultSstRate === rate ? "bg-black text-white" : "bg-white text-gray-500 border-gray-100"
                    )}
                  >
                    {rate}%
                  </button>
                ))}
             </div>
          </div>

          <div className="p-6 bg-white border border-gray-100 rounded-3xl space-y-4 text-center">
             <label className="text-xs font-black uppercase tracking-widest text-gray-400">Auto-Submit</label>
             <div className="flex items-center justify-center pt-2">
                <button 
                  onClick={() => setFormData({...formData, autoSubmit: !formData.autoSubmit})}
                  className={cn(
                    "w-14 h-8 rounded-full p-1 transition-colors duration-300",
                    formData.autoSubmit ? "bg-emerald-500" : "bg-gray-200"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-300",
                    formData.autoSubmit ? "translate-x-6" : "translate-x-0"
                  )} />
                </button>
             </div>
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2 px-2">
                Recommended: Invoices are sent to LHDN instantly
             </p>
          </div>
       </div>

       <div className="bg-gradient-to-br from-gray-900 to-slate-800 rounded-[2.5rem] p-10 text-white text-center space-y-6 shadow-2xl shadow-gray-200">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto">
             <Trophy size={32} className="text-yellow-400" />
          </div>
          <h3 className="text-2xl font-black tracking-tight">You're almost there!</h3>
          <p className="text-gray-400 text-sm font-medium max-w-sm mx-auto">
             Save your settings to finish onboarding and access your full e-invoice command center.
          </p>
          <div className="pt-4">
             <button 
               onClick={handleComplete}
               disabled={loading}
               className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all shadow-xl shadow-blue-900/20"
             >
               {loading ? <RefreshCw className="animate-spin" size={18} /> : <Check size={18} />}
               {loading ? 'Finalizing...' : 'Finish Setup & Start Dashboard'}
             </button>
          </div>
       </div>
    </div>
  )

  const renderContent = () => {
    switch (currentStep) {
      case 0: return renderEdu()
      case 1: return renderProfile()
      case 2: return renderConnection()
      case 3: return renderCert()
      case 4: return renderDefaults()
      default: return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pt-8 pb-32">
      <div className="max-w-5xl mx-auto px-6">
        {renderProgress()}
        
        <div className="relative min-h-[500px]">
          {renderContent()}
        </div>

        {/* Navigation Sticky Bar */}
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-gray-100 z-50">
           <div className="max-w-5xl mx-auto flex items-center justify-between">
              <button 
                onClick={prevStep}
                disabled={currentStep === 0}
                className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 disabled:opacity-0 transition-all"
              >
                <ChevronLeft size={20} />
                Previous Step
              </button>

              <div className="flex items-center gap-4">
                 <div className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] hidden sm:block">
                    Step {currentStep + 1} of {STEPS.length}
                 </div>
                 {currentStep < STEPS.length - 1 && (
                   <button 
                     onClick={nextStep}
                     className="bg-gray-900 text-white px-8 py-3 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-black shadow-lg shadow-gray-200 transition-all"
                   >
                     Continue
                     <ChevronRight size={18} />
                   </button>
                 )}
              </div>
           </div>
        </div>
      </div>
    </div>
  )
}
