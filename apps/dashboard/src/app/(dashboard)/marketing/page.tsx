import { getMerchant } from '@/lib/utils.server'
import { Button } from '@/components/ui/button'
import { Plus, Send, Clock, CheckCircle2, XCircle, MoreVertical } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Email Marketing' }

export default async function MarketingPage() {
  const { supabase, merchant } = await getMerchant()

  const { data: campaigns } = await supabase
    .from('email_campaigns')
    .select('*')
    .eq('merchant_id', merchant.id)
    .order('created_at', { ascending: false })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'sending': return <Send className="h-4 w-4 text-blue-500 animate-pulse" />
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />
      default: return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Sent</Badge>
      case 'sending': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Sending</Badge>
      case 'failed': return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Failed</Badge>
      default: return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Draft</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Email Marketing</h1>
          <p className="text-sm text-muted-foreground">Engage your customers with bulk email campaigns.</p>
        </div>
        <Link href="/marketing/new">
          <Button className="rounded-xl h-11 px-6 font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
            <Plus className="mr-2 h-4 w-4 text-white" strokeWidth={3} />
            Create Campaign
          </Button>
        </Link>
      </div>

      <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 border-b text-[10px] font-black uppercase tracking-wider text-gray-400">
              <th className="px-6 py-4 text-left">Campaign</th>
              <th className="px-6 py-4 text-left">Audience</th>
              <th className="px-6 py-4 text-center">Status</th>
              <th className="px-6 py-4 text-center">Sent</th>
              <th className="px-6 py-4 text-center">Opens</th>
              <th className="px-6 py-4 text-center">Clicks</th>
              <th className="px-6 py-4 text-left">Date</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {campaigns?.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Send className="h-8 w-8 opacity-20" />
                    <p className="text-sm font-medium">No campaigns found. Start by creating one!</p>
                  </div>
                </td>
              </tr>
            ) : (
              campaigns?.map((c) => {
                const openRate = c.total_recipients > 0 ? ((c.opens / c.total_recipients) * 100).toFixed(1) : '0';
                const clickRate = c.total_recipients > 0 ? ((c.clicks / c.total_recipients) * 100).toFixed(1) : '0';
                
                return (
                  <tr key={c.id} className="hover:bg-gray-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors uppercase text-xs tracking-tight">{c.subject}</span>
                        <span className="text-[10px] text-gray-400 font-mono truncate max-w-[200px]">{c.content.substring(0, 50)}...</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary" className="rounded-md uppercase text-[10px] font-bold tracking-widest">{c.segment}</Badge>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {getStatusIcon(c.status)}
                        {getStatusBadge(c.status)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-mono font-bold text-sm text-gray-600">
                      {c.total_recipients || '—'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{c.opens || 0}</span>
                        <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest">{openRate}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{c.clicks || 0}</span>
                        <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest">{clickRate}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 font-medium whitespace-nowrap">
                      {c.sent_at ? format(new Date(c.sent_at), 'MMM d, HH:mm') : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="icon" className="rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
