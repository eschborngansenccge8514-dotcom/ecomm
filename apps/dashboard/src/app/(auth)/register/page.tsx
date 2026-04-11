'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { Label }  from '@/components/ui/label'
import toast      from 'react-hot-toast'
import { User, Mail, Lock, ArrowRight, Loader2, Store } from 'lucide-react'
import { Copyright } from '@/components/public/Copyright'

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading]   = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)
    const supabase = createClient()
    
    const { error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'merchant',
        },
        emailRedirectTo: `${window.location.origin}/login?next=/apply`,
      },
    })

    if (signUpErr) {
      toast.error(signUpErr.message)
      setLoading(false)
      return
    }

    toast.success('Registration successful! Please check your email to verify your account.')
    router.push('/login')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900 overflow-hidden">
      {/* Visual Side */}
      <div className="hidden md:flex md:w-1/2 relative p-12 flex-col justify-between overflow-hidden group border-r border-slate-200">
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105"
          style={{ backgroundImage: 'url("/auth-light-bg.png")' }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent" />
        
        <div className="relative z-10 flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Store className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900">Go-Buy</span>
        </div>

        <div className="relative z-10 max-w-md animate-in fade-in slide-in-from-left duration-700">
          <h2 className="text-4xl lg:text-5xl font-bold mb-6 leading-tight text-slate-900">
            Start Your <span className="text-primary tracking-tighter">Journey</span> With Us
          </h2>
          <p className="text-slate-600 text-lg leading-relaxed font-medium">
            Join thousands of merchants who are growing their business on the Go-Buy Marketplace.
          </p>
        </div>

        <div className="relative z-10 text-slate-500 text-sm font-medium">
          <Copyright company="Go-Buy Marketplace" suffix="All rights reserved." />
        </div>
      </div>

      {/* Form Side */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-white/50 backdrop-blur-3xl relative overflow-y-auto">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="w-full max-w-md py-12 animate-in fade-in slide-in-from-bottom duration-700 delay-200 relative z-10">
          <div className="md:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Store className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">Go-Buy</span>
          </div>

          <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-8 lg:p-10 shadow-2xl shadow-slate-200/50">
            <div className="mb-8 text-center md:text-left">
              <h1 className="text-3xl font-bold mb-2 tracking-tight">Create account</h1>
              <p className="text-slate-500 font-medium">Join our community of successful merchants</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-slate-700 ml-1 font-semibold">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input 
                    id="fullName" 
                    type="text" 
                    value={fullName}
                    onChange={e => setFullName(e.target.value)} 
                    placeholder="Ahmad bin Ali" 
                    required 
                    className="bg-slate-50/50 border-slate-200 h-12 pl-12 focus:ring-primary focus:border-primary text-slate-900 transition-all placeholder:text-slate-400 font-medium rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 ml-1 font-semibold">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input 
                    id="email" 
                    type="email" 
                    value={email}
                    onChange={e => setEmail(e.target.value)} 
                    placeholder="you@store.com" 
                    required 
                    className="bg-slate-50/50 border-slate-200 h-12 pl-12 focus:ring-primary focus:border-primary text-slate-900 transition-all placeholder:text-slate-400 font-medium rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-700 ml-1 font-semibold">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input 
                      id="password" 
                      type="password" 
                      value={password}
                      onChange={e => setPassword(e.target.value)} 
                      placeholder="••••••••" 
                      required 
                      className="bg-slate-50/50 border-slate-200 h-12 pl-12 focus:ring-primary focus:border-primary text-slate-900 transition-all placeholder:text-slate-400 font-medium rounded-xl"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-700 ml-1 font-semibold">Confirm</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input 
                      id="confirmPassword" 
                      type="password" 
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)} 
                      placeholder="••••••••" 
                      required 
                      className="bg-slate-50/50 border-slate-200 h-12 pl-12 focus:ring-primary focus:border-primary text-slate-900 transition-all placeholder:text-slate-400 font-medium rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" className="w-full h-12 text-base font-bold group rounded-xl bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20" disabled={loading}>
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Create Merchant Account
                      <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-slate-500 font-medium">
                Already have an account?{' '}
                <button
                  onClick={() => router.push('/login')}
                  className="text-primary font-bold hover:text-primary/80 transition-colors ml-1"
                >
                  Sign In
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


