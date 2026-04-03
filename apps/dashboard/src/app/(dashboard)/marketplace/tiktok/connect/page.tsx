'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowRight, Info, Lock, Key } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import toast from 'react-hot-toast'

export default function TikTokConnectPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [appKey, setAppKey] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [region, setRegion] = useState('MY') // Default to Malaysia
  const [fetchingConfig, setFetchingConfig] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    fetchExistingConfig()
  }, [])

  const fetchExistingConfig = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!merchant) return

      const { data: config } = await supabase
        .from('merchant_tiktok_config')
        .select('app_key, app_secret')
        .eq('merchant_id', merchant.id)
        .single()

      if (config) {
        setAppKey(config.app_key)
        setAppSecret(config.app_secret)
      }
    } catch (err) {
      console.error('Failed to fetch config:', err)
    } finally {
      setFetchingConfig(false)
    }
  }

  const handleConnect = async () => {
    if (!appKey || !appSecret) {
      setError('App Key and App Secret are required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Get merchant ID
      const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!merchant) throw new Error('Merchant not found')

      // 1. Save Config first
      const { error: configError } = await supabase
        .from('merchant_tiktok_config')
        .upsert({
          merchant_id: merchant.id,
          app_key: appKey,
          app_secret: appSecret,
          updated_at: new Date().toISOString()
        })

      if (configError) throw new Error(`Failed to save configuration: ${configError.message}`)

      // 2. Call Edge Function to start OAuth
      const { data, error: functionError } = await supabase.functions.invoke('tiktok-auth-start', {
        body: { 
          tenant_id: merchant.id,
          region: region
        }
      })

      if (functionError) throw functionError
      if (data?.authorization_url) {
        window.location.href = data.authorization_url
      } else {
        throw new Error('No authorization URL returned')
      }
    } catch (err: any) {
      console.error('Failed to start TikTok connection:', err)
      setError(err.message || 'An unexpected error occurred')
      toast.error(err.message || 'Connection failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-6">
      <Card className="border-none shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] bg-white rounded-[2.5rem] overflow-hidden">
        <div className="bg-black h-44 flex flex-col items-center justify-center text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
             <div className="absolute top-0 left-0 w-32 h-32 bg-[#ff0050] rounded-full blur-[60px]" />
             <div className="absolute bottom-0 right-0 w-32 h-32 bg-[#00f2ea] rounded-full blur-[60px]" />
          </div>
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-2xl z-10 p-4">
             <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
               <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.6-4.13-1.46-.1 2.1-.2 4.21-.32 6.31-.17 2.44-1.35 4.88-3.52 6.13-2.15 1.25-4.99 1.26-7.14.01-2.15-1.25-3.33-3.69-3.5-6.13-.17-2.44 1.01-4.88 3.18-6.13 1.21-.7 2.62-1.07 4.03-1.07V11.2c-.74.01-1.49.2-2.14.57-1.15.66-1.78 1.95-1.69 3.25.09 1.3.72 2.59 1.86 3.25 1.14.66 2.65.66 3.8.01 1.16-.65 1.79-1.95 1.71-3.25-.12-2.1-.23-4.2-.35-6.31-1.21.31-2.46.36-3.67-.02v-4.04z" />
             </svg>
          </div>
          <p className="mt-4 font-black tracking-tight text-xl">TikTok Shop</p>
        </div>

        <CardHeader className="pt-10 text-center px-10">
          <CardTitle className="text-4xl font-extrabold text-gray-900 tracking-tight">Connect Shop</CardTitle>
          <CardDescription className="text-gray-500 mt-4 text-lg font-medium leading-relaxed">
            Configure your TikTok Shop application credentials.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8 pb-12 px-10">
          {/* Form Fields */}
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1 space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  Region
                </label>
                <Select value={region} onValueChange={(val) => val && setRegion(val)}>
                  <SelectTrigger className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 focus:ring-black">
                    <SelectValue placeholder="Select Region" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                    <SelectItem value="MY">Malaysia (MY)</SelectItem>
                    <SelectItem value="ID">Indonesia (ID)</SelectItem>
                    <SelectItem value="TH">Thailand (TH)</SelectItem>
                    <SelectItem value="VN">Vietnam (VN)</SelectItem>
                    <SelectItem value="PH">Philippines (PH)</SelectItem>
                    <SelectItem value="SG">Singapore (SG)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <Key size={12} /> App Key
              </label>
              <Input 
                placeholder="TikTok App Key"
                value={appKey}
                onChange={(e) => setAppKey(e.target.value)}
                className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 focus:bg-white transition-all font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <Lock size={12} /> App Secret
              </label>
              <Input 
                type="password"
                placeholder="TikTok App Secret"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 focus:bg-white transition-all font-mono text-sm"
              />
            </div>
          </div>

          <div className="bg-gray-50 p-6 rounded-[2rem] space-y-4 border border-gray-100">
             <div className="flex items-center gap-2">
                <Info size={18} className="text-black" />
                <h3 className="font-bold text-gray-900 text-sm">Prerequisites</h3>
             </div>
             <p className="text-xs text-gray-600 leading-relaxed">
               Set your TikTok Shop App <strong>Redirect URL</strong> to:
             </p>
             <code className="block bg-white p-3 rounded-xl text-[10px] font-mono text-gray-900 break-all border border-gray-100">
               {process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}/api/integrations/tiktok/callback
             </code>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-[#ff0050] p-4 rounded-2xl text-xs font-black">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <Button 
              className="w-full bg-black hover:bg-gray-900 text-white h-18 rounded-[1.5rem] font-black text-xl transition-all shadow-2xl flex items-center justify-center gap-3 group relative overflow-hidden"
              onClick={handleConnect}
              disabled={loading || fetchingConfig}
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Configuring...</span>
                </>
              ) : (
                <>
                  <span>Initiate Connection</span>
                  <ArrowRight size={22} className="transition-transform group-hover:translate-x-2" />
                </>
              )}
            </Button>
            
            <p className="text-center text-[10px] text-gray-400 font-bold px-8 leading-relaxed">
              Ensure your app is in "Live" status on the TikTok Shop Partner Platform to allow merchant authorization.
            </p>
          </div>
        </CardContent>
      </Card>
      
      <div className="mt-8 text-center">
        <button 
          onClick={() => window.history.back()}
          className="text-xs font-black text-gray-400 hover:text-black transition-all tracking-widest uppercase"
        >
          ← Cancel and Return
        </button>
      </div>
    </div>
  )
}

function Loader2({ className }: { className?: string }) {
  return (
    <svg 
      className={className}
      xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}
