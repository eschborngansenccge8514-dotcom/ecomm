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
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import Toast from 'react-native-toast-message'

const TIN_REGEX = /^(IG|C|OG|TA|NR|EI|F|SG)[0-9]{10,12}$/
const NRIC_REGEX = /^[0-9]{12}$/
const BRN_REGEX = /^[a-zA-Z0-9]{1,20}$/
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

// ─── Provider timeline logic ───────────────────────────────────────────────────

const getProviderSteps = (order: any) => {
  const provider = order.delivery_provider || (order.delivery_type === 'pickup' ? 'self_pickup' : null)
  
  if (provider === 'lalamove') {
    return [
      { key: 'paid', label: 'Payment Received', desc: 'Order confirmed', icon: 'card-outline' as const },
      { key: 'preparing', label: 'Preparing', desc: 'Customizing your items', icon: 'restaurant-outline' as const },
      { key: 'finding_driver', label: 'Finding Driver', desc: 'Booking a Lalamove rider', icon: 'search-outline' as const },
      { key: 'driver_assigned', label: 'Driver Assigned', desc: order.driver_name ? `Rider: ${order.driver_name}` : 'A driver is heading to the store', icon: 'bicycle-outline' as const },
      { key: 'picked_up', label: 'On The Way', desc: 'Your order is in transit', icon: 'map-outline' as const },
      { key: 'delivered', label: 'Delivered', desc: 'Enjoy your order!', icon: 'checkmark-done-circle-outline' as const },
    ]
  }

  if (provider === 'easyparcel') {
    return [
      { key: 'paid', label: 'Payment Received', desc: 'Order confirmed', icon: 'card-outline' as const },
      { key: 'preparing', label: 'Preparing', desc: 'Packing your shipment', icon: 'cube-outline' as const },
      { key: 'pending_arrangement', label: 'Processing', desc: 'Courier is being arranged', icon: 'time-outline' as const },
      { key: 'collected', label: 'Collected', desc: 'Package with courier', icon: 'scan-outline' as const },
      { key: 'delivering', label: 'In Transit', desc: order.tracking_number ? `Tracking: ${order.tracking_number}` : 'Package is on its way', icon: 'airplane-outline' as const },
      { key: 'delivered', label: 'Delivered', desc: 'Your package arrived', icon: 'checkmark-done-circle-outline' as const },
    ]
  }

  if (provider === 'self_pickup') {
     return [
      { key: 'paid', label: 'Payment Received', desc: 'Order confirmed', icon: 'card-outline' as const },
      { key: 'preparing', label: 'Preparing', desc: 'Merchant is preparing your order', icon: 'restaurant-outline' as const },
      { key: 'ready_for_pickup', label: 'Ready for Pickup', desc: 'Your order is packed and ready', icon: 'bag-check-outline' as const },
      { key: 'delivered', label: 'Completed', desc: 'Picked up successfully', icon: 'checkmark-done-circle-outline' as const },
     ]
  }

  // Default Standard Delivery
  return [
    { key: 'paid', label: 'Payment Received', desc: 'Order confirmed', icon: 'card-outline' as const },
    { key: 'confirmed', label: 'Order Confirmed', desc: 'Merchant processing order', icon: 'checkmark-done-outline' as const },
    { key: 'preparing', label: 'Preparing', desc: 'Packing your items', icon: 'restaurant-outline' as const },
    { key: 'out_for_delivery', label: 'Out for Delivery', desc: 'Courier is on the way', icon: 'bicycle-outline' as const },
    { key: 'delivered', label: 'Delivered', desc: 'Order successfully delivered', icon: 'checkmark-done-circle-outline' as const },
  ]
}

function getActiveStepIndex(order: any, steps: any[]) {
   const primaryStatus = order.status
   const delStatus = (order.delivery_status || '').toLowerCase()
   const shipStatus = (order.ship_status || '').toLowerCase()
   const provider = order.delivery_provider || (order.delivery_type === 'pickup' ? 'self_pickup' : null)

   if (primaryStatus === 'cancelled' || primaryStatus === 'refunded' || primaryStatus === 'failed') return -1

   if (provider === 'lalamove') {
      if (primaryStatus === 'delivered') return steps.length - 1
      if (['picked_up', 'in_transit'].includes(delStatus)) return 4
      if (['on_the_way', 'driver_assigned'].includes(delStatus)) return 3
      if (['finding_driver', 'assigning_driver'].includes(delStatus)) return 2
      if (primaryStatus === 'preparing' || primaryStatus === 'confirmed') return 1
      if (primaryStatus === 'paid') return 0
      return 1 
   }

   if (provider === 'easyparcel') {
      if (primaryStatus === 'delivered' || shipStatus.includes('delivered') || shipStatus.includes('successfully')) return steps.length - 1
      if (shipStatus.includes('transit') || shipStatus.includes('delivering')) return 4
      if (shipStatus.includes('collected') || shipStatus.includes('drop off')) return 3
      if (shipStatus.includes('pending') || shipStatus.includes('arrangement') || order.tracking_number) return 2
      if (primaryStatus === 'preparing' || primaryStatus === 'confirmed') return 1
      if (primaryStatus === 'paid') return 0
      return 1
   }

   if (provider === 'self_pickup') {
      if (primaryStatus === 'delivered') return 3
      if (primaryStatus === 'ready_for_pickup') return 2
      if (primaryStatus === 'preparing' || primaryStatus === 'confirmed') return 1
      if (primaryStatus === 'paid') return 0
      return 0
   }

   // Standard
   if (primaryStatus === 'delivered') return 4
   if (primaryStatus === 'out_for_delivery') return 3
   if (primaryStatus === 'preparing') return 2
   if (primaryStatus === 'confirmed') return 1
   if (primaryStatus === 'paid') return 0

   return 0
}

