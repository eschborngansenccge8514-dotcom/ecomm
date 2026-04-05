import {
  View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
  Linking,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useState, useEffect, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import Toast from 'react-native-toast-message'
import { DeliveryBookingSheet } from '@/components/merchant/DeliveryBookingSheet'
import { invokeWorker } from '@/lib/worker'

// Merchant-facing status flow — only forward transitions are allowed
const NEXT_ACTIONS: Record<string, { label: string; nextStatus: string; color: string; icon: keyof typeof Ionicons.glyphMap }[]> = {
  paid:             [{ label: 'Accept Order',   nextStatus: 'confirmed',        color: '#2563eb', icon: 'checkmark-circle-outline' },
                     { label: 'Reject Order',   nextStatus: 'cancelled',        color: '#ef4444', icon: 'close-circle-outline'     }],
  confirmed:        [{ label: 'Start Preparing',nextStatus: 'preparing',        color: '#7c3aed', icon: 'restaurant-outline'        }],
  preparing:        [{ label: 'Ready for Pickup',nextStatus: 'ready_for_pickup',color: '#0891b2', icon: 'bag-check-outline'         }],
  ready_for_pickup: [{ label: 'Mark Delivered', nextStatus: 'delivered',        color: '#16a34a', icon: 'checkmark-done-circle-outline'}],
  out_for_delivery: [{ label: 'Mark Delivered', nextStatus: 'delivered',        color: '#16a34a', icon: 'checkmark-done-circle-outline'}],
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:          { label: 'Pending Payment',  color: '#92400e', bg: '#fef3c7' },
  paid:             { label: 'New Order — Action Required', color: '#fff',    bg: '#2563eb' },
  confirmed:        { label: 'Confirmed',        color: '#1e40af', bg: '#dbeafe' },
  preparing:        { label: 'Preparing',        color: '#5b21b6', bg: '#ede9fe' },
  ready_for_pickup: { label: 'Ready for Pickup', color: '#0e7490', bg: '#cffafe' },
  out_for_delivery: { label: 'Out for Delivery', color: '#0369a1', bg: '#e0f2fe' },
  delivered:        { label: 'Delivered ✓',      color: '#166534', bg: '#dcfce7' },
  cancelled:        { label: 'Cancelled',        color: '#991b1b', bg: '#fee2e2' },
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-white rounded-2xl p-4 mb-3"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
      <Text className="font-bold text-gray-900 mb-3">{title}</Text>
      {children}
    </View>
  )
}

