import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { StatCard } from '@/components/merchant/StatCard'
import { OrderCard } from '@/components/merchant/OrderCard'
import { router } from 'expo-router'
import { formatCurrency } from '@/lib/utils'
import { Ionicons } from '@expo/vector-icons'

export default function MerchantDashboard() {
  const { merchant } = useAuthStore()

  const { data: stats, isRefetching, refetch } = useQuery({
    queryKey: ['merchant-stats', merchant?.id],
    queryFn: async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { data: todayOrders } = await supabase
        .from('orders')
        .select('total_amount, status')
        .eq('merchant_id', merchant!.id)
        .gte('created_at', today.toISOString())

      const { data: pendingOrders } = await supabase
        .from('orders')
        .select(`
          *,
          items:order_items(*),
          merchant:merchants(id, store_name, logo_url)
        `)
        .eq('merchant_id', merchant!.id)
        .in('status', ['paid', 'confirmed', 'preparing'])
        .order('created_at', { ascending: false })
        .limit(5)

      const { count: totalProducts } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchant!.id)
        .neq('status', 'deleted')

      return {
        todayRevenue: todayOrders?.filter(o => o.status !== 'cancelled')
          .reduce((sum, o) => sum + Number(o.total_amount), 0) ?? 0,
        todayOrders:  todayOrders?.length ?? 0,
        pendingCount: pendingOrders?.length ?? 0,
        pendingOrders: (pendingOrders ?? []) as any,
        totalProducts: totalProducts ?? 0,
      }
    },
    enabled: !!merchant?.id,
  })

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <View className="bg-white px-6 pt-16 pb-8 shadow-sm">
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Business Management</Text>
            <Text className="text-3xl font-bold text-gray-900">{merchant?.store_name}</Text>
          </View>
          <TouchableOpacity 
            onPress={() => router.push('/(merchant)/store-settings' as any)}
            className="w-12 h-12 bg-gray-100 rounded-full items-center justify-center border border-gray-200"
          >
            <Ionicons name="settings-outline" size={24} color="#111" />
          </TouchableOpacity>
        </View>
        <View className="mt-4 flex-row items-center gap-3">
          <View className={`px-3 py-1 rounded-full border border-gray-100 flex-row items-center gap-1.5
            ${merchant?.status === 'active' ? 'bg-green-50' : 'bg-yellow-50'}`}>
            <View className={`w-2 h-2 rounded-full ${merchant?.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <Text className={`text-xs font-bold uppercase tracking-tight
              ${merchant?.status === 'active' ? 'text-green-700' : 'text-yellow-700'}`}>
              {merchant?.status?.replace('_', ' ')}
            </Text>
          </View>
          <Text className="text-gray-400 text-xs font-semibold">• Store ID: {merchant?.id.slice(-6).toUpperCase()}</Text>
        </View>
      </View>

      <View className="p-5 gap-4">
        {/* Stat cards */}
        <View className="flex-row gap-4">
          <StatCard label="Today's Sales" value={formatCurrency(stats?.todayRevenue ?? 0)} icon="cash-outline" color="green" />
          <StatCard label="Today's Orders"  value={String(stats?.todayOrders ?? 0)} icon="receipt-outline" color="blue" />
        </View>
        <View className="flex-row gap-4">
          <StatCard label="Pending"  value={String(stats?.pendingCount ?? 0)} icon="time-outline"    color="orange" />
          <StatCard label="Live Products"  value={String(stats?.totalProducts ?? 0)} icon="cube-outline"    color="purple" />
        </View>

        {/* Recent pending orders */}
        <View className="mt-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold text-gray-900 uppercase tracking-tight">Active Orders</Text>
            <TouchableOpacity onPress={() => router.push('/(merchant)/orders' as any)}>
              <Text className="text-primary-600 font-bold text-sm">See all →</Text>
            </TouchableOpacity>
          </View>
          {(stats?.pendingOrders?.length ?? 0) === 0 ? (
            <View className="bg-white rounded-3xl p-10 items-center justify-center border-2 border-dashed border-gray-200">
               <Ionicons name="happy-outline" size={48} color="#d1d5db" />
               <Text className="text-gray-400 font-bold mt-3">All clear! No pending orders.</Text>
            </View>
          ) : (
            stats!.pendingOrders.map((order: any) => (
              <OrderCard
                key={order.id}
                order={order}
                onPress={() => router.push(`/(merchant)/order/${order.id}` as any)}
              />
            ))
          )}
        </View>
      </View>
    </ScrollView>
  )
}
