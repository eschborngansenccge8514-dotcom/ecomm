'use client'

import React, { useState } from 'react'
import { X, User, Camera, ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react'
import { updateUserProfile, updatePosPin } from '@/lib/pos-actions'
import { toast } from 'react-hot-toast'

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  user: any
  profile: any
}

export function ProfileModal({ isOpen, onClose, user, profile }: ProfileModalProps) {
  const [fullName, setFullName] = useState(profile?.full_name || user?.email?.split('@')[0] || '')
  const [pin, setPin] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'security'>('info')

  const handleSaveInfo = async () => {
    setIsSaving(true)
    try {
      await updateUserProfile({ full_name: fullName })
      toast.success('Profile updated')
    } catch (err) {
      toast.error('Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdatePin = async () => {
    if (pin.length !== 4) {
      toast.error('PIN must be exactly 4 digits')
      return
    }
    setIsSaving(true)
    try {
      await updatePosPin(pin)
      toast.success('POS PIN set successfully')
      setPin('')
      setActiveTab('info')
    } catch (err) {
      toast.error('Failed to set PIN')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                <User size={20} />
             </div>
             <div>
                <h2 className="text-xl font-black text-emerald-900 uppercase tracking-tight">My Profile</h2>
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mt-0.5">Terminal Identity</p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          <button 
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'info' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/20' : 'text-slate-400'}`}
          >
            Basic Info
          </button>
          <button 
            onClick={() => setActiveTab('security')}
            className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'security' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/20' : 'text-slate-400'}`}
          >
            Terminal Security
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {activeTab === 'info' ? (
            <div className="space-y-6">
              {/* Avatar Placeholder */}
              <div className="flex flex-col items-center justify-center py-4">
                 <div className="w-24 h-24 rounded-[2.5rem] bg-slate-100 flex items-center justify-center text-slate-300 relative group overflow-hidden border-2 border-white shadow-xl">
                    <User size={40} />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                       <Camera size={24} className="text-white" />
                    </div>
                 </div>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-3">Operator #001</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Display Name</label>
                <input 
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 font-bold transition-all"
                  placeholder="Enter full name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</label>
                <div className="w-full h-12 px-4 rounded-xl border border-slate-50 bg-slate-50/50 flex items-center text-slate-400 font-bold italic text-sm">
                  {user?.email}
                </div>
              </div>

              <button 
                onClick={handleSaveInfo}
                disabled={isSaving}
                className="w-full h-12 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex gap-3">
                 <ShieldCheck className="text-emerald-500 shrink-0" size={20} />
                 <p className="text-[10px] font-bold text-emerald-900 uppercase leading-relaxed">
                   Set your personal 4-digit PIN for quick access to protected terminal settings and overrides.
                 </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">New 4-Digit POS PIN</label>
                <input 
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full h-14 px-4 rounded-xl border border-slate-100 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 font-bold text-2xl tracking-[1em] text-center transition-all"
                  placeholder="••••"
                />
              </div>

              <button 
                onClick={handleUpdatePin}
                disabled={isSaving || pin.length !== 4}
                className="w-full h-12 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
                {isSaving ? 'Securing...' : 'Set Terminal PIN'}
              </button>

              <p className="text-[9px] font-bold text-slate-400 text-center uppercase tracking-tight">
                This PIN is stored locally and hashed for your protection.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
