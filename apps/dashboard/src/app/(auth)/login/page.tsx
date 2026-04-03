'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { Label }  from '@/components/ui/label'
import toast      from 'react-hot-toast'

function LoginContent() {
  const router = useRouter()
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)

  const searchParams = useSearchParams()
  const next = searchParams.get('next')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()

    const { data: { user }, error: loginErr } = await supabase.auth.signInWithPassword({ email, password })

    if (loginErr) {
      toast.error(loginErr.message)
      setLoading(false)
      return
    }

    // After login, check the user's role in the profiles table
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user?.id)
      .single()

    if (profileErr || !profile) {
      toast.error('Could not verify account profile.')
      setLoading(false)
      return
    }

    const { role } = profile
    const isMerchant = role === 'merchant'
    const isAdmin = role === 'admin'

    if (!isMerchant && !isAdmin) {
      toast.error('This dashboard is only for merchants and admins.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    // Now check if they have an active merchant record
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('owner_id', user?.id)
      .single()

    if (!merchant && isMerchant) {
      // Allow login but redirect to application/onboarding
      toast.success('Login successful! Redirecting to application...')
      router.push(next || '/apply')
    } else {
      toast.success('Welcome back!')
      router.push(next || '/')
    }
    
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-sm p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Merchant Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to manage your store</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="you@store.com" required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-gray-500 text-sm">
            New to Go-Buy?{' '}
            <button
              onClick={() => router.push('/register')}
              type="button"
              className="text-primary-600 font-semibold hover:underline"
            >
              Apply to be a merchant
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">Loading...</div>}>
      <LoginContent />
    </Suspense>
  )
}
