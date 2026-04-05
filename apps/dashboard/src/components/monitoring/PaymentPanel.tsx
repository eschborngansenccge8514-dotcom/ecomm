import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'

const PieChart = dynamic(() => import('recharts').then(mod => mod.PieChart), { ssr: false })
const Pie = dynamic(() => import('recharts').then(mod => mod.Pie), { ssr: false })
const Cell = dynamic(() => import('recharts').then(mod => mod.Cell), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false })
const RechartsTooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false })
const Legend = dynamic(() => import('recharts').then(mod => mod.Legend), { ssr: false })

type MonitoringData = ReturnType<typeof useMonitoring>

export function PaymentPanel({ data }: { data: MonitoringData }) {
  const { orders } = data
  
  const paidOrders = orders.filter(o => o.payment_status === 'paid')
  const failedOrders = orders.filter(o => o.payment_status === 'failed')
  const pendingOrders = orders.filter(o => o.payment_status === 'pending_verification' || (o.status === 'pending' && o.payment_status === 'unpaid'))
  
  const todayRevenue = paidOrders
    .filter(o => new Date(o.created_at).toDateString() === new Date().toDateString())
    .reduce((sum, o) => sum + Number(o.total_amount), 0)

  const successRate = orders.length > 0 
    ? (paidOrders.length / (paidOrders.length + failedOrders.length || 1) * 100).toFixed(1)
    : '0.0'

  const methodData = [
    { name: 'FPX', value: orders.filter(o => o.payment_method === 'billplz').length, color: '#2563eb' },
    { name: 'E-Wallet', value: orders.filter(o => o.payment_method === 'razorpay').length, color: '#10b981' },
    { name: 'COD', value: orders.filter(o => o.payment_method === 'cod').length, color: '#f59e0b' },
  ].filter(d => d.value > 0)

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'billplz': return <Landmark className="w-4 h-4" />
      case 'razorpay': return <Smartphone className="w-4 h-4" />
      case 'cod': return <Wallet className="w-4 h-4" />
      default: return <CreditCard className="w-4 h-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-gray-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">Today's Revenue</span>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold">RM {todayRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <p className="text-[10px] text-green-600 font-medium mt-1">↑ 12% vs yesterday</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">Pending Orders</span>
              <Clock className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold">{pendingOrders.length}</div>
            <p className="text-[10px] text-gray-500 mt-1">Wait time: ~18 mins</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">Failed Payments</span>
              <TrendingDown className="w-4 h-4 text-red-500" />
            </div>
            <div className="text-2xl font-bold">{failedOrders.length}</div>
            <p className="text-[10px] text-red-600 font-medium mt-1">Last: 42 mins ago</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">Success Rate</span>
              <CheckCircle2 className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold">{successRate}%</div>
            <p className="text-[10px] text-gray-500 mt-1">Stable vs last week</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Live Transaction Feed */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold">Live Transaction Feed</CardTitle>
            <Button variant="ghost" size="sm" className="h-8 text-[10px]">View All</Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {orders.slice(0, 10).map((order) => (
                <div key={order.id} className="p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      order.payment_status === 'paid' ? "bg-green-100 text-green-700" : 
                      order.payment_status === 'failed' ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"
                    )}>
                      {getMethodIcon(order.payment_method)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">Order #{order.order_number}</p>
                      <p className="text-[10px] text-gray-500 uppercase">{order.payment_method || 'Unselected'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-900">RM {Number(order.total_amount).toFixed(2)}</p>
                    <div className="flex items-center gap-1.5 justify-end mt-0.5">
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        order.payment_status === 'paid' ? "bg-green-500" : 
                        order.payment_status === 'failed' ? "bg-red-500" : "bg-yellow-500"
                      )} />
                      <span className="text-[10px] text-gray-500 capitalize">{(order.payment_status || 'Unpaid').replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
              ))}
              {orders.length === 0 && (
                <div className="p-8 text-center text-gray-400 italic text-sm">No transactions yet today.</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Method Breakdown */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold">Payment Methods</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                {methodData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={methodData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {methodData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-300 text-xs italic">No data yet</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-600 text-white border-0">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-80 mb-2">
                <CheckCircle2 className="w-3 h-3" /> Settlement Summary
              </div>
              <div className="text-xl font-bold mb-1">RM 2,840.00</div>
              <p className="text-[11px] opacity-80">Next transfer: 30 Mar 2026</p>
              <Button variant="secondary" className="w-full mt-4 h-8 text-[10px] text-blue-600 bg-white hover:bg-gray-50">Download Statement</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
