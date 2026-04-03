'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  MoreHorizontal,
  Building2,
  Search,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Mail,
  Phone
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import Image from 'next/image'

interface MerchantsDirectoryClientProps {
  initialMerchants: any[]
}

export function MerchantsDirectoryClient({ initialMerchants }: MerchantsDirectoryClientProps) {
  const [merchants, setMerchants] = useState(initialMerchants)
  const [loading, setLoading] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const router = useRouter()

  const updateStatus = async (id: string, status: string) => {
    setLoading(id)
    try {
      const res = await fetch(`/api/admin/merchants/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update merchant status')

      toast.success(`Merchant status updated to ${status}`)
      
      setMerchants(prev => prev.map(m => m.id === id ? { ...m, status } : m))
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(null)
    }
  }

  const filteredMerchants = merchants.filter(m => 
    m.store_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.store_slug?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Search by store name, slug, or owner..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Merchant / Store</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Onboarding</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredMerchants.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {m.logo_url ? (
                          <Image src={m.logo_url} alt="logo" width={40} height={40} className="object-cover" />
                        ) : (
                          <Building2 size={20} className="text-gray-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate">{m.store_name}</p>
                        <p className="text-xs text-gray-500 truncate italic">/{m.store_slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-900">{m.profiles?.full_name || 'N/A'}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Mail size={12} /> {m.profiles?.phone || '—'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                      m.status === 'active' ? "bg-green-100 text-green-700" :
                      m.status === 'pending_review' ? "bg-yellow-100 text-yellow-700" :
                      m.status === 'suspended' ? "bg-red-100 text-red-700" :
                      "bg-gray-100 text-gray-700"
                    )}>
                      {m.status === 'active' ? <CheckCircle2 size={14} /> : 
                       m.status === 'suspended' ? <ShieldAlert size={14} /> : <AlertCircle size={14} />}
                      <span className="capitalize">{m.status.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={cn(
                          "h-full rounded-full transition-all duration-500",
                          m.onboarding_completed ? "bg-green-500 w-full" : "bg-blue-500 w-1/2"
                        )} />
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {m.onboarding_completed ? 'Completed' : 'Step ' + m.onboarding_step}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {m.status === 'active' ? (
                        <button 
                          onClick={() => updateStatus(m.id, 'suspended')}
                          disabled={loading === m.id}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Suspend Merchant"
                        >
                          <ShieldAlert size={18} />
                        </button>
                      ) : (
                        <button 
                          onClick={() => updateStatus(m.id, 'active')}
                          disabled={loading === m.id}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Activate Merchant"
                        >
                          <ShieldCheck size={18} />
                        </button>
                      )}
                      <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredMerchants.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No merchants found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
