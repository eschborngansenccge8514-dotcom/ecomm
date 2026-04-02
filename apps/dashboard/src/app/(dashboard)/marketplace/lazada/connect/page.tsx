'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowRight, Info, Check, Lock, Key } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import toast from 'react-hot-toast'

const LAZADA_REGIONS = [
  { id: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { id: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { id: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { id: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  { id: 'PH', name: 'Philippines', flag: '🇵🇭' },
  { id: 'VN', name: 'Vietnam', flag: '🇻🇳' },
]

export default function LazadaConnectPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState('MY')
  const [appKey, setAppKey] = useState('')
  const [appSecret, setAppSecret] = useState('')
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
        .from('merchant_lazada_config')
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
        .from('merchant_lazada_config')
        .upsert({
          merchant_id: merchant.id,
          app_key: appKey,
          app_secret: appSecret,
          updated_at: new Date().toISOString()
        })

      if (configError) throw new Error(`Failed to save configuration: ${configError.message}`)

      // 2. Call Edge Function to start OAuth
      const { data, error: functionError } = await supabase.functions.invoke('lazada-auth-start', {
        body: { 
          tenant_id: merchant.id,
          region: selectedRegion
        }
      })

      if (functionError) throw functionError
      if (data?.authorization_url) {
        window.location.href = data.authorization_url
      } else {
        throw new Error('No authorization URL returned')
      }
    } catch (err: any) {
      console.error('Failed to start Lazada connection:', err)
      setError(err.message || 'An unexpected error occurred')
      toast.error(err.message || 'Connection failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-6">
      <Card className="border-none shadow-2xl bg-white rounded-[2rem] overflow-hidden">
        <div className="bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 h-40 flex flex-col items-center justify-center text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl animate-pulse" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/20 rounded-full -ml-10 -mb-10 blur-2xl" />
          
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-4xl shadow-lg z-10">
            🔵
          </div>
          <p className="mt-3 font-bold text-blue-50 tracking-wide uppercase text-[10px]">Lazada Integration</p>
        </div>

        <CardHeader className="pt-10 text-center px-10">
          <CardTitle className="text-3xl font-extrabold text-gray-900 tracking-tight">Connect your Lazada Shop</CardTitle>
          <CardDescription className="text-gray-500 mt-3 text-base leading-relaxed max-w-md mx-auto">
            Provide your Lazada Open Platform credentials to begin the integration process.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8 pb-12 px-10">
          {/* Form Fields */}
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <Key size={12} /> App Key
              </label>
              <Input 
                placeholder="Enter your Lazada App Key"
                value={appKey}
                onChange={(e) => setAppKey(e.target.value)}
                className="h-12 rounded-xl border-gray-100 bg-gray-50/50 focus:bg-white transition-all font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <Lock size={12} /> App Secret
              </label>
              <Input 
                type="password"
                placeholder="Enter your Lazada App Secret"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                className="h-12 rounded-xl border-gray-100 bg-gray-50/50 focus:bg-white transition-all font-mono text-sm"
              />
            </div>
          </div>

          {/* Region Selection */}
          <div className="space-y-4 pt-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Select Marketplace Region</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {LAZADA_REGIONS.map((region) => (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => setSelectedRegion(region.id)}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-200 text-left",
                    selectedRegion === region.id 
                      ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm" 
                      : "bg-white border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50"
                  )}
                >
                  <span className="text-2xl">{region.flag}</span>
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{region.name}</p>
                    <p className="text-[10px] opacity-60 font-mono tracking-tighter">{region.id}</p>
                  </div>
                  {selectedRegion === region.id && (
                    <div className="ml-auto bg-blue-500 rounded-full p-0.5 text-white">
                      <Check size={10} strokeWidth={4} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 p-6 rounded-[1.5rem] border border-amber-100 flex gap-4">
             <div className="w-12 h-12 rounded-2xl bg-white border border-amber-100 flex items-center justify-center shrink-0 shadow-sm">
                <Info size={20} className="text-amber-500" />
             </div>
             <div className="space-y-2">
                <h3 className="font-bold text-amber-900 text-sm">Prerequisites</h3>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Make sure you have registered an application on the <strong>Lazada Open Platform</strong> and configured the redirect URL to:
                </p>
                <code className="block bg-white/50 p-2 rounded-lg text-[10px] font-mono text-amber-900 break-all border border-amber-100">
                  {process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}/api/integrations/lazada/callback
                </code>
             </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl text-xs font-bold animate-shake">
              {error}
            </div>
          )}

          <div className="space-y-4 pt-2">
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-16 rounded-2xl font-bold text-lg transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-3 group"
              onClick={handleConnect}
              disabled={loading || fetchingConfig}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Preparing connection...</span>
                </>
              ) : (
                <>
                  <span>Connect {LAZADA_REGIONS.find(r => r.id === selectedRegion)?.name} Shop</span>
                  <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
                </>
              )}
            </Button>
            
            <p className="text-center text-[10px] text-gray-400 font-medium px-4">
              By connecting your shop, you authorize our platform to manage your Lazada products, orders, and inventory using your provided credentials.
            </p>
          </div>
        </CardContent>
      </Card>
      
      <div className="mt-8 text-center">
        <button 
          onClick={() => window.history.back()}
          className="text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
        >
          Cancel and go back
        </button>
      </div>
    </div>
  )
}
