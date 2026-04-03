"use client"
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function EinvoiceStatusWidget() {
  const supabase = createClientComponentClient()
  const [submissions, setSubmissions] = useState<any[]>([])

  useEffect(() => {
    const fetchLatest = async () => {
      const { data } = await supabase
        .from('einvoice_submissions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)
      if (data) setSubmissions(data)
    }

    fetchLatest()

    // Realtime subscription
    const channel = supabase
      .channel('einvoice_updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'einvoice_submissions' 
      }, payload => {
          if (payload.eventType === 'INSERT') {
              setSubmissions(prev => [payload.new, ...prev.slice(0, 4)])
          } else {
              setSubmissions(prev => prev.map(s => s.id === payload.new.id ? payload.new : s))
          }
      })
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [supabase])

  const getBadgeColor = (status: string) => {
    switch (status) {
      case 'valid':     return 'bg-green-100 text-green-800'
      case 'invalid':   return 'bg-red-100 text-red-800'
      case 'pending':   return 'bg-yellow-100 text-yellow-800'
      case 'submitted': return 'bg-blue-100 text-blue-800'
      default:          return 'bg-gray-100'
    }
  }

  return (
    <Card className="shadow-sm border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          📄 LHDN Submission Queue
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {submissions.length === 0 ? (
          <p className="text-sm text-gray-500">No active submissions.</p>
        ) : (
          submissions.map(s => (
            <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg hover:shadow-md transition-shadow">
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-400">{s.batch_id}</p>
                <p className="text-sm font-semibold">{s.invoice_type} submission</p>
                <p className="text-xs text-gray-500">{new Date(s.created_at).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <Badge className={getBadgeColor(s.status)}>
                  {s.status.toUpperCase()}
                </Badge>
                {s.lhdn_uuid && (
                    <p className="text-[10px] text-gray-400 mt-1 truncate max-w-[120px]">
                        LHDN: {s.lhdn_uuid.substring(0, 8)}...
                    </p>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
