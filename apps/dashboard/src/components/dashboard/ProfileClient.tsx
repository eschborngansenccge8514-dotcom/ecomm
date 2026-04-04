'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'react-hot-toast'
import { User, Mail, Shield, Save, Loader2, Key } from 'lucide-react'

interface ProfileClientProps {
  initialProfile: any
  email: string
}

export function ProfileClient({ initialProfile, email }: ProfileClientProps) {
  const [fullName, setFullName] = useState(initialProfile?.full_name || '')
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const supabase = createClient()

  const handleSave = async () => {
    if (!fullName.trim()) {
      toast.error('Full Name is required')
      return
    }

    setIsSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', initialProfile.id)

    if (error) {
      toast.error(`Error: ${error.message}`)
    } else {
      toast.success('Profile updated successfully!')
    }
    setIsSaving(false)
  }

  const handlePasswordReset = async () => {
    setIsResetting(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/profile`,
    })

    if (error) {
      toast.error(`Error: ${error.message}`)
    } else {
      toast.success('Password reset link sent to your email!')
    }
    setIsResetting(false)
  }

  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">My Profile</h1>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Manage your personal identity and security</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Card */}
        <Card className="md:col-span-2 border-slate-200 shadow-xl shadow-slate-100 rounded-3xl overflow-hidden border-none bg-white">
          <CardHeader className="bg-slate-900 text-white p-8">
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20 border-4 border-white/20 shadow-2xl">
                <AvatarImage src={initialProfile?.avatar_url} />
                <AvatarFallback className="bg-white text-slate-900 text-2xl font-black">{initials}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <CardTitle className="text-2xl font-black uppercase tracking-tight">{fullName || 'User'}</CardTitle>
                <CardDescription className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Active Member</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="grid gap-6">
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <User size={14} /> Full Name Management
                </Label>
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-12 px-4 rounded-xl border-slate-200 focus:ring-slate-900 focus:border-slate-900 font-bold text-slate-900 transition-all text-sm"
                  placeholder="Enter your full name"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Mail size={14} /> Registered Email
                </Label>
                <div className="h-12 px-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center text-slate-500 font-bold text-sm">
                  {email}
                  <Shield size={14} className="ml-2 text-emerald-500" />
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Email cannot be changed directly for security reasons.</p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-end">
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              className="h-11 px-8 rounded-xl bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all"
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Update Identity
            </Button>
          </CardFooter>
        </Card>

        {/* Security / Stats Card */}
        <div className="space-y-8">
          <Card className="border-slate-200 shadow-xl shadow-slate-100 rounded-3xl overflow-hidden border-none bg-white">
            <CardHeader className="p-6 border-b border-slate-50 flex items-center gap-4">
               <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <Key size={20} />
               </div>
               <div>
                  <CardTitle className="text-sm font-black uppercase tracking-tight">Security</CardTitle>
               </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <p className="text-xs font-bold text-slate-500 leading-relaxed">
                Protect your account by regularly updating your password. We'll send a secure link to your email.
              </p>
              <Button 
                variant="outline"
                onClick={handlePasswordReset}
                disabled={isResetting}
                className="w-full h-11 rounded-xl border-slate-200 hover:bg-slate-50 text-slate-900 font-black text-[10px] uppercase tracking-widest transition-all"
              >
                {isResetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                Reset Password
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xl shadow-slate-100 rounded-3xl overflow-hidden border-none bg-slate-900 text-white">
            <CardContent className="p-8">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Account Status</h4>
               <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-black uppercase tracking-tight">Verified Merchant</span>
               </div>
               <div className="mt-6 pt-6 border-t border-white/10 flex items-center gap-4">
                  <div>
                    <p className="text-2xl font-black">100%</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Trust Score</p>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div>
                    <p className="text-2xl font-black">∞</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Transactions</p>
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
