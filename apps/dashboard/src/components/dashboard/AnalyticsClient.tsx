'use client'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { format, parseISO } from 'date-fns'

const COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#be185d','#65a30d']

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h3 className="font-bold text-gray-900 mb-4">{title}</h3>
      {children}
    </div>
  )
}

export function AnalyticsClient({ dailyRevenue, topProducts, statusBreakdown, hourlyData, deliveryBreakdown }: {
  dailyRevenue:      { date: string; revenue: number }[]
  topProducts:       { name: string; revenue: number; units: number }[]
  statusBreakdown:   { name: string; value: number }[]
  hourlyData:        { hour: string; orders: number }[]
  deliveryBreakdown: { name: string; value: number }[]
}) {
  const revenueFormatted = dailyRevenue.map(d => ({
    date:    format(parseISO(d.date), 'd MMM'),
    revenue: Number(d.revenue),
  }))

  return (
    <div className="space-y-4">
      {/* Revenue area chart */}
      <Card title="Revenue — Last 30 Days">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={revenueFormatted}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={v => `RM${v}`} width={52} />
            <Tooltip formatter={(v: any) => [`RM ${Number(v).toFixed(2)}`, 'Revenue']}
              contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }} />
            <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} fill="url(#grad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Top products */}
        <Card title="Top Products by Revenue (30 days)">
          <div className="space-y-2">
            {topProducts.map((p, i) => {
              const maxRevenue = topProducts[0]?.revenue ?? 1
              const pct = (p.revenue / maxRevenue) * 100
              return (
                <div key={p.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-700 font-medium truncate max-w-[200px]">{p.name}</span>
                    <span className="text-gray-500 shrink-0 ml-2">
                      RM {p.revenue.toFixed(2)} · {p.units} units
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Order status pie */}
        <Card title="Order Status Breakdown (30 days)">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusBreakdown} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={80} label={({ name, percent }: any) =>
                  `${name.replace(/_/g, ' ')} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
                style={{ fontSize: 10 }}
              >
                {statusBreakdown.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => [v, 'orders']}
                contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Hourly heatmap */}
        <Card title="Peak Order Hours (last 7 days)">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={hourlyData} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                interval={2} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }} />
              <Bar dataKey="orders" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Delivery type split */}
        <Card title="Delivery Method Split (30 days)">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={deliveryBreakdown} dataKey="value" nameKey="name"
                cx="50%" cy="50%" innerRadius={50} outerRadius={80}
              >
                {deliveryBreakdown.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend formatter={v => v.replace(/_/g, ' ')} wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  )
}
