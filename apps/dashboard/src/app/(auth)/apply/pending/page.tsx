'use client'

import { Shield, Clock, Mail, CheckCircle, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ApplicationPendingPage() {
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg text-center">

        {/* Success Icon */}
        <div className="relative mb-10 w-24 h-24 mx-auto">
          <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-25" />
          <div className="relative w-24 h-24 bg-white rounded-full shadow-xl flex items-center justify-center border-4 border-blue-50">
            <CheckCircle size={48} className="text-blue-600" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-3">Application Submitted!</h1>
        <p className="text-gray-500 mb-10 leading-relaxed max-w-sm mx-auto">
          Thank you for applying to become a merchant. Our team is currently reviewing your business details.
        </p>

        {/* Info Cards */}
        <div className="grid gap-4 mb-10 text-left">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Clock size={20} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Review in Progress</h3>
              <p className="text-xs text-gray-400 mt-1">We typically review new applications within 24–48 hours.</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
              <Mail size={20} className="text-green-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Status Update Email</h3>
              <p className="text-xs text-gray-400 mt-1">You will receive an email notification once your application is approved.</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
              <Shield size={20} className="text-purple-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Trust &amp; Security</h3>
              <p className="text-xs text-gray-400 mt-1">We verify all merchants to maintain a high-quality marketplace for everyone.</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {/* Refresh — lets user re-check their status without being stuck */}
          <Link href="/apply/pending">
            <Button className="w-full rounded-xl py-6 gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              <ChevronRight size={16} /> Check Status Again
            </Button>
          </Link>

          {/* Always-available escape: sign out */}
          <Button
            variant="outline"
            className="w-full rounded-xl py-6 gap-2 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
            onClick={handleSignOut}
          >
            Sign Out
          </Button>

          <div className="flex items-center justify-center gap-2 text-xs text-gray-400 pt-1">
            <Shield size={12} /> Merchant Security Program
          </div>
        </div>

        {/* Footer help */}
        <p className="mt-12 text-sm text-gray-400">
          Need help? Contact our support team at <span className="text-blue-600 font-medium cursor-pointer">support@yourplatform.com</span>
        </p>

      </div>
    </div>
  )
}
