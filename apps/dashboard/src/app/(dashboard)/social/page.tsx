import { getMerchant } from '@/lib/utils.server'
import { Button } from '@/components/ui/button'
import { Plus, Globe, Camera, Share2, Clock, CheckCircle2, XCircle, MoreVertical } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Social Hub' }

export default async function SocialPage() {
  const { supabase, merchant } = await getMerchant()

  const { data: posts } = await supabase
    .from('social_posts')
    .select('*')
    .eq('merchant_id', merchant.id)
    .order('created_at', { ascending: false })

  const { data: accounts } = await supabase
    .from('merchant_social_accounts')
    .select('*')
    .eq('merchant_id', merchant.id)

  const isMetaConnected = accounts && accounts.length > 0

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'published': return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'failed':    return <XCircle className="h-4 w-4 text-red-500" />
      case 'scheduled': return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />
      default:          return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 uppercase text-[10px] font-bold tracking-widest">Published</Badge>
      case 'failed':    return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 uppercase text-[10px] font-bold tracking-widest">Failed</Badge>
      case 'scheduled': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 uppercase text-[10px] font-bold tracking-widest">Scheduled</Badge>
      default:          return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 uppercase text-[10px] font-bold tracking-widest">Draft</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">Social Hub</h1>
          <p className="text-sm text-muted-foreground">Manage your Facebook and Instagram presence.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/social/connect">
            <Button variant="outline" className="rounded-xl h-11 px-6 font-bold shadow-sm active:scale-95 transition-all">
              {isMetaConnected ? 'Reconnect Meta' : 'Connect Meta'}
            </Button>
          </Link>
          <Link href="/social/compose">
            <Button className="rounded-xl h-11 px-6 font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all" disabled={!isMetaConnected}>
              <Plus className="mr-2 h-4 w-4 text-white" strokeWidth={3} />
              Compose Post
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b bg-gray-50/30 flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Recent Posts</h2>
              <Share2 size={16} className="text-gray-300" />
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b text-[10px] font-black uppercase tracking-wider text-gray-400">
                  <th className="px-6 py-4">Post Content</th>
                  <th className="px-6 py-4">Platforms</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Scheduled At</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {!posts || posts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Camera className="h-8 w-8 opacity-20" />
                        <p className="text-sm font-medium">No social posts found. Start by composing one!</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  posts.map((post) => (
                    <tr key={post.id} className="hover:bg-gray-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {post.image_urls?.[0] && (
                            <img src={post.image_urls[0]} alt="preview" className="w-10 h-10 rounded-lg object-cover border" />
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-gray-900 truncate max-w-[200px]">{post.caption || 'No caption'}</span>
                            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">{post.post_type}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {(post.platform === 'facebook' || post.platform === 'both') && <Globe size={14} className="text-blue-600" />}
                          {(post.platform === 'instagram' || post.platform === 'both') && <Camera size={14} className="text-pink-600" />}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(post.status)}
                          {getStatusBadge(post.status)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[11px] text-gray-500 font-mono font-bold whitespace-nowrap">
                        {format(new Date(post.scheduled_at), 'MMM d, yyyy · HH:mm')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="icon" className="rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border rounded-2xl p-6 shadow-sm">
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Meta Status</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Globe size={16} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">Facebook Page</p>
                    <p className="text-[10px] text-gray-500 font-medium">Auto-sync active</p>
                  </div>
                </div>
                {isMetaConnected ? (
                  <CheckCircle2 size={16} className="text-green-500" />
                ) : (
                  <Button variant="ghost" className="h-7 text-[10px] px-2 font-bold text-blue-600 hover:bg-blue-50">Connect</Button>
                )}
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center">
                    <Camera size={16} className="text-pink-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">Instagram Shop</p>
                    <p className="text-[10px] text-gray-500 font-medium">Daily catalog polling</p>
                  </div>
                </div>
                {isMetaConnected ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-500" />
                    <Link href="/social/connect">
                      <Button variant="ghost" className="h-7 text-[9px] px-2 font-bold text-gray-400 hover:text-blue-600 transition-colors uppercase tracking-tighter">Reconnect</Button>
                    </Link>
                  </div>
                ) : (
                  <Link href="/social/connect">
                    <Button variant="ghost" className="h-7 text-[10px] px-2 font-bold text-blue-600 hover:bg-blue-50">Connect</Button>
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg shadow-blue-500/20 relative overflow-hidden group">
            <Share2 className="absolute top-2 right-2 opacity-10 group-hover:scale-110 transition-transform" size={80} />
            <h3 className="text-sm font-black uppercase tracking-wider mb-2">Multi-Channel Sales</h3>
            <p className="text-xs text-blue-100 mb-4 font-medium leading-relaxed">Your product catalog is synced with Facebook Commerce Manager. Enable Instagram Shopping to let customers buy directly from your posts.</p>
            <Button variant="secondary" className="w-full rounded-xl h-10 font-bold text-xs bg-white text-blue-600 hover:bg-blue-50 border-0">
              Manage Catalog Source
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
