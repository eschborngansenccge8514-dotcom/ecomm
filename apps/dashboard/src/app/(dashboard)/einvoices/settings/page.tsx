'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'
import { Save, Shield, Globe, Award } from 'lucide-react'

export default function EInvoiceSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<any>({
    env: 'sandbox',
    client_id: '',
    client_secret: '',
    tin: '',
    brn: '',
    msic_code: '47910',
    description: 'Retail sale via internet',
    cert_p12_base64: '',
    cert_passphrase: '',
  })

  const supabase = createClient()

  useEffect(() => {
    fetchConfig()
  }, [])

  async function fetchConfig() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!merchant) return

      const { data, error } = await supabase
        .from('merchant_einvoice_config')
        .select('*')
        .eq('merchant_id', merchant.id)
        .single()

      if (data) {
        setConfig(data)
      }
    } catch (err) {
      console.error('Error fetching config:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!merchant) throw new Error('Merchant not found')

      const { error } = await supabase
        .from('merchant_einvoice_config')
        .upsert({
          merchant_id: merchant.id,
          ...config,
          updated_at: new Date().toISOString()
        })

      if (error) throw error
      toast.success('Settings saved successfully')
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = (event.target?.result as string).split(',')[1]
      setConfig({ ...config, cert_p12_base64: base64 })
    }
    reader.readAsDataURL(file)
  }

  if (loading) return <div className="p-8">Loading settings...</div>

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">E-Invoicing Settings</h1>
          <p className="text-gray-500 mt-1">Configure your LHDN MyInvois API credentials and digital certificate.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Environment & Credentials */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="text-blue-600" size={20} />
            <h2 className="font-semibold text-gray-900">API Configuration</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Environment</label>
              <select 
                value={config.env}
                onChange={(e) => setConfig({ ...config, env: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
              >
                <option value="sandbox">Sandbox (Pre-production)</option>
                <option value="production">Production</option>
              </select>
            </div>

            <div />

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Client ID</label>
              <input 
                type="text"
                value={config.client_id || ''}
                onChange={(e) => setConfig({ ...config, client_id: e.target.value })}
                placeholder="Enter LHDN Client ID"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Client Secret</label>
              <input 
                type="password"
                value={config.client_secret || ''}
                onChange={(e) => setConfig({ ...config, client_secret: e.target.value })}
                placeholder="Enter LHDN Client Secret"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
              />
            </div>
          </div>
        </div>

        {/* Supplier Info */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="text-blue-600" size={20} />
            <h2 className="font-semibold text-gray-900">Supplier Details (LHDN)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">TIN (Tax Identification Number)</label>
              <input 
                type="text"
                value={config.tin || ''}
                onChange={(e) => setConfig({ ...config, tin: e.target.value })}
                placeholder="e.g. C123456780"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">BRN (Business Registration Number)</label>
              <input 
                type="text"
                value={config.brn || ''}
                onChange={(e) => setConfig({ ...config, brn: e.target.value })}
                placeholder="e.g. 202101000123"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">MSIC Code</label>
              <input 
                type="text"
                value={config.msic_code || ''}
                onChange={(e) => setConfig({ ...config, msic_code: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Business Activity Description</label>
              <input 
                type="text"
                value={config.description || ''}
                onChange={(e) => setConfig({ ...config, description: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
              />
            </div>
          </div>
        </div>

        {/* Digital Certificate */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Award className="text-blue-600" size={20} />
            <h2 className="font-semibold text-gray-900">Digital Certificate (.p12)</h2>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3">
              <Shield className="text-blue-600 shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-blue-800">
                Your digital certificate is required to sign e-invoices. We store it securely in your private configuration.
                Only .p12 (PKCS#12) files are supported.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Upload P12 File</label>
                <input 
                  type="file"
                  accept=".p12,.pfx"
                  onChange={handleFileChange}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {config.cert_p12_base64 && (
                  <p className="text-xs text-green-600 font-medium mt-1">✓ Certificate file selected</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Certificate Passphrase</label>
                <input 
                  type="password"
                  value={config.cert_passphrase || ''}
                  onChange={(e) => setConfig({ ...config, cert_passphrase: e.target.value })}
                  placeholder="Enter P12 passphrase"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : (
              <>
                <Save size={20} />
                Save E-Invoice Settings
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
