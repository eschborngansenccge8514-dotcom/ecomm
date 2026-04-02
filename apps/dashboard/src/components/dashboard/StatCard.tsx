import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface Props {
  title:      string
  value:      string
  change?:    string
  positive?:  boolean
  alert?:     boolean
  icon:       React.ReactNode
  iconBg:     string
  iconColor:  string
}

export function StatCard({ title, value, change, positive, alert, icon, iconBg, iconColor }: Props) {
  return (
    <div className={cn(
      'bg-white rounded-2xl p-5 border',
      alert ? 'border-amber-200 ring-1 ring-amber-100' : 'border-gray-100'
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change && (
            <div className={cn('flex items-center gap-1 mt-1.5 text-xs font-medium',
              positive ? 'text-green-600' : 'text-red-500')}>
              {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {change}
            </div>
          )}
        </div>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', iconBg, iconColor)}>
          {icon}
        </div>
      </div>
    </div>
  )
}
