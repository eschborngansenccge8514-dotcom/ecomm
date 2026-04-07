'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Globe, ArrowLeft, CheckCircle2, AlertCircle, ExternalLink, Lock } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

export default function ConnectMetaPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [appId, setAppId] = useState('')
  const [appSecret, setAppSecret] = useState('')

  const handleConnect = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Get merchant ID for the current user
      const { data: merchant, error: merchantError } = await supabase
        .from('merchants')
        .select('id')
        .eq('owner_id', user.id)
        .single()
      
      if (merchantError || !merchant) throw new Error('Merchant not found')
      
      const merchantId = merchant.id

      // Construct Meta OAuth URL
      const appId = process.env.NEXT_PUBLIC_META_APP_ID || 'YOUR_META_APP_ID'
      const redirectUri = encodeURIComponent(`https://functions-worker.jjooi1707.workers.dev/meta/callback`)
      
      const scopes = [
        'public_profile',
        'instagram_basic',
        'instagram_content_publish',
        'pages_show_list',
        'pages_read_engagement',
        'pages_manage_posts'
      ].join(',')

      const authUrl = `https://www.facebook.com/v25.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&state=${merchantId}&scope=${scopes}`

      // Redirect user to Meta
      window.location.href = authUrl
    } catch (err: any) {
      toast.error(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/social" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors uppercase font-black tracking-widest">
        <ArrowLeft size={14} />
        Back to Social Hub
      </Link>

      <div className="bg-white border rounded-3xl p-8 shadow-sm space-y-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <Globe size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight uppercase">Connect Meta Account</h1>
            <p className="text-sm text-muted-foreground mt-1">Connect your Facebook Page and Instagram Business account to enable auto-posting and catalog sync.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-2">
            <div className="flex items-center gap-2 text-blue-600">
              <CheckCircle2 size={16} />
              <span className="text-xs font-black uppercase tracking-wider">Features</span>
            </div>
            <ul className="text-xs space-y-1.5 text-gray-600 font-medium font-mono">
              <li>• Instagram Publishing</li>
              <li>• Facebook Page Feed</li>
              <li>• Catalog Auto-Sync</li>
              <li>• Product Tagging</li>
            </ul>
          </div>
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-2">
            <div className="flex items-center gap-2 text-orange-600">
              <AlertCircle size={16} />
              <span className="text-xs font-black uppercase tracking-wider">Requirements</span>
            </div>
            <ul className="text-xs space-y-1.5 text-gray-600 font-medium font-mono">
              <li>• FB Business Page</li>
              <li>• IG Business Profile</li>
              <li>• Linked Accounts</li>
              <li>• Meta App Approved</li>
            </ul>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-gray-50">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Meta App API Configuration</label>
            <div className="space-y-3">
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input 
                  placeholder="App ID" 
                  value={appId}
                  onChange={e => setAppId(e.target.value)}
                  className="pl-10 rounded-xl bg-gray-50 border-gray-100 h-11 text-xs font-mono" 
                />
              </div>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input 
                  type="password"
                  placeholder="App Secret" 
                  value={appSecret}
                  onChange={e => setAppSecret(e.target.value)}
                  className="pl-10 rounded-xl bg-gray-50 border-gray-100 h-11 text-xs font-mono" 
                />
              </div>
            </div>
            <p className="text-[10px] text-gray-400 flex items-center gap-1 font-medium">
              Find these in your <a href="https://developers.facebook.com" target="_blank" className="text-blue-600 underline flex items-center gap-0.5">Meta Developer Portal <ExternalLink size={8} /></a>
            </p>
          </div>

          <Button 
            onClick={handleConnect}
            disabled={loading}
            className="w-full h-12 rounded-xl bg-blue-600 hover:bg-black text-white font-black shadow-lg shadow-blue-100 active:scale-95 transition-all"
          >
            {loading ? 'INITIALIZING OAUTH...' : 'CONNECT WITH FACEBOOK'}
          </Button>
        </div>
      </div>
      
      <p className="text-center text-[10px] text-gray-400 font-medium">
        By connecting, you agree to grant this platform permission to manage your Facebook Page and Instagram content.
      </p>
    </div>
  )
}
