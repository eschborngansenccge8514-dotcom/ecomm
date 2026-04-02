import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ordersService } from '@/services/orders.service'
import { formatCurrency } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'
import MapView, { Marker, Polyline } from 'react-native-maps'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useState } from 'react'
import Toast from 'react-native-toast-message'
// ─── Status config (same as orders list) ──────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap; description: string }> = {
  pending:          { label: 'Pending Payment',    color: '#92400e', bg: '#fef3c7', icon: 'time-outline',                  description: 'Waiting for payment confirmation'       },
  paid:             { label: 'Payment Received',   color: '#065f46', bg: '#d1fae5', icon: 'checkmark-circle-outline',       description: 'Your payment was received'              },
  confirmed:        { label: 'Order Confirmed',    color: '#1e40af', bg: '#dbeafe', icon: 'checkmark-done-outline',          description: 'The merchant confirmed your order'     },
  preparing:        { label: 'Preparing',          color: '#5b21b6', bg: '#ede9fe', icon: 'restaurant-outline',              description: 'Merchant is preparing your order'      },
  ready_for_pickup: { label: 'Ready for Pickup',   color: '#0e7490', bg: '#cffafe', icon: 'bag-check-outline',               description: 'Your order is packed and ready'        },
  out_for_delivery: { label: 'Out for Delivery',   color: '#0369a1', bg: '#e0f2fe', icon: 'bicycle-outline',                 description: 'Courier is on the way to you'          },
  delivered:        { label: 'Delivered',          color: '#166534', bg: '#dcfce7', icon: 'checkmark-done-circle-outline',   description: 'Order successfully delivered'          },
  cancelled:        { label: 'Cancelled',          color: '#991b1b', bg: '#fee2e2', icon: 'close-circle-outline',            description: 'This order was cancelled'              },
  refunded:         { label: 'Refunded',           color: '#4b5563', bg: '#f3f4f6', icon: 'return-down-back-outline',        description: 'Refund has been processed'             },
}

// Order steps in sequence
const ORDER_STEPS = [
  'pending',
  'paid',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'out_for_delivery',
  'delivered',
]

// ─── Tracking timeline ─────────────────────────────────────────────────────────
function TrackingTimeline({ currentStatus }: { currentStatus: string }) {
  const isCancelled = currentStatus === 'cancelled' || currentStatus === 'refunded'

  if (isCancelled) {
    const cfg = STATUS_CONFIG[currentStatus]
    return (
      <View className="items-center py-4 gap-2">
        <View
          className="w-16 h-16 rounded-full items-center justify-center"
          style={{ backgroundColor: cfg.bg }}
        >
          <Ionicons name={cfg.icon} size={32} color={cfg.color} />
        </View>
        <Text style={{ color: cfg.color, fontWeight: '700', fontSize: 15 }}>{cfg.label}</Text>
        <Text className="text-gray-400 text-sm text-center">{cfg.description}</Text>
      </View>
    )
  }

  const currentIdx = ORDER_STEPS.indexOf(currentStatus)

  return (
    <View className="py-2">
      {ORDER_STEPS.map((step, idx) => {
        const cfg      = STATUS_CONFIG[step]
        const isDone   = idx <= currentIdx
        const isActive = idx === currentIdx
        const isLast   = idx === ORDER_STEPS.length - 1

        return (
          <View key={step} className="flex-row gap-3">
            {/* Line + dot column */}
            <View className="items-center" style={{ width: 28 }}>
              {/* Top connector line */}
              {idx > 0 && (
                <View
                  style={{
                    width: 2,
                    height: 16,
                    backgroundColor: idx <= currentIdx ? '#2563eb' : '#e5e7eb',
                  }}
                />
              )}
              {/* Dot */}
              <View
                style={{
                  width: isActive ? 28 : 20,
                  height: isActive ? 28 : 20,
                  borderRadius: isActive ? 14 : 10,
                  backgroundColor: isDone
                    ? (isActive ? '#2563eb' : '#93c5fd')
                    : '#e5e7eb',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginVertical: isActive ? -4 : 0,
                }}
              >
                {isDone && (
                  <Ionicons
                    name={isActive ? cfg.icon : 'checkmark'}
                    size={isActive ? 14 : 11}
                    color="#fff"
                  />
                )}
              </View>
              {/* Bottom connector line */}
              {!isLast && (
                <View
                  style={{
                    width: 2,
                    flex: 1,
                    minHeight: 16,
                    backgroundColor: idx < currentIdx ? '#2563eb' : '#e5e7eb',
                  }}
                />
              )}
            </View>

            {/* Text column */}
            <View
              className={`pb-4 flex-1 ${idx === 0 ? 'pt-1' : 'pt-0'}`}
              style={{ paddingTop: idx > 0 && idx <= currentIdx ? 16 : 16 }}
            >
              <Text
                style={{
                  fontWeight: isActive ? '700' : '500',
                  fontSize: isActive ? 14 : 13,
                  color: isDone ? '#111827' : '#9ca3af',
                }}
              >
                {cfg.label}
              </Text>
              {isActive && (
                <Text className="text-gray-500 text-xs mt-0.5">{cfg.description}</Text>
              )}
            </View>
          </View>
        )
      })}
    </View>
  )
}

