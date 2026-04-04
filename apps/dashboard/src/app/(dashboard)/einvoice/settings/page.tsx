'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Building2, 
  Key, 
  Settings2, 
  Bell, 
  ShieldCheck, 
  RefreshCw, 
  ArrowLeft,
  Check,
  Save,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'

export default function EinvoiceSettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'connection' | 'profile' | 'defaults' | 'notifications'>('connection')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  
  const [formData, setFormData] = useState({
    tin: '',
    registrationNo: '',
    msicCode: '',
    clientId: '',
    clientSecret: '',
    autoSubmit: false,
    defaultSstRate: 6,
    defaultPaymentTerms: '30',
    msmeCategory: 'sdn_bhd',
    b2cFrequency: 'daily',
    notifyOnFailure: true,
    notifyOnExpiry: true,
  })

  useEffect(() => {
    async function loadSettings() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      const { data: merchant } = await supabase.from('merchants').select('id').eq('owner_id', user?.id).single()
      
      if (merchant) {
         const { data: config } = await supabase
           .from('merchant_einvoice_config')
           .select('*')
           .eq('merchant_id', merchant.id)
           .single()

         if (config) {
            setFormData({
               tin: config.tin || '',
               registrationNo: config.registration_no || '',
               msicCode: config.msic_code || '',
               clientId: config.client_id || '',
               clientSecret: '••••••••••••••••', // Masked
               autoSubmit: config.auto_submit || false,
               defaultSstRate: config.default_sst_rate || 6,
               defaultPaymentTerms: config.default_payment_terms || '30',
               msmeCategory: config.msme_category || 'sdn_bhd',
               b2cFrequency: config.b2c_frequency || 'daily',
               notifyOnFailure: true,
               notifyOnExpiry: true,
            })
         }
      }
      setLoading(false)
    }
    loadSettings()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: merchant } = await supabase.from('merchants').select('id').eq('owner_id', user?.id).single()

      const updateData: any = {
        tin: formData.tin,
        registration_no: formData.registrationNo,
        msic_code: formData.msicCode,
        client_id: formData.clientId,
        auto_submit: formData.autoSubmit,
        default_sst_rate: formData.defaultSstRate,
        default_payment_terms: formData.defaultPaymentTerms,
        msme_category: formData.msmeCategory,
        b2c_frequency: formData.b2cFrequency,
      }

      // Only update secret if changed from mask
      if (formData.clientSecret !== '••••••••••••••••') {
         updateData.client_secret = formData.clientSecret
      }

      const { error } = await supabase
        .from('merchant_einvoice_config')
        .upsert({ 
          merchant_id: merchant?.id,
          ...updateData,
          updated_at: new Date().toISOString()
        })

      if (error) throw error
      toast.success('Settings updated successfully')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const renderConnection = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
       <div className="space-y-1">
          <h3 className="text-xl font-black text-gray-900 tracking-tight">LHDN Connection</h3>
          <p className="text-sm text-gray-500 font-medium">Manage your API credentials for the MyInvois Portal.</p>
       </div>

       <div className="bg-white border border-gray-100 rounded-3xl p-8 space-y-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Environment</label>
                <div className="flex p-1 bg-gray-50 rounded-xl w-fit">
                   <div className="px-4 py-1.5 bg-white rounded-lg text-xs font-black text-blue-600 shadow-sm border border-blue-100">Development (Sandbox)</div>
                   <div className="px-4 py-1.5 text-xs font-bold text-gray-400">Production</div>
                </div>
             </div>
             
             <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Connection Status</label>
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                   <span className="text-sm font-bold text-emerald-600">Connected & Verified</span>
                </div>
             </div>

             <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Client ID</label>
                <div className="relative">
                   <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                   <input 
                     type="text" 
                     value={formData.clientId}
                     onChange={(e) => setFormData({...formData, clientId: e.target.value})}
                     className="w-full pl-11 pr-4 py-4 bg-gray-50 border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-600 transition-all border font-mono"
                   />
                </div>
             </div>

             <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Client Secret</label>
                <div className="relative">
                   <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                   <input 
                     type={showSecret ? "text" : "password"} 
                     value={formData.clientSecret}
                     onChange={(e) => setFormData({...formData, clientSecret: e.target.value})}
                     className="w-full pl-11 pr-14 py-4 bg-gray-50 border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-600 transition-all border font-mono"
                   />
                   <button 
                     onClick={() => setShowSecret(!showSecret)}
                     className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-900 transition-colors"
                   >
                      {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                   </button>
                </div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Client secret is never displayed once saved.</p>
             </div>
          </div>
          
          <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
             <button className="text-xs font-black text-gray-400 uppercase tracking-widest hover:text-gray-900 transition-colors flex items-center gap-2">
                <RefreshCw size={14} /> Re-test Connection
             </button>
             <p className="text-[9px] font-bold text-gray-300 uppercase tracking-[0.2em]">Verified: 04 April 2026</p>
          </div>
       </div>

       <div className="bg-slate-900 text-white rounded-3xl p-8 flex items-center justify-between gap-8 relative overflow-hidden">
          <div className="space-y-2 relative z-10">
             <h4 className="text-lg font-black tracking-tight">Digital Certificate Management</h4>
             <p className="text-xs text-slate-400 font-medium">Your current certificate expires in <span className="text-orange-400">221 days</span>.</p>
          </div>
          <button className="bg-white text-slate-900 px-6 py-2.5 rounded-xl text-xs font-black hover:bg-slate-50 transition-all z-10 shrink-0">
             Upload New (.p12)
          </button>
          <ShieldCheck className="absolute right-0 top-0 text-white opacity-5 translate-x-1/4 -translate-y-1/4" size={180} />
       </div>
    </div>
  )

  const renderProfile = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
       <div className="space-y-1">
          <h3 className="text-xl font-black text-gray-900 tracking-tight">Business Profile</h3>
          <p className="text-sm text-gray-500 font-medium">Verify your statutory and tax identification details.</p>
       </div>

       <div className="bg-white border border-gray-100 rounded-3xl p-8 grid grid-cols-1 md:grid-cols-2 gap-8 shadow-sm">
          <div className="space-y-2">
             <label className="text-xs font-black uppercase tracking-widest text-gray-400">Tax Identification No (TIN)</label>
             <input 
               type="text" 
               value={formData.tin}
               onChange={(e) => setFormData({...formData, tin: e.target.value})}
               className="w-full px-5 py-4 bg-gray-50 border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-600 transition-all border"
             />
          </div>
          <div className="space-y-2">
             <label className="text-xs font-black uppercase tracking-widest text-gray-400">Business Registration (SSM)</label>
             <input 
               type="text" 
               value={formData.registrationNo}
               onChange={(e) => setFormData({...formData, registrationNo: e.target.value})}
               className="w-full px-5 py-4 bg-gray-50 border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-600 transition-all border"
             />
          </div>
          <div className="space-y-2">
             <label className="text-xs font-black uppercase tracking-widest text-gray-400">MSIC Code</label>
             <input 
               type="text" 
               value={formData.msicCode}
               onChange={(e) => setFormData({...formData, msicCode: e.target.value})}
               className="w-full px-5 py-4 bg-gray-50 border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-600 transition-all border"
             />
          </div>
          <div className="space-y-2">
             <label className="text-xs font-black uppercase tracking-widest text-gray-400">MSME Category</label>
             <select 
               value={formData.msmeCategory}
               onChange={(e) => setFormData({...formData, msmeCategory: e.target.value})}
               className="w-full px-5 py-4 bg-gray-50 border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-600 transition-all border appearance-none cursor-pointer"
             >
                <option value="sole_proprietor">Sole Proprietor</option>
                <option value="partnership">Partnership</option>
                <option value="sdn_bhd">Sdn Bhd</option>
                <option value="llp">Limited Liability Partnership</option>
             </select>
          </div>
       </div>

       <div className="p-6 bg-blue-50/50 rounded-[2rem] border border-blue-100 flex items-start gap-4">
          <Building2 className="text-blue-600 mt-1" size={24} />
          <div className="space-y-1">
             <h4 className="text-sm font-black text-gray-900 leading-tight tracking-tight">Managed Business Address</h4>
             <p className="text-xs text-gray-500 leading-relaxed font-medium">Your primary billing address is synced from your global merchant profile. To change it, visit <br />
                <a href="#" className="text-blue-600 font-bold hover:underline">Merchant Settings → Profile</a>
             </p>
          </div>
       </div>
    </div>
  )

  const renderDefaults = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
       <div className="space-y-1">
          <h3 className="text-xl font-black text-gray-900 tracking-tight">Invoice Defaults</h3>
          <p className="text-sm text-gray-500 font-medium">Configure how automatic submissions are handled.</p>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white border border-gray-100 rounded-3xl p-8 space-y-6 shadow-sm">
             <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Default SST Rate</label>
                <div className="grid grid-cols-3 gap-3">
                   {[0, 6, 8].map(r => (
                     <button 
                       key={r}
                       onClick={() => setFormData({...formData, defaultSstRate: r})}
                       className={cn(
                        "py-3 rounded-xl text-sm font-bold border transition-all",
                        formData.defaultSstRate === r ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-100 hover:border-gray-200"
                       )}
                     >
                       {r}%
                     </button>
                   ))}
                </div>
             </div>

             <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Payment Terms</label>
                <select 
                  value={formData.defaultPaymentTerms}
                  onChange={(e) => setFormData({...formData, defaultPaymentTerms: e.target.value})}
                  className="w-full px-4 py-3.5 bg-gray-50 border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-600 transition-all border appearance-none cursor-pointer"
                >
                   <option value="0">Cash on Receipt</option>
                   <option value="15">15 Days</option>
                   <option value="30">30 Days</option>
                   <option value="60">60 Days</option>
                </select>
             </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-3xl p-8 space-y-6 shadow-sm">
             <div className="flex items-center justify-between">
                <div className="space-y-1">
                   <h4 className="text-sm font-black text-gray-900 tracking-tight">Auto-Submission</h4>
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Standard Compliance</p>
                </div>
                <button 
                   onClick={() => setFormData({...formData, autoSubmit: !formData.autoSubmit})}
                   className={cn(
                    "w-14 h-8 rounded-full p-1 transition-colors duration-300",
                    formData.autoSubmit ? "bg-blue-600" : "bg-gray-200"
                   )}
                >
                   <div className={cn(
                    "w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300",
                    formData.autoSubmit ? "translate-x-6" : "translate-x-0"
                   )} />
                </button>
             </div>
             <p className="text-xs text-gray-500 leading-relaxed font-medium">
                When enabled, MerchantMind will automatically submit all new orders to LHDN for validation as soon as they are completed.
             </p>

             <div className="pt-4 border-t border-gray-50 space-y-4">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Consolidation Frequency</label>
                <div className="flex p-1 bg-gray-50 rounded-xl">
                   <button 
                     onClick={() => setFormData({...formData, b2cFrequency: 'daily'})}
                     className={cn(
                       "flex-1 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                       formData.b2cFrequency === 'daily' ? "bg-white text-blue-600 shadow-sm" : "text-gray-400"
                     )}
                   >
                     Daily Batch
                   </button>
                   <button 
                     onClick={() => setFormData({...formData, b2cFrequency: 'monthly'})}
                     className={cn(
                       "flex-1 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                       formData.b2cFrequency === 'monthly' ? "bg-white text-blue-600 shadow-sm" : "text-gray-400"
                     )}
                   >
                     Monthly Batch
                   </button>
                </div>
             </div>
          </div>
       </div>
    </div>
  )

  const renderNotifications = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
       <div className="space-y-1">
          <h3 className="text-xl font-black text-gray-900 tracking-tight">Notifications</h3>
          <p className="text-sm text-gray-500 font-medium">Choose how you want to be alerted about LHDN events.</p>
       </div>

       <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden divide-y divide-gray-50 shadow-sm">
          {[
            { id: 'notifyOnFailure', label: 'LHDN Validation Failure', desc: 'Urgent email when an invoice is rejected by LHDN portal.', icon: AlertCircle, color: 'text-rose-500' },
            { id: 'notifyOnSuccess', label: 'Compliance Confirmation', desc: 'A monthly summary of all validated and compliant invoices.', icon: Check, color: 'text-emerald-500' },
            { id: 'notifyOnExpiry', label: 'Certificate Renewal Reminder', desc: 'Alerts starting 30 days before digital certificate expiry.', icon: Bell, color: 'text-amber-500' },
          ].map((item) => (
             <div key={item.id} className="p-6 flex items-start justify-between gap-6 hover:bg-gray-100/30 transition-all">
                <div className="flex items-start gap-4">
                   <div className={cn("mt-1 shrink-0", item.color)}>
                      <item.icon size={20} />
                   </div>
                   <div className="space-y-1">
                      <h4 className="text-sm font-black text-gray-900 tracking-tight leading-none uppercase tracking-widest">{item.label}</h4>
                      <p className="text-xs text-gray-500 font-medium leading-relaxed max-w-sm">{item.desc}</p>
                   </div>
                </div>
                <button 
                   onClick={() => setFormData({...formData, [item.id]: !formData[item.id]})}
                   className={cn(
                    "w-12 h-7 rounded-full p-1 transition-colors duration-300 shrink-0",
                    formData[item.id as keyof typeof formData] ? "bg-blue-600" : "bg-gray-200"
                   )}
                >
                   <div className={cn(
                    "w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300",
                    formData[item.id as keyof typeof formData] ? "translate-x-5" : "translate-x-0"
                   )} />
                </button>
             </div>
          ))}
       </div>
    </div>
  )

  const renderTabContent = () => {
    switch (activeTab) {
      case 'connection': return renderConnection()
      case 'profile': return renderProfile()
      case 'defaults': return renderDefaults()
      case 'notifications': return renderNotifications()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
         <RefreshCw className="animate-spin text-blue-600" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-32">
       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1">
             <button onClick={() => router.push('/einvoice')} className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-widest mb-2">
                <ArrowLeft size={14} /> Back to Hub
             </button>
             <h1 className="text-3xl font-black text-gray-900 tracking-tight">Configuration Settings</h1>
          </div>
          
          <button 
            disabled={saving}
            onClick={handleSave}
            className="flex items-center gap-2 px-8 py-3 bg-gray-900 text-white rounded-2xl font-black text-sm hover:bg-black transition-all shadow-xl shadow-gray-200"
          >
             {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
             {saving ? 'Saving...' : 'Save Changes'}
          </button>
       </div>

       <div className="flex flex-col lg:flex-row gap-8">
          {/* Vertical Tabs Sidebar */}
          <div className="w-full lg:w-72 space-y-2">
             {[
               { id: 'connection', label: 'LHDN Connection', icon: Key },
               { id: 'profile', label: 'Business Profile', icon: Building2 },
               { id: 'defaults', label: 'Invoice Defaults', icon: Settings2 },
               { id: 'notifications', label: 'Notifications', icon: Bell },
             ].map((tab) => (
               <button 
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id as any)}
                 className={cn(
                   "w-full flex items-center justify-between p-4 rounded-2xl text-left transition-all",
                   activeTab === tab.id ? 
                   "bg-white shadow-xl shadow-gray-200/50 text-blue-600 ring-1 ring-gray-100" : 
                   "text-gray-400 hover:text-gray-900 hover:bg-white/50"
                 )}
               >
                 <div className="flex items-center gap-3">
                    <tab.icon size={18} className={cn(activeTab === tab.id ? "text-blue-600" : "text-gray-300")} />
                    <span className="text-sm font-black tracking-tight">{tab.label}</span>
                 </div>
                 {activeTab === tab.id && <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />}
               </button>
             ))}
          </div>

          {/* Main Content Area */}
          <div className="flex-1">
             {renderTabContent()}
          </div>
       </div>
    </div>
  )
}
