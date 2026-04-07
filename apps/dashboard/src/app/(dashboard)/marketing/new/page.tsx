'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Loader2, Mail, Users, ArrowLeft, Send, Star, AlertCircle, UserPlus, Calendar } from 'lucide-react'
import { createAndSendCampaign } from '../actions'
import toast from 'react-hot-toast'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function NewCampaignPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [campaign, setCampaign] = useState({
    subject: '',
    content: '',
    segment: 'all',
    scheduledAt: '',
  })

  const handleSubmit = async () => {
    if (!campaign.subject || !campaign.content) {
      return toast.error('Please fill in both subject and content')
    }
    setShowConfirm(true) // Open confirmation dialog
  }

  const handleConfirmSend = async () => {
    setShowConfirm(false)
    setLoading(true)
    try {
      const result = await createAndSendCampaign(campaign)
      if (result.success) {
        const sentCount = (result as any).totalSent || 0
        toast.success(`Campaign sent successfully! Total recipients: ${sentCount}`)
        router.push('/marketing')
      } else {
        toast.error(`Error sending: ${result.error}`)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Link href="/marketing">
          <Button variant="ghost" size="icon" className="rounded-xl h-12 w-12 hover:bg-white hover:shadow-md transition-all">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">Compose Campaign</h1>
          <p className="text-sm text-muted-foreground">Draft your mass email to engage your customers.</p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="border-gray-100 shadow-xl shadow-blue-500/5 overflow-hidden rounded-3xl">
          <CardHeader className="bg-gray-50/50 pb-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600 shadow-inner">
                <Mail size={18} />
              </div>
              <div>
                <CardTitle className="text-base font-bold uppercase tracking-tight">Campaign Details</CardTitle>
                <CardDescription className="text-xs">Provide a catchy subject line and your message content.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-8 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Subject Line</label>
              <Input 
                value={campaign.subject} 
                onChange={e => setCampaign({ ...campaign, subject: e.target.value })} 
                placeholder="Exciting update from our store! 🎉"
                className="rounded-xl h-11 border-gray-100 font-bold focus-visible:ring-blue-100 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Audience Segment</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'all', label: 'All', icon: <Users size={14} /> },
                  { id: 'vips', label: 'VIPs', icon: <Star size={14} /> },
                  { id: 'at_risk', label: 'At Risk', icon: <AlertCircle size={14} /> },
                  { id: 'new', label: 'New', icon: <UserPlus size={14} /> },
                ].map((seg) => (
                   <Button
                    key={seg.id}
                    type="button"
                    variant={campaign.segment === seg.id ? 'default' : 'outline'}
                    onClick={() => setCampaign({ ...campaign, segment: seg.id })}
                    className="rounded-xl h-11 uppercase text-[10px] font-black tracking-widest transition-all gap-2"
                  >
                    {seg.icon}
                    {seg.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Schedule Send (Optional)</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input 
                  type="datetime-local"
                  value={campaign.scheduledAt}
                  onChange={e => setCampaign({ ...campaign, scheduledAt: e.target.value })}
                  className="rounded-xl h-11 border-gray-100 font-bold focus-visible:ring-blue-100 transition-all pl-10 pr-4"
                />
              </div>
              <p className="text-[10px] text-gray-400 italic pl-1">Leave blank to send immediately.</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Email Body (Plain Text)</label>
              <Textarea 
                value={campaign.content} 
                onChange={e => setCampaign({ ...campaign, content: e.target.value })} 
                placeholder="Write your email content here... (Markdown-like formatting supported)"
                className="rounded-2xl min-h-[300px] border-gray-100 focus-visible:ring-blue-100 transition-all font-medium leading-relaxed"
              />
            </div>
          </CardContent>
          <CardFooter className="bg-gray-50/50 px-8 py-6 border-t border-gray-100 flex justify-between gap-4">
             <Link href="/marketing" className="flex-1">
              <Button variant="outline" className="w-full rounded-xl h-11 uppercase text-[10px] font-black tracking-widest transition-all">
                Cancel
              </Button>
            </Link>
            <Button 
                onClick={handleSubmit} 
                disabled={loading} 
                className="flex-[2] rounded-xl h-11 uppercase text-[10px] font-black tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
            >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send Campaign to Audience
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="rounded-3xl border-gray-100">
          <DialogHeader>
            <DialogTitle className="uppercase font-black tracking-tight">Ready to send?</DialogTitle>
            <DialogDescription className="text-sm font-medium leading-relaxed">
              {campaign.scheduledAt 
                ? `This will schedule your campaign "${campaign.subject}" to be sent at ${new Date(campaign.scheduledAt).toLocaleString()}.`
                : `This will immediately begin sending "${campaign.subject}" to your selected audience. This action cannot be undone once started.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => setShowConfirm(false)} className="rounded-xl font-bold border-gray-100">
              Wait, let me check
            </Button>
            <Button 
                onClick={handleConfirmSend} 
                className="rounded-xl font-bold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/10 text-white"
            >
                Yes, Send Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