// ─── Driver Map ───────────────────────────────────────────────────────────────
function DriverMap({ 
  driverLat, 
  driverLng, 
  destLat, 
  destLng 
}: { 
  driverLat: number; 
  driverLng: number; 
  destLat: number; 
  destLng: number 
}) {
  return (
    <View className="h-48 rounded-2xl overflow-hidden mb-3 border border-gray-100">
      <MapView
        style={{ flex: 1 }}
        initialRegion={{
          latitude: (driverLat + destLat) / 2,
          longitude: (driverLng + destLng) / 2,
          latitudeDelta: Math.abs(driverLat - destLat) * 2 || 0.05,
          longitudeDelta: Math.abs(driverLng - destLng) * 2 || 0.05,
        }}
        scrollEnabled={false}
        zoomEnabled={false}
      >
        <Marker 
          coordinate={{ latitude: driverLat, longitude: driverLng }} 
          title="Courier"
        >
          <View className="bg-primary-500 p-1.5 rounded-full border-2 border-white">
            <Ionicons name="bicycle" size={16} color="white" />
          </View>
        </Marker>
        <Marker 
          coordinate={{ latitude: destLat, longitude: destLng }} 
          title="You"
        >
          <Ionicons name="location" size={24} color="#ef4444" />
        </Marker>
      </MapView>
    </View>
  )
}

// ─── Driver Details ────────────────────────────────────────────────────────────
function DriverDetailsCard({ order }: { order: any }) {
  if (!order.driver_name) return null

  return (
    <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 flex-row items-center gap-3">
      <View className="w-12 h-12 bg-blue-50 rounded-full items-center justify-center">
        <Ionicons name="person" size={24} color="#2563eb" />
      </View>
      <View className="flex-1">
        <Text className="font-bold text-gray-900">{order.driver_name}</Text>
        <Text className="text-gray-400 text-xs uppercase font-semibold">{order.driver_plate || 'Courier'}</Text>
      </View>
      {order.driver_phone && (
        <TouchableOpacity 
          className="bg-primary-500 w-10 h-10 rounded-full items-center justify-center"
          onPress={() => Linking.openURL(`tel:${order.driver_phone}`)}
        >
          <Ionicons name="call" size={18} color="white" />
        </TouchableOpacity>
      )}
    </View>
  )
}

