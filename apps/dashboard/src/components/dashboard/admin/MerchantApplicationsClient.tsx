'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ExternalLink, 
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  MapPin,
  Phone,
  Building2,
  Banknote,
  Search
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'

interface MerchantApplicationsClientProps {
  initialApplications: any[]
}

export function MerchantApplicationsClient({ initialApplications }: MerchantApplicationsClientProps) {
  const [applications, setApplications] = useState(initialApplications)
  const [loading, setLoading] = useState<string | null>(null)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const router = useRouter()

  const handleReview = async (id: string, action: 'approve' | 'reject', reason?: string) => {
    setLoading(id)
    try {
      const res = await fetch(`/api/admin/applications/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to review application')

      toast.success(`Application ${action}ed successfully`)
      
      // Update local state instead of full refresh for better UX
      setApplications(prev => prev.map(app => 
        app.id === id ? { ...app, status: action === 'approve' ? 'approved' : 'rejected' } : app
      ))
      
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(null)
    }
  }

  const filteredApps = applications.filter(app => 
    app.store_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle2 className="text-green-500" size={16} />
      case 'rejected': return <XCircle className="text-red-500" size={16} />
      default: return <Clock className="text-yellow-500" size={16} />
    }
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Search by store name or owner..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Store / Applicant</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredApps.map((app) => (
                <React.Fragment key={app.id}>
                  <tr className={cn(
                    "hover:bg-gray-50/50 transition-colors cursor-pointer",
                    expandedRow === app.id && "bg-blue-50/10"
                  )} onClick={() => setExpandedRow(expandedRow === app.id ? null : app.id)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                          <Building2 size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{app.store_name}</p>
                          <p className="text-sm text-gray-500">{app.profiles?.full_name || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-sm text-gray-600">
                        <span className="flex items-center gap-1.5 caps"><MapPin size={14} className="text-gray-400" />{app.city}, {app.state}</span>
                        <span className="flex items-center gap-1.5"><Phone size={14} className="text-gray-400" />{app.phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {format(new Date(app.created_at), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                        app.status === 'approved' ? "bg-green-100 text-green-700" :
                        app.status === 'rejected' ? "bg-red-100 text-red-700" :
                        "bg-yellow-100 text-yellow-700"
                      )}>
                        {getStatusIcon(app.status)}
                        <span className="capitalize">{app.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        {expandedRow === app.id ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                      </button>
                    </td>
                  </tr>
                  
                  {/* Expanded Row Content */}
                  {expandedRow === app.id && (
                    <tr className="bg-gray-50/30">
                      <td colSpan={5} className="px-8 py-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                          <div className="space-y-4">
                            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                              <Building2 size={16} className="text-blue-500" /> Store Profile
                            </h4>
                            <div className="space-y-3 bg-white p-4 rounded-xl border border-gray-100">
                              <div><p className="text-xs text-gray-400 uppercase font-bold">Type</p><p className="text-sm capitalize">{app.store_type}</p></div>
                              <div><p className="text-xs text-gray-400 uppercase font-bold">Tagline</p><p className="text-sm">{app.tagline || '—'}</p></div>
                              <div><p className="text-xs text-gray-400 uppercase font-bold">BRN</p><p className="text-sm">{app.business_reg_number || '—'}</p></div>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                              <Banknote size={16} className="text-green-500" /> Bank Details
                            </h4>
                            <div className="space-y-3 bg-white p-4 rounded-xl border border-gray-100">
                              <div><p className="text-xs text-gray-400 uppercase font-bold">Bank Name</p><p className="text-sm">{app.bank_name || '—'}</p></div>
                              <div><p className="text-xs text-gray-400 uppercase font-bold">Account Number</p><p className="text-sm font-mono tracking-wider">{app.bank_account_number || '—'}</p></div>
                              <div><p className="text-xs text-gray-400 uppercase font-bold">Account Name</p><p className="text-sm">{app.bank_account_name || '—'}</p></div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h4 className="text-sm font-bold text-gray-900">Actions</h4>
                            <div className="space-y-3">
                              {app.status === 'pending' ? (
                                <div className="flex flex-col gap-3">
                                  <button 
                                    onClick={() => handleReview(app.id, 'approve')}
                                    disabled={loading === app.id}
                                    className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                  >
                                    <CheckCircle2 size={18} />
                                    Approve Merchant
                                  </button>
                                  <button 
                                    onClick={() => {
                                      const reason = prompt('Enter rejection reason:')
                                      if (reason) handleReview(app.id, 'reject', reason)
                                    }}
                                    disabled={loading === app.id}
                                    className="w-full py-2.5 px-4 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                  >
                                    <XCircle size={18} />
                                    Reject Application
                                  </button>
                                </div>
                              ) : (
                                <div className="p-4 bg-gray-100 rounded-xl border border-gray-200">
                                  <p className="text-sm text-gray-500 text-center font-medium">
                                    This application has been <span className="font-bold">{app.status}</span>.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {filteredApps.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No applications found matching your search.
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