export default function MerchantOrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const insets = useSafeAreaInsets()
  const [order, setOrder]         = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [deliverySheetOpen, setDeliverySheetOpen] = useState(false)

  const fetchOrder = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('id', orderId)
      .single()
    setOrder(data)
  }, [orderId])

  useEffect(() => {
    setIsLoading(true)
    fetchOrder().finally(() => setIsLoading(false))

    // Live updates for this order
    const channel = supabase
      .channel(`order-detail-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => setOrder((prev: any) => ({ ...prev, ...payload.new }))
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchOrder])

  const handleStatusUpdate = async (nextStatus: string, label: string) => {
    if (nextStatus === 'cancelled') {
      Alert.alert(
        'Reject this order?',
        'The customer will be notified. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reject Order', style: 'destructive', onPress: () => applyUpdate(nextStatus) },
        ]
      )
      return
    }
    Alert.alert(label, `Change order status to "${label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => applyUpdate(nextStatus) },
    ])
  }

  const applyUpdate = async (nextStatus: string) => {
    setIsUpdating(true)
    const updates: any = { status: nextStatus }
    if (nextStatus === 'confirmed')  updates.confirmed_at = new Date().toISOString()
    if (nextStatus === 'cancelled')  updates.cancelled_at = new Date().toISOString()
    if (nextStatus === 'delivered')  updates.delivered_at = new Date().toISOString()

    console.log(`[MerchantOrder] Updating status to: ${nextStatus} for orderId: ${orderId}`)
    const { error } = await supabase.from('orders').update(updates).eq('id', orderId)
    
    if (error) {
      console.error('[MerchantOrder] Update failed:', error)
      Toast.show({ 
        type: 'error', 
        text1: 'Update failed', 
        text2: `${error.message} (${error.code})` 
      })
    } else {
      console.log('[MerchantOrder] Update successful')
      Toast.show({ type: 'success', text1: 'Order updated successfully' })

      // Auto-book Lalamove if confirmed
      if (nextStatus === 'confirmed' && order.delivery_provider === 'lalamove') {
        invokeWorker('lalamove/create-order', {
          body: { orderId },
        }).then(({ data, error: fErr }: any) => {
          if (fErr || data?.error) {
            const msg = data?.error || fErr?.message || 'Unknown error'
            console.error('[Lalamove] Auto-booking failed:', msg)
            Toast.show({ type: 'error', text1: 'Lalamove booking failed', text2: msg })
          } else if (data?.success) {
            Toast.show({ type: 'success', text1: 'Lalamove driver requested! 🏍️' })
            fetchOrder()
          }
        })
      }

      fetchOrder()

      // Award loyalty points if delivered
      if (nextStatus === 'delivered') {
        invokeWorker('award-loyalty-points', {
          body: { orderId },
        }).then(({ data, error: fErr }: any) => {
          if (fErr) console.warn('[Loyalty] Award failed:', fErr)
          else if (data?.pointsAwarded > 0) {
            Toast.show({
              type: 'success',
              text1: 'Loyalty Points Awarded!',
              text2: `${data.pointsAwarded} pts earned by customer 🌟`,
            })
          }
        })
      }
    }
    setIsUpdating(false)
  }

  if (isLoading && !order) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center" style={{ paddingTop: insets.top }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  if (!order) return null

  const statusCfg  = STATUS_LABELS[order.status] ?? STATUS_LABELS.pending
  const actions    = NEXT_ACTIONS[order.status] ?? []
  const delivAddr  = order.delivery_address as any

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white px-5 pt-4 pb-3 flex-row items-center gap-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.navigate('/(merchant)/orders')}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900">{order.order_number}</Text>
          <Text className="text-gray-400 text-xs">Order Detail</Text>
        </View>
        {isUpdating && <ActivityIndicator size="small" color="#2563eb" />}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Status banner */}
        <View className="rounded-2xl p-4 mb-3 items-center" style={{ backgroundColor: statusCfg.bg }}>
          <Text style={{ color: statusCfg.color, fontWeight: '800', fontSize: 17, textAlign: 'center' }}>
            {statusCfg.label}
          </Text>
        </View>

        {/* Order items */}
        <SectionCard title="Items Ordered">
          <View className="gap-3">
            {order.items?.map((item: any) => (
              <View key={item.id} className="flex-row justify-between items-start">
                <View className="flex-1">
                  <Text className="text-gray-800 font-semibold text-sm" numberOfLines={2}>
                    {item.product_name}
                  </Text>
                  {item.variant_name && (
                    <Text className="text-gray-400 text-xs">{item.variant_name}</Text>
                  )}
                  <Text className="text-gray-500 text-xs mt-0.5">
                    {formatCurrency(item.unit_price)} × {item.quantity}
                  </Text>
                </View>
                <Text className="text-gray-900 font-bold text-sm ml-2">
                  {formatCurrency(item.line_total)}
                </Text>
              </View>
            ))}
            <View className="border-t border-gray-100 pt-2 mt-1 gap-1.5">
              <View className="flex-row justify-between">
                <Text className="text-gray-500 text-sm">Subtotal</Text>
                <Text className="text-gray-900 font-semibold text-sm">{formatCurrency(Number(order.subtotal))}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-500 text-sm">Delivery fee</Text>
                <Text className="text-gray-900 font-semibold text-sm">
                  {order.delivery_fee > 0 ? formatCurrency(Number(order.delivery_fee)) : 'Free'}
                </Text>
              </View>
              <View className="flex-row justify-between border-t border-gray-100 pt-1 mt-1">
                <Text className="font-bold text-gray-900">Total</Text>
                <Text className="font-bold text-primary-600 text-lg">{formatCurrency(Number(order.total_amount))}</Text>
              </View>
            </View>
          </View>
        </SectionCard>

        {/* Customer & delivery */}
        {delivAddr && (
          <SectionCard title="Deliver To">
            <Text className="text-gray-800 font-semibold text-sm">{delivAddr.name}</Text>
            <Text className="text-gray-500 text-sm mt-0.5">{delivAddr.phone}</Text>
            <Text className="text-gray-500 text-sm mt-0.5">
              {delivAddr.line1}{delivAddr.line2 ? `, ${delivAddr.line2}` : ''},{' '}
              {delivAddr.city}, {delivAddr.state} {delivAddr.postcode}
            </Text>
          </SectionCard>
        )}

        {/* Payment */}
        <SectionCard title="Payment">
          <View className="flex-row justify-between">
            <Text className="text-gray-500 text-sm">Method</Text>
            <Text className="text-gray-900 font-semibold text-sm capitalize">
              {order.payment_method?.replace('_', ' ') ?? '—'}
            </Text>
          </View>
          <View className="flex-row justify-between mt-1.5">
            <Text className="text-gray-500 text-sm">Status</Text>
            <View className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: order.payment_status === 'paid' ? '#dcfce7' : '#fef3c7' }}>
              <Text className="text-xs font-semibold capitalize"
                style={{ color: order.payment_status === 'paid' ? '#166534' : '#92400e' }}>
                {order.payment_status?.replace('_', ' ')}
              </Text>
            </View>
          </View>
        </SectionCard>

        {/* Delivery */}
        {['confirmed', 'preparing', 'ready_for_pickup'].includes(order.status) && (
          <SectionCard title="Delivery">
            {order.delivery_provider && order.lalamove_order_id ? (
              // Already successfully booked
              <View className="gap-2">
                <View className="flex-row justify-between">
                  <Text className="text-gray-500 text-sm">Provider</Text>
                  <Text className="text-gray-900 font-semibold text-sm capitalize">
                    {order.delivery_provider}
                  </Text>
                </View>
                {order.tracking_number && (
                  <View className="flex-row justify-between">
                    <Text className="text-gray-500 text-sm">Tracking</Text>
                    <Text className="text-gray-700 font-mono text-xs">{order.tracking_number}</Text>
                  </View>
                )}
                {order.driver_name && (
                  <View className="flex-row justify-between">
                    <Text className="text-gray-500 text-sm">Driver</Text>
                    <Text className="text-gray-900 font-semibold text-sm">
                      {order.driver_name} · {order.driver_plate}
                    </Text>
                  </View>
                )}
                {order.tracking_url && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(order.tracking_url!)}
                    className="flex-row items-center gap-2 mt-1 bg-primary-50 rounded-xl p-3"
                  >
                    <Ionicons name="open-outline" size={16} color="#2563eb" />
                    <Text className="text-primary-600 font-semibold text-sm">Track parcel</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              // Not yet booked (or booking failed — provider set but no order ID)
              <View>
                {order.delivery_provider && !order.lalamove_order_id && (
                  <View className="flex-row items-center gap-2 bg-amber-50 rounded-xl p-3 mb-3">
                    <Ionicons name="warning-outline" size={16} color="#b45309" />
                    <Text className="text-amber-700 text-xs flex-1">
                      Lalamove booking did not complete. Please book again.
                    </Text>
                  </View>
                )}
                <Text className="text-gray-500 text-sm mb-3">
                  Book a delivery service for this order.
                </Text>
                <TouchableOpacity
                  onPress={() => setDeliverySheetOpen(true)}
                  className="bg-primary-500 rounded-xl py-3 flex-row items-center justify-center gap-2"
                >
                  <Ionicons name="bicycle-outline" size={18} color="#fff" />
                  <Text className="text-white font-bold">
                    {order.delivery_provider ? 'Book Again' : 'Book Delivery'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </SectionCard>
        )}

        {/* Customer note */}
        {order.customer_note && (
          <SectionCard title="Customer Note">
            <Text className="text-gray-700 text-sm italic">"{order.customer_note}"</Text>
          </SectionCard>
        )}
      </ScrollView>

      {/* Action buttons */}
      {actions.length > 0 && (
        <View
          className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 pt-3 gap-2"
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          {actions.map(action => (
            <TouchableOpacity
              key={action.nextStatus}
              onPress={() => handleStatusUpdate(action.nextStatus, action.label)}
              disabled={isUpdating}
              className="flex-row items-center justify-center gap-2 py-3.5 rounded-2xl"
              style={{ backgroundColor: action.color, opacity: isUpdating ? 0.6 : 1 }}
            >
              <Ionicons name={action.icon} size={18} color="#fff" />
              <Text className="text-white font-bold text-base">{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <DeliveryBookingSheet
        visible={deliverySheetOpen}
        orderId={orderId}
        onClose={() => setDeliverySheetOpen(false)}
        onBooked={() => {
          setDeliverySheetOpen(false)
          fetchOrder()
        }}
      />
    </View>
  )
}
