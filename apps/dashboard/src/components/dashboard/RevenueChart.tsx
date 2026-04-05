import dynamic from 'next/dynamic'
import { format, parseISO } from 'date-fns'

const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false })
const AreaChart = dynamic(() => import('recharts').then(mod => mod.AreaChart), { ssr: false })
const Area = dynamic(() => import('recharts').then(mod => mod.Area), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false })

export function RevenueChart({ data }: { data: { date: string; revenue: number }[] }) {
  const formatted = data.map(d => ({
    date:    format(parseISO(d.date), 'd MMM'),
    revenue: Number(d.revenue),
  }))

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h2 className="font-bold text-gray-900 mb-4">Revenue — Last 30 Days</h2>
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formatted} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false} 
              axisLine={false} 
              interval="preserveStartEnd" 
            />
            <YAxis 
              tick={{ fontSize: 11, fill: '#9ca3af' }} 
              tickLine={false}
              axisLine={false} 
              tickFormatter={v => `RM${v}`} 
              width={56} 
            />
            <Tooltip
              formatter={(v: any) => [`RM ${Number(v).toFixed(2)}`, 'Revenue']}
              contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }}
            />
            <Area 
              type="monotone" 
              dataKey="revenue" 
              stroke="#2563eb"
              strokeWidth={2} 
              fill="url(#revGradient)" 
              dot={false} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
