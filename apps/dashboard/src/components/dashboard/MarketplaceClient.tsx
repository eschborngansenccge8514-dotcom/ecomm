'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { 
  Store, 
  ExternalLink, 
  RefreshCcw, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  Plus,
  ArrowRight,
  Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MarketplaceClientProps {
  providers: any[]
  accounts: any[]
  recentJobs: any[]
  merchantId: string
}

export function MarketplaceClient({ providers, accounts, recentJobs, merchantId }: MarketplaceClientProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview')

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Store size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Connected Accounts</p>
            <p className="text-2xl font-bold text-gray-900">{accounts.length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Sync Status</p>
            <p className="text-2xl font-bold text-gray-900">Healthy</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <RefreshCcw size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Sync Jobs</p>
            <p className="text-2xl font-bold text-gray-900">{recentJobs.length}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-gray-50 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all",
            activeTab === 'overview' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all",
            activeTab === 'history' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          Sync History
        </button>
      </div>

      {activeTab === 'overview' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content: Channels & Accounts */}
          <div className="lg:col-span-2 space-y-6">
            {/* Available Channels */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Available Marketplace Channels</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {providers.map(provider => {
                  const isConnected = accounts.some(a => a.provider_id === provider.id)
                  return (
                    <div key={provider.id} className="bg-white p-5 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-xl">
                          {provider.id === 'shopee' ? '🟠' : provider.id === 'tiktok' ? '⚫' : provider.id === 'lazada' ? '🔵' : provider.id === 'google_merchant' ? '🔴' : '🌐'}
                        </div>
                        {isConnected ? (
                          <Badge className="bg-green-50 text-green-700 border-green-100">Connected</Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-400">Not Connected</Badge>
                        )}
                      </div>
                      <h3 className="font-bold text-gray-900">{provider.name}</h3>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{provider.description}</p>
                      <Link href={isConnected ? `/marketplace/${provider.id}` : `/marketplace/${provider.id}/connect`}>
                        <Button className="w-full mt-4" variant={isConnected ? "outline" : "default"}>
                          {isConnected ? 'Manage Connection' : 'Connect Now'}
                          <ArrowRight size={14} className="ml-2" />
                        </Button>
                      </Link>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Active Connections */}
            {accounts.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">My Active Connections</h2>
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Marketplace</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Shop Region</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Sync</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {accounts.map(account => (
                        <tr key={account.id} className="hover:bg-gray-50 transition-colors group">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-sm">
                                {account.provider_id === 'shopee' ? '🟠' : account.provider_id === 'tiktok' ? '⚫' : account.provider_id === 'google_merchant' ? '🔴' : '🌐'}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{account.shop_name || 'My Shop'}</p>
                                <p className="text-[10px] text-gray-400 font-mono capitalize">{account.provider_id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant="outline" className="text-gray-500 font-bold">{account.region || 'MY'}</Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-0.5">
                              <p className="text-xs text-gray-700 font-medium">
                                {account.last_sync_at ? new Date(account.last_sync_at).toLocaleString() : 'Never'}
                              </p>
                              <span className="text-[10px] text-gray-400">Auto-sync enabled</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-green-600">
                              <CheckCircle2 size={14} />
                              <span className="text-xs font-medium">Active</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <Button size="sm" variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
                                <Settings size={14} className="text-gray-400" />
                             </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>

          {/* Sidebar: Recent Activity */}
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Recent Tasks</h3>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 hover:text-blue-700 p-0">View All</Button>
              </div>
              <div className="space-y-4">
                {recentJobs.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock size={32} className="mx-auto text-gray-100 mb-2" />
                    <p className="text-xs text-gray-400">No recent tasks</p>
                  </div>
                ) : (
                  recentJobs.map(job => (
                    <div key={job.id} className="flex gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full mt-1.5 shrink-0",
                        job.status === 'completed' ? 'bg-green-500' : 
                        job.status === 'processing' ? 'bg-blue-500 animate-pulse' : 'bg-red-500'
                      )} />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">
                          {job.job_type.replace('_', ' ').toUpperCase()}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {new Date(job.created_at).toLocaleTimeString()} • {job.status}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-5 rounded-2xl text-white">
              <h3 className="font-bold text-sm">Need Help?</h3>
              <p className="text-xs text-blue-100 mt-1 opacity-80">
                Learn how to sync your products and orders across multiple marketplaces.
              </p>
              <Button size="sm" className="w-full mt-4 bg-white text-blue-600 hover:bg-blue-50 border-none font-bold">
                Read Guide
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <Clock size={48} className="mx-auto text-gray-200 mb-4" />
            <h2 className="text-xl font-bold text-gray-900">Work in Progress</h2>
            <p className="text-gray-500 mt-2">Sync history logs from Edge Functions will appear here in Phase 2.</p>
        </div>
      )}
    </div>
  )
}