// ─── Exception Alert ───────────────────────────────────────────────────────────
function ExceptionAlert({ flag }: { flag: string }) {
  const config: Record<string, { title: string; body: string; icon: any }> = {
    driver_not_found: {
      title: 'Searching for Courier',
      body: 'We are having trouble finding a courier nearby. The merchant might retry or contact you soon.',
      icon: 'alert-circle'
    },
    driver_unresponsive: {
      title: 'Delivery Delayed',
      body: 'Your courier has not updated their location for a while. They might be in a poor signal area.',
      icon: 'warning'
    }
  }

  const cfg = config[flag] || config.driver_not_found

  return (
    <View className="bg-amber-50 rounded-2xl p-4 mb-3 flex-row gap-3 border border-amber-200">
      <Ionicons name={cfg.icon} size={24} color="#b45309" />
      <View className="flex-1">
        <Text className="font-bold text-amber-800">{cfg.title}</Text>
        <Text className="text-amber-700 text-xs mt-1">{cfg.body}</Text>
      </View>
    </View>
  )
}

// ─── Section card ──────────────────────────────────────────────────────────────
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View
      className="bg-white rounded-2xl p-4 mb-3"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
    >
      <Text className="font-bold text-gray-900 mb-3">{title}</Text>
      {children}
    </View>
  )
}

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const insets = useSafeAreaInsets()

  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [einvoiceDetails, setEinvoiceDetails] = useState({ tin: '', id_no: '' })

  const { data: order, isLoading, refetch } = useQuery({
    queryKey: ['order', orderId],
    queryFn:  () => ordersService.getById(orderId),
    refetchInterval: 30_000, // poll every 30s for live updates
  })

  const handleRequestInvoice = async () => {
    if (!einvoiceDetails.tin || !einvoiceDetails.id_no) {
       Toast.show({ type: 'error', text1: 'Missing fields', text2: 'Please fill in TIN and ID number' })
       return
    }
    setIsSubmitting(true)
    const { error } = await supabase.from('orders').update({
       einvoice_status: 'needs_einvoice_now',
       einvoice_details: {
         tin: einvoiceDetails.tin,
         id_no: einvoiceDetails.id_no,
         name: (order?.delivery_address as any)?.name || 'Order Customer'
       }
    }).eq('id', orderId)
    setIsSubmitting(false)
    if (error) {
       Toast.show({ type: 'error', text1: 'Failed to submit request', text2: error.message })
    } else {
       Toast.show({ type: 'success', text1: 'e-Invoice Requested', text2: 'We will process it shortly.' })
       setShowInvoiceForm(false)
       refetch()
    }
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50 p-4" style={{ paddingTop: insets.top + 60 }}>
        <Skeleton className="h-32 rounded-2xl mb-3" />
        <Skeleton className="h-48 rounded-2xl mb-3" />
        <Skeleton className="h-32 rounded-2xl" />
      </View>
    )
  }

  if (!order) return (
    <View className="flex-1 items-center justify-center">
      <Text className="text-gray-400">Order not found</Text>
    </View>
  )

  const cfg         = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
  const deliveryAddr = order.delivery_address as any

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white px-5 pt-4 pb-3 flex-row items-center gap-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.navigate('/(customer)/(orders)')}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900">Order Details</Text>
          <Text className="text-gray-400 text-xs">{order.order_number}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status hero */}
        <View
          className="rounded-2xl p-5 mb-3 items-center"
          style={{ backgroundColor: cfg.bg }}
        >
          <View
            className="w-16 h-16 rounded-full bg-white/60 items-center justify-center mb-3"
          >
            <Ionicons name={cfg.icon} size={32} color={cfg.color} />
          </View>
          <Text style={{ color: cfg.color, fontWeight: '800', fontSize: 18 }}>
            {cfg.label}
          </Text>
          <Text style={{ color: cfg.color, opacity: 0.75, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
            {cfg.description}
          </Text>

          {/* Delivery tracking link */}
          {order.delivery_tracking_url && (
            <TouchableOpacity
              onPress={() => Linking.openURL(order.delivery_tracking_url!)}
              className="mt-3 bg-white/80 rounded-full px-4 py-2 flex-row items-center gap-2"
            >
              <Ionicons name="location-outline" size={14} color={cfg.color} />
              <Text style={{ color: cfg.color, fontWeight: '600', fontSize: 13 }}>
                Track delivery
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Exception Alert */}
        {order.exception_flag && (
          <ExceptionAlert flag={order.exception_flag} />
        )}

        {/* Driver Tracking */}
        {order.status === 'out_for_delivery' && (
          <View>
            <DriverDetailsCard order={order} />
            {order.last_driver_lat != null && order.last_driver_lng != null && deliveryAddr?.lat != null && deliveryAddr?.lng != null && (
              <DriverMap 
                driverLat={order.last_driver_lat} 
                driverLng={order.last_driver_lng} 
                destLat={deliveryAddr.lat} 
                destLng={deliveryAddr.lng} 
              />
            )}
          </View>
        )}

        {/* Store info */}
        <SectionCard title="🏪  Store">
          <View className="flex-row items-center gap-3">
            <Image
              source={
                order.merchant?.logo_url
                  ? { uri: order.merchant.logo_url }
                  : require('../../../assets/placeholder-logo.png')
              }
              style={{ width: 44, height: 44, borderRadius: 10 }}
              contentFit="cover"
            />
            <View>
              <Text className="font-bold text-gray-900">{order.merchant?.store_name}</Text>
              <TouchableOpacity
                onPress={() => router.push(`/(customer)/(store)/${order.merchant?.store_name}`)}
              >
                <Text className="text-primary-600 text-xs font-medium">Visit store →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SectionCard>

        {/* Progress tracker */}
        <SectionCard title="📍  Order Progress">
          <TrackingTimeline currentStatus={order.status} />
        </SectionCard>

        {/* Order items */}
        <SectionCard title="🛍️  Items Ordered">
          <View className="gap-3">
            {order.items?.map((item: any) => (
              <View key={item.id} className="flex-row justify-between items-start">
                <View className="flex-1">
                  <Text className="text-gray-800 font-medium text-sm" numberOfLines={2}>
                    {item.product_name}
                  </Text>
                  {item.variant_name && (
                    <Text className="text-gray-400 text-xs">{item.variant_name}</Text>
                  )}
                  <Text className="text-gray-500 text-xs mt-0.5">
                    {formatCurrency(item.unit_price)} × {item.quantity}
                  </Text>
                </View>
                <Text className="text-gray-900 font-semibold text-sm ml-2">
                  {formatCurrency(item.line_total)}
                </Text>
              </View>
            ))}

            {/* Price breakdown */}
            <View className="border-t border-gray-100 pt-3 gap-1.5 mt-1">
              <View className="flex-row justify-between">
                <Text className="text-gray-500 text-sm">Subtotal</Text>
                <Text className="text-gray-900 text-sm font-medium">
                  {formatCurrency(Number(order.subtotal))}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-500 text-sm">Delivery fee</Text>
                <Text className="text-gray-900 text-sm font-medium">
                  {order.delivery_fee > 0
                    ? formatCurrency(Number(order.delivery_fee))
                    : 'Free'}
                </Text>
              </View>
              {order.discount_amount > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-green-600 text-sm">Discount</Text>
                  <Text className="text-green-600 text-sm font-medium">
                    -{formatCurrency(Number(order.discount_amount))}
                  </Text>
                </View>
              )}
              <View className="flex-row justify-between border-t border-gray-100 pt-2 mt-1">
                <Text className="text-gray-900 font-bold">Total</Text>
                <Text className="text-primary-600 font-bold text-lg">
                  {formatCurrency(Number(order.total_amount))}
                </Text>
              </View>
            </View>
          </View>
        </SectionCard>

        {/* Delivery address */}
        {deliveryAddr && (
          <SectionCard title="📬  Delivery Address">
            <Text className="text-gray-800 font-semibold text-sm">
              {deliveryAddr.name}
            </Text>
            <Text className="text-gray-500 text-sm mt-0.5">{deliveryAddr.phone}</Text>
            <Text className="text-gray-500 text-sm mt-0.5">
              {deliveryAddr.line1}
              {deliveryAddr.line2 ? `, ${deliveryAddr.line2}` : ''},
              {' '}{deliveryAddr.city}, {deliveryAddr.state} {deliveryAddr.postcode}
            </Text>
          </SectionCard>
        )}

        {/* Payment info */}
        <SectionCard title="💳  Payment">
          <View className="flex-row justify-between">
            <Text className="text-gray-500 text-sm">Method</Text>
            <Text className="text-gray-900 text-sm font-medium capitalize">
              {order.payment_method?.replace('_', ' ') ?? '—'}
            </Text>
          </View>
          <View className="flex-row justify-between mt-1.5">
            <Text className="text-gray-500 text-sm">Status</Text>
            <View
              className="rounded-full px-2 py-0.5"
              style={{
                backgroundColor:
                  order.payment_status === 'paid' ? '#dcfce7' : '#fef3c7',
              }}
            >
              <Text
                className="text-xs font-semibold capitalize"
                style={{
                  color: order.payment_status === 'paid' ? '#166534' : '#92400e',
                }}
              >
                {order.payment_status?.replace('_', ' ')}
              </Text>
            </View>
          </View>
          {order.payment_reference && (
            <View className="flex-row justify-between mt-1.5">
              <Text className="text-gray-500 text-sm">Reference</Text>
              <Text className="text-gray-700 text-xs font-mono">{order.payment_reference}</Text>
            </View>
          )}
        </SectionCard>

        {/* E-Invoice Section */}
        {order.einvoice_status && (
          <SectionCard title="🧾  LHDN e-Invoice">
             {order.einvoice_status === 'pending_buyer_request' ? (
                showInvoiceForm ? (
                  <View className="gap-2">
                    <Text className="text-gray-500 text-xs mb-2">Request an individual e-Invoice for tax purposes.</Text>
                    <Input
                      label="Tax Identification Number (TIN)"
                      placeholder="e.g. IG12345678"
                      value={einvoiceDetails.tin}
                      onChangeText={(val) => setEinvoiceDetails(p => ({...p, tin: val}))}
                    />
                    <Input
                      label="IC Number / Passport / BRN"
                      placeholder="e.g. 900101-01-1234"
                      value={einvoiceDetails.id_no}
                      onChangeText={(val) => setEinvoiceDetails(p => ({...p, id_no: val}))}
                    />
                    <View className="flex-row gap-2 mt-2">
                       <View className="flex-1">
                          <Button variant="outline" onPress={() => setShowInvoiceForm(false)}>Cancel</Button>
                       </View>
                       <View className="flex-1">
                          <Button onPress={handleRequestInvoice} loading={isSubmitting}>Submit</Button>
                       </View>
                    </View>
                  </View>
                ) : (
                  <View className="flex-row items-center justify-between">
                     <View className="flex-1 mr-2">
                        <Text className="text-gray-500 text-xs">You have not requested an e-Invoice. You can request one before the month ends.</Text>
                     </View>
                     <Button size="sm" onPress={() => setShowInvoiceForm(true)}>Request</Button>
                  </View>
                )
             ) : (
                <View className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex-row items-center gap-3">
                   <Ionicons name="document-text" size={20} color="#2563eb" />
                   <View className="flex-1">
                      <Text className="text-blue-900 font-medium text-sm">Status</Text>
                      <Text className="text-blue-700 text-xs capitalize">
                        {order.einvoice_status.replace(/_/g, ' ')}
                      </Text>
                   </View>
                </View>
             )}
          </SectionCard>
        )}

        {/* Leave review (delivered orders only) */}
        {order.status === 'delivered' && (
          <TouchableOpacity
            className="bg-primary-500 rounded-2xl p-4 flex-row items-center justify-center gap-2"
          >
            <Ionicons name="star-outline" size={18} color="#fff" />
            <Text className="text-white font-bold">Leave a Review</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  )
}
