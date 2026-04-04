'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowRight, Info, Lock, Key } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { invokeWorker } from '@/lib/worker'

export default function ShopeeConnectPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [partnerId, setPartnerId] = useState('')
  const [partnerKey, setPartnerKey] = useState('')
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
        .from('merchant_shopee_config')
        .select('partner_id, partner_key')
        .eq('merchant_id', merchant.id)
        .single()

      if (config) {
        setPartnerId(config.partner_id)
        setPartnerKey(config.partner_key)
      }
    } catch (err) {
      console.error('Failed to fetch config:', err)
    } finally {
      setFetchingConfig(false)
    }
  }

  const handleConnect = async () => {
    if (!partnerId || !partnerKey) {
      setError('Partner ID and Partner Key are required')
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
        .from('merchant_shopee_config')
        .upsert({
          merchant_id: merchant.id,
          partner_id: partnerId,
          partner_key: partnerKey,
          updated_at: new Date().toISOString()
        })

      if (configError) throw new Error(`Failed to save configuration: ${configError.message}`)

      // 2. Call Worker to start OAuth
      const { data, error: functionError } = await invokeWorker('shopee-auth-start', {
        body: { tenant_id: merchant.id }
      })

      if (functionError) throw functionError
      if (data?.authorization_url) {
        window.location.href = data.authorization_url
      } else {
        throw new Error('No authorization URL returned')
      }
    } catch (err: any) {
      console.error('Failed to start Shopee connection:', err)
      setError(err.message || 'An unexpected error occurred')
      toast.error(err.message || 'Connection failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-6">
      <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden">
        <div className="bg-gradient-to-br from-orange-500 via-orange-400 to-red-600 h-40 flex flex-col items-center justify-center text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-4xl shadow-lg z-10">
            🟠
          </div>
          <p className="mt-3 font-bold text-orange-50 tracking-wide uppercase text-[10px]">Shopee Integration</p>
        </div>

        <CardHeader className="pt-10 text-center px-10">
          <CardTitle className="text-3xl font-extrabold text-gray-900 tracking-tight">Connect your Shopee Shop</CardTitle>
          <CardDescription className="text-gray-500 mt-3 text-base leading-relaxed max-w-md mx-auto">
            Provide your Shopee Open Platform partner credentials to begin.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8 pb-12 px-10">
          {/* Form Fields */}
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <Key size={12} /> Partner ID
              </label>
              <Input 
                placeholder="Enter your Shopee Partner ID"
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                className="h-12 rounded-xl border-gray-100 bg-gray-50/50 focus:bg-white transition-all font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <Lock size={12} /> Partner Key
              </label>
              <Input 
                type="password"
                placeholder="Enter your Shopee Partner Key"
                value={partnerKey}
                onChange={(e) => setPartnerKey(e.target.value)}
                className="h-12 rounded-xl border-gray-100 bg-gray-50/50 focus:bg-white transition-all font-mono text-sm"
              />
            </div>
          </div>

          <div className="bg-gray-50 p-6 rounded-2xl space-y-4 border border-gray-100">
             <div className="flex items-center gap-2">
                <Info size={18} className="text-orange-500" />
                <h3 className="font-bold text-gray-900 text-sm">Integration Setup</h3>
             </div>
             <p className="text-xs text-gray-600 leading-relaxed">
               Configure your Shopee App redirect URL to:
             </p>
             <code className="block bg-white p-2 rounded-lg text-[10px] font-mono text-gray-900 break-all border border-gray-100">
               {process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}/api/integrations/shopee/callback
             </code>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-xs font-bold">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <Button 
              className="w-full bg-orange-500 hover:bg-orange-600 text-white h-16 rounded-2xl font-bold text-lg transition-all shadow-xl shadow-orange-100 flex items-center justify-center gap-3 group"
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
                  <span>Start Authorization</span>
                  <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
                </>
              )}
            </Button>
            
            <p className="text-center text-[10px] text-gray-400 font-medium px-4">
              By connecting your shop, you authorize our platform to manage your Shopee products, orders, and inventory using your partner keys.
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
