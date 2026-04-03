"use client"
import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"

export default function CustomerSegmentWidget({ onAskAgent }: { onAskAgent: (query: string) => void }) {
  const [counts, setCounts] = useState<any>({ vip: 0, loyal: 0, at_risk: 0, new: 0 })
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetch('/api/crm/segment-counts')
      .then(r => r.json())
      .then(d => {
        setCounts(d)
        setTotal(d.vip + d.loyal + d.at_risk + d.new)
      })
  }, [])

  const getPercentage = (count: number) => total > 0 ? (count / total) * 100 : 0

  const segments = [
    { key: 'vip',     label: '👑 VIP Customers', color: 'bg-purple-500', note: 'Top 10% spenders' },
    { key: 'loyal',   label: '🤝 Loyal Fans',    color: 'bg-green-500',  note: '3+ successful orders' },
    { key: 'at_risk', label: '⚠️ At-Risk',      color: 'bg-orange-500', note: 'No orders in 60d' },
    { key: 'new',     label: '✨ New Arrivals',  color: 'bg-blue-500',   note: 'Joined this month' },
  ]

  return (
    <Card className="shadow-sm border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg font-bold">
          👥 Customer Segments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {segments.map(s => (
          <div key={s.key} className="space-y-2">
            <div className="flex justify-between items-end">
              <div className="space-y-0.5">
                <span className="text-sm font-semibold">{s.label}</span>
                <p className="text-[10px] text-gray-400">{s.note}</p>
              </div>
              <span className="text-sm font-bold">{counts[s.key]}</span>
            </div>
            <Progress value={getPercentage(counts[s.key])} className={`h-1.5 ${s.color}`} />
            <div className="flex gap-2 mt-1">
              <Button 
                variant="ghost" 
                size="xs" 
                className="text-[10px] text-blue-600 hover:text-blue-800 h-6 px-2"
                onClick={() => onAskAgent(`Show me the ${s.key} customers and suggest an action.`)}
              >
                🔍 Analyze Segment
              </Button>
              {s.key === 'at_risk' && (
                  <Button 
                    variant="ghost" 
                    size="xs" 
                    className="text-[10px] text-orange-600 hover:text-orange-800 h-6 px-2"
                    onClick={() => onAskAgent(`I want to send a win-back notification to the at-risk segment.`)}
                  >
                    💌 Win Back
                  </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
