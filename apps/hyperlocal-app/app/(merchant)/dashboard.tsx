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
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2563eb" />}
    >
      {/* Premium Header */}
      <View className="bg-white px-6 pt-16 pb-8 shadow-soft rounded-b-[40px] border-b border-gray-100">
        <View className="flex-row justify-between items-start">
          <View className="flex-1 mr-4">
            <View className="flex-row items-center gap-2 mb-2">
              <View className={`px-2.5 py-1 rounded-full border border-gray-100 flex-row items-center gap-1.5
                ${merchant?.status === 'active' ? 'bg-green-50' : 'bg-yellow-50'}`}>
                <View className={`w-1.5 h-1.5 rounded-full ${merchant?.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <Text className={`text-[9px] font-bold uppercase tracking-widest font-semibold
                  ${merchant?.status === 'active' ? 'text-green-700' : 'text-yellow-700'}`}>
                  {merchant?.status?.replace('_', ' ')}
                </Text>
              </View>
              <Text className="text-gray-400 text-[10px] font-bold tracking-tighter truncate uppercase italic">
                ID: {merchant?.id.slice(-8).toUpperCase()}
              </Text>
            </View>
            <Text className="text-3xl font-bold text-gray-900 font-heading leading-tight" numberOfLines={2}>
              {merchant?.store_name}
            </Text>
          </View>
          <TouchableOpacity 
            onPress={() => router.push('/(merchant)/store-settings' as any)}
            className="w-12 h-12 bg-gray-50 rounded-2xl items-center justify-center border border-gray-100 shadow-sm"
          >
            <Ionicons name="settings-outline" size={24} color="#1e293b" />
          </TouchableOpacity>
        </View>
      </View>

      <View className="p-6">
        {/* Quick Actions */}
        <View className="mb-8">
          <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-4 ml-1">Quick Actions</Text>
          <View className="flex-row gap-4">
            <TouchableOpacity 
              onPress={() => router.push('/(merchant)/product/new' as any)}
              className="flex-1 bg-primary-600 rounded-3xl p-4 flex-row items-center justify-center gap-2 shadow-soft"
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text className="text-white font-bold text-sm font-semibold">New Product</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => router.push('/(merchant)/orders' as any)}
              className="flex-1 bg-white rounded-3xl p-4 flex-row items-center justify-center gap-2 border border-gray-100 shadow-soft"
            >
              <Ionicons name="list-outline" size={20} color="#2563eb" />
              <Text className="text-primary-600 font-bold text-sm font-semibold">All Orders</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dynamic Stats */}
        <View className="mb-8">
          <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-4 ml-1">Business Overview</Text>
          <View className="gap-4">
            <View className="flex-row gap-4">
              <StatCard label="Today's Sales" value={formatCurrency(stats?.todayRevenue ?? 0)} icon="cash-outline" color="green" />
              <StatCard label="Today's Orders"  value={String(stats?.todayOrders ?? 0)} icon="receipt-outline" color="blue" />
            </View>
            <View className="flex-row gap-4">
              <StatCard label="Pending"  value={String(stats?.pendingCount ?? 0)} icon="time-outline"    color="orange" />
              <StatCard label="Live Products"  value={String(stats?.totalProducts ?? 0)} icon="cube-outline"    color="purple" />
            </View>
          </View>
        </View>

        {/* Priority Orders Section */}
        <View className="mb-4">
          <View className="flex-row justify-between items-end mb-5 px-1">
            <View>
              <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Attention Required</Text>
              <Text className="text-xl font-bold text-gray-900 font-heading">Recent Active Orders</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(merchant)/orders' as any)}>
              <Text className="text-primary-600 font-bold text-xs uppercase tracking-tighter">View Loop →</Text>
            </TouchableOpacity>
          </View>
          
          {(stats?.pendingOrders?.length ?? 0) === 0 ? (
            <View className="bg-white rounded-[32px] p-12 items-center justify-center border border-gray-100 shadow-soft">
               <View className="w-16 h-16 bg-gray-50 rounded-full items-center justify-center mb-4">
                 <Ionicons name="checkmark-circle-outline" size={32} color="#94a3b8" />
               </View>
               <Text className="text-gray-900 font-bold text-base font-heading">All caught up!</Text>
               <Text className="text-gray-400 text-sm text-center mt-1 font-medium">No pending orders to process right now.</Text>
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
