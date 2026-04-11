'use client'

import React, { useState } from 'react'
import { X, Settings, Store, Phone, Clock, Percent, Loader2, Save } from 'lucide-react'
import { updateMerchantSettings } from '@/lib/pos-actions'
import { PinPrompt } from './PinPrompt'
import { toast } from 'react-hot-toast'

interface AccountSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  merchant: any
}

export function AccountSettingsModal({ isOpen, onClose, merchant }: AccountSettingsModalProps) {
  const [isAuth, setIsAuth] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // Form State
  const [storeName, setStoreName] = useState(merchant?.store_name || '')
  const [tagline, setTagline] = useState(merchant?.store_config?.tagline || '')
  const [phone, setPhone] = useState(merchant?.store_config?.phone || '')
  const [whatsapp, setWhatsapp] = useState(merchant?.store_config?.whatsapp || '')
  const [taxRate, setTaxRate] = useState(merchant?.store_config?.taxRate?.toString() || '8')

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateMerchantSettings({
        store_name: storeName,
        tagline,
        phone,
        whatsapp,
        tax_rate: parseFloat(taxRate)
      })
      toast.success('Account Settings updated')
      onClose()
    } catch (err) {
      toast.error('Failed to update settings')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-100">
                <Settings size={20} />
             </div>
             <div>
                <h2 className="text-xl font-black text-amber-900 uppercase tracking-tight">Account Settings</h2>
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mt-0.5">Business sovereignty</p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400"
          >
            <X size={24} />
          </button>
        </div>

        {/* Auth Gate or Content */}
        {!isAuth ? (
          <div className="p-10">
            <PinPrompt 
              onSuccess={() => setIsAuth(true)} 
              title="Restricted Area"
              description="PIN required to access business settings"
            />
          </div>
        ) : (
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
            {/* Identity */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Store size={14} className="text-amber-600" />
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Store Identity</h3>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-slate-400 uppercase">Business Name</label>
                <input 
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full h-10 px-4 rounded-xl border border-slate-100 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 text-sm font-bold transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-slate-400 uppercase">Tagline</label>
                <input 
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className="w-full h-10 px-4 rounded-xl border border-slate-100 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 text-sm font-bold transition-all"
                  placeholder="e.g. Freshly Baked Daily"
                />
              </div>
            </div>

            {/* Contact */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 mb-2">
                <Phone size={14} className="text-amber-600" />
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Information</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Business Phone</label>
                  <input 
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-10 px-4 rounded-xl border border-slate-100 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 text-sm font-bold transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">WhatsApp</label>
                  <input 
                    type="text"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="w-full h-10 px-4 rounded-xl border border-slate-100 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 text-sm font-bold transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Operations */}
            <div className="space-y-4 pt-2 border-t border-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={14} className="text-amber-600" />
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operating hours</h3>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">Store Status</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-emerald-600 uppercase">Open</span>
                  <div className="w-10 h-5 bg-emerald-500 rounded-full relative">
                    <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full shadow-sm" />
                  </div>
                </div>
              </div>
            </div>

            {/* Tax */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 mb-2">
                <Percent size={14} className="text-amber-600" />
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Taxation (SST)</h3>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-slate-400 uppercase">Service Tax Rate (%)</label>
                <input 
                  type="number"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="w-full h-10 px-4 rounded-xl border border-slate-100 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 text-sm font-bold transition-all"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4">
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="w-full h-12 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 transition-all shadow-lg shadow-amber-100 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {isSaving ? 'Updating...' : 'Save Business Settings'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