// ─── Tracking timeline ─────────────────────────────────────────────────────────
function TrackingTimeline({ order }: { order: any }) {
  const currentStatus = order.status
  const isCancelled = currentStatus === 'cancelled' || currentStatus === 'refunded'

  if (isCancelled) {
    const cfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.cancelled
    return (
      <View className="items-center py-4 gap-2">
        <View
          className="w-16 h-16 rounded-full items-center justify-center"
          style={{ backgroundColor: cfg.bg }}
        >
          <Ionicons name={cfg.icon as any} size={32} color={cfg.color} />
        </View>
        <Text style={{ color: cfg.color, fontWeight: '700', fontSize: 15 }}>{cfg.label}</Text>
        <Text className="text-gray-400 text-sm text-center">{cfg.description}</Text>
      </View>
    )
  }

  const steps = getProviderSteps(order)
  const currentIdx = getActiveStepIndex(order, steps)

  return (
    <View className="py-2">
      {steps.map((step, idx) => {
        const isDone   = idx <= currentIdx
        const isActive = idx === currentIdx
        const isLast   = idx === steps.length - 1

        return (
          <View key={step.key} className="flex-row gap-3">
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
                    name={isActive ? step.icon : 'checkmark'}
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
                {step.label}
              </Text>
              {isActive && (
                <Text className="text-gray-500 text-xs mt-0.5">{step.desc}</Text>
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
  const [einvoiceDetails, setEinvoiceDetails] = useState({ tin: '', id_type: 'NRIC' as 'NRIC' | 'BRN' | 'PASSPORT', id_no: '', classification_code: '022' })
  const [einvoiceErrors, setEinvoiceErrors] = useState<Record<string, string>>({})
  const { user } = useAuthStore()
  const [hasPrefilled, setHasPrefilled] = useState(false)

  // Pre-fill E-Invoice details from last order
  useEffect(() => {
    if (!user?.id || hasPrefilled) return

    const fetchLastInvoice = async () => {
      const { data } = await supabase
        .from('einvoices')
        .select('einvoice_details')
        .eq('status', 'validated')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if ((data as any)?.einvoice_details) {
        const details = (data as any).einvoice_details
        if (details.tin && details.id_no) {
          setEinvoiceDetails({
            tin: details.tin,
            id_type: details.id_type || 'NRIC',
            id_no: details.id_no,
            classification_code: details.classification_code || '022'
          })
          setHasPrefilled(true)
        }
      }
    }

    fetchLastInvoice()
  }, [user?.id, hasPrefilled])

  const { data: order, isLoading, refetch } = useQuery({
    queryKey: ['order', orderId],
    queryFn:  () => ordersService.getById(orderId),
    refetchInterval: 30_000, 
  })

  const { data: einvoice } = useQuery({
    queryKey: ['einvoice', orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from('einvoices')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle()
      return data
    },
    enabled: !!orderId,
  })

  const handleRequestInvoice = async () => {
    const cleanTin = einvoiceDetails.tin.replace(/[\s-]/g, '').toUpperCase()
    const cleanId = einvoiceDetails.id_no.replace(/[\s-]/g, '').toUpperCase()

    if (!TIN_REGEX.test(cleanTin)) {
        Toast.show({ type: 'error', text1: 'Invalid TIN', text2: 'Please follow the format (e.g. C1234567890)' })
        return
    }

    if (einvoiceDetails.id_type === 'NRIC' && !NRIC_REGEX.test(cleanId)) {
        Toast.show({ type: 'error', text1: 'Invalid NRIC', text2: 'NRIC must be 12 digits' })
        return
    }

    setIsSubmitting(true)
    const { error } = await supabase.from('orders').update({
       einvoice_status: 'needs_einvoice_now',
       einvoice_details: {
         tin: cleanTin,
         id_type: einvoiceDetails.id_type,
         id_no: cleanId,
         classification_code: einvoiceDetails.classification_code || '022',
         name: (order?.delivery_address as any)?.recipient_name || (order?.delivery_address as any)?.name || 'Order Customer',
         email: (order as any)?.customer?.email || '',
         phone: (order?.delivery_address as any)?.phone || '',
         address_line1: (order?.delivery_address as any)?.address_line1 || '',
         address_line2: (order?.delivery_address as any)?.address_line2 || null,
         city: (order?.delivery_address as any)?.city || '',
         state: (order?.delivery_address as any)?.state || '',
         postcode: (order?.delivery_address as any)?.postcode || ''
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
          <TrackingTimeline order={order} />
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
        {(order.einvoice_status || einvoice) && (
          <SectionCard title="🧾  LHDN e-Invoice">
             {order.einvoice_status === 'pending_buyer_request' && !einvoice ? (
                showInvoiceForm ? (
                  <View className="gap-3">
                    <Text className="text-gray-500 text-xs mb-1">Fill in the details below to request your individual e-invoice (LHDN compliant).</Text>

                    <Input
                      label="Taxpayer TIN"
                      placeholder="e.g. IG12345678"
                      value={einvoiceDetails.tin}
                      onChangeText={(val) => setEinvoiceDetails(p => ({...p, tin: val.toUpperCase()}))}
                      autoCapitalize="characters"
                    />
                    
                    <View className="flex-row gap-3">
                       <View className="flex-1">
                          <Text className="text-gray-400 text-[10px] ml-1 mb-1 font-bold uppercase tracking-widest">ID Type</Text>
                          <View className="border border-gray-100 bg-gray-50 rounded-xl px-2 h-10 justify-center">
                             <Text className="text-sm font-bold text-gray-700">{einvoiceDetails.id_type}</Text>
                          </View>
                       </View>
                       <View className="flex-[2]">
                          <Input
                            label="ID Number"
                            placeholder="e.g. 900101011234"
                            value={einvoiceDetails.id_no}
                            onChangeText={(val) => setEinvoiceDetails(p => ({...p, id_no: val.toUpperCase()}))}
                            autoCapitalize="characters"
                          />
                       </View>
                    </View>

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
                        <Text className="text-gray-500 text-xs">Individual e-invoice is available for this order.</Text>
                     </View>
                     <Button size="sm" onPress={() => setShowInvoiceForm(true)}>Request</Button>
                  </View>
                )
             ) : (
                <View className="gap-3">
                   <View className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex-row items-center gap-3">
                      <Ionicons name="document-text" size={20} color="#2563eb" />
                      <View className="flex-1">
                         <Text className="text-blue-900 font-medium text-xs">E-Invoice Status</Text>
                         <Text className="text-blue-700 text-xs font-bold capitalize">
                            {(einvoice?.status || order.einvoice_status || 'Processing').replace(/_/g, ' ')}
                         </Text>
                      </View>
                      {einvoice?.status === 'validated' && (
                         <Ionicons name="checkmark-circle" size={24} color="#059669" />
                      )}
                   </View>

                   {einvoice?.status === 'rejected' && einvoice.error_message && (
                      <View className="p-3 bg-red-50 rounded-xl border border-red-100">
                         <View className="flex-row items-center gap-2 mb-1">
                            <Ionicons name="warning-outline" size={16} color="#dc2626" />
                            <Text className="text-red-700 font-black text-[10px] uppercase tracking-wider">LHDN Rejection</Text>
                         </View>
                         <Text className="text-red-600 text-[10px] leading-relaxed font-medium">
                            {einvoice.error_message}
                         </Text>
                         <TouchableOpacity 
                           onPress={() => setShowInvoiceForm(true)}
                           className="mt-3 bg-white border border-red-200 py-1.5 rounded-lg items-center"
                         >
                            <Text className="text-red-600 text-[10px] font-black uppercase">Edit & Try Again</Text>
                         </TouchableOpacity>
                      </View>
                   )}

                   {einvoice?.lhdn_uuid && (
                      <View className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                         <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1.5 ml-1">LHDN Reference</Text>
                         <Text className="text-gray-600 text-[10px] font-mono leading-none break-all bg-white p-2 border border-gray-100 rounded-lg">
                            {einvoice.lhdn_uuid}
                         </Text>
                         {einvoice?.qr_code_url && (
                            <TouchableOpacity 
                               onPress={() => einvoice.qr_code_url && Linking.openURL(einvoice.qr_code_url)}
                               className="mt-3 py-2 bg-blue-600 rounded-xl items-center flex-row justify-center gap-2"
                            >
                               <Ionicons name="qr-code-outline" size={16} color="white" />
                               <Text className="text-white font-bold text-xs uppercase tracking-tight">View LHDN Portal</Text>
                            </TouchableOpacity>
                         )}
                      </View>
                   )}
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
