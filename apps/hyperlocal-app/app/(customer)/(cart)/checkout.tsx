import {
  View, Text, ScrollView, TouchableOpacity, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useCartStore } from '@/stores/cartStore'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DeliveryMethodPicker } from '@/components/customer/DeliveryMethodPicker'
import { loyaltyService } from '@/services/loyalty.service'
import Toast from 'react-native-toast-message'
import type { Address, DeliveryOption } from '@/types/app.types'

const ID_TYPES = ['NRIC', 'BRN', 'PASSPORT'] as const
const CLASSIFICATION_CODES = [
  { code: '022', label: 'Others (General)' },
  { code: '003', label: 'Tech Gadget (Tax Relief)' },
  { code: '013', label: 'Lifestyle (Tax Relief)' },
  { code: '044', label: 'Vouchers/Loyalty' },
  { code: '030', label: 'Maintenance' },
] as const

const TIN_REGEX = /^(IG|C|OG|TA|NR|EI|F|SG)[0-9]{10,12}$/
const NRIC_REGEX = /^[0-9]{12}$/
const BRN_REGEX = /^[a-zA-Z0-9]{1,20}$/
const PHONE_REGEX = /^\+?[0-9]{7,15}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ─── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-white rounded-2xl p-4 mb-3"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
      <Text className="font-bold text-gray-900 mb-3">{title}</Text>
      {children}
    </View>
  )
}

// ─── Address picker ────────────────────────────────────────────────────────────
function AddressPicker({
  addresses, selected, onSelect,
}: { addresses: Address[]; selected: Address | null; onSelect: (a: Address) => void }) {
  if (addresses.length === 0) {
    return (
      <TouchableOpacity
        onPress={() => router.push('/(customer)/(profile)/addresses')}
        className="flex-row items-center gap-3 p-3 border-2 border-dashed border-gray-200 rounded-xl"
      >
        <Ionicons name="add-circle-outline" size={20} color="#2563eb" />
        <Text className="text-primary-600 font-medium">Add delivery address</Text>
      </TouchableOpacity>
    )
  }
  return (
    <View className="gap-2">
      {addresses.map(addr => (
        <TouchableOpacity key={addr.id} onPress={() => onSelect(addr)}
          className={`flex-row items-start gap-3 p-3 rounded-xl border-2
            ${selected?.id === addr.id ? 'border-primary-500 bg-primary-50' : 'border-gray-100'}`}
        >
          <View className={`w-5 h-5 rounded-full border-2 mt-0.5 items-center justify-center
            ${selected?.id === addr.id ? 'border-primary-500' : 'border-gray-300'}`}>
            {selected?.id === addr.id && (
              <View className="w-2.5 h-2.5 rounded-full bg-primary-500" />
            )}
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="font-semibold text-gray-900 text-sm">{addr.label}</Text>
              {addr.is_default && (
                <View className="bg-primary-100 rounded-full px-1.5 py-0.5">
                  <Text className="text-primary-700 text-[10px] font-semibold">Default</Text>
                </View>
              )}
            </View>
            <Text className="text-gray-600 text-xs mt-0.5">
              {addr.recipient_name} · {addr.phone}
            </Text>
            <Text className="text-gray-500 text-xs mt-0.5" numberOfLines={2}>
              {addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ''},
              {' '}{addr.city}, {addr.state} {addr.postcode}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        onPress={() => router.push('/(customer)/(profile)/addresses')}
        className="flex-row items-center gap-2 pt-1"
      >
        <Ionicons name="add-circle-outline" size={16} color="#2563eb" />
        <Text className="text-primary-600 text-sm font-medium">Add new address</Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── Payment picker ────────────────────────────────────────────────────────────
type PaymentMethod = 'razorpay' | 'billplz' | 'cod' | 'manual'

const PAYMENT_OPTIONS: {
  id: PaymentMethod; label: string; subtitle: string; emoji: string
}[] = [
  { id: 'razorpay', emoji: '💳', label: 'Card / E-wallet',      subtitle: 'Visa, Mastercard, Touch \'n Go, GrabPay' },
  { id: 'billplz',  emoji: '🏦', label: 'Online Banking (FPX)', subtitle: 'Maybank, CIMB, RHB, Public Bank & more'   },
  { id: 'cod',      emoji: '💵', label: 'Cash on Delivery',     subtitle: 'Pay when your order arrives'              },
  { id: 'manual',   emoji: '🧪', label: 'Manual Payment (Test)', subtitle: 'Instantly pays for testing purposes'     },
]

function PaymentPicker({
  selected, onSelect, disabledOptions = [],
}: {
  selected: PaymentMethod | null
  onSelect: (m: PaymentMethod) => void
  disabledOptions?: string[]
}) {
  const visibleOptions = PAYMENT_OPTIONS.filter(opt => !disabledOptions.includes(opt.id))

  return (
    <View className="gap-2">
      {visibleOptions.map(opt => (
        <TouchableOpacity key={opt.id} onPress={() => onSelect(opt.id)}
          className={`flex-row items-center gap-3 p-3 rounded-xl border-2
            ${selected === opt.id ? 'border-primary-500 bg-primary-50' : 'border-gray-100 bg-white'}`}
        >
          <Text style={{ fontSize: 22 }}>{opt.emoji}</Text>
          <View className="flex-1">
            <Text className="font-semibold text-gray-900 text-sm">{opt.label}</Text>
            <Text className="text-gray-500 text-xs mt-0.5">{opt.subtitle}</Text>
          </View>
          <View className={`w-5 h-5 rounded-full border-2 items-center justify-center
            ${selected === opt.id ? 'border-primary-500' : 'border-gray-300'}`}>
            {selected === opt.id && (
              <View className="w-2.5 h-2.5 rounded-full bg-primary-500" />
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  )
}

// ─── Order summary ─────────────────────────────────────────────────────────────
function OrderSummary({
  subtotal, deliveryFee, pointsDiscount = 0, isSelfPickup,
}: { subtotal: number; deliveryFee: number; pointsDiscount?: number; isSelfPickup: boolean }) {
  const total = subtotal + deliveryFee - pointsDiscount

  return (
    <View className="gap-2">
      <View className="flex-row justify-between">
        <Text className="text-gray-500 text-sm">Subtotal</Text>
        <Text className="text-gray-900 font-semibold text-sm">{formatCurrency(subtotal)}</Text>
      </View>
      <View className="flex-row justify-between">
        <Text className="text-gray-500 text-sm">Delivery fee</Text>
        {deliveryFee > 0 ? (
          <Text className="text-gray-900 font-semibold text-sm">{formatCurrency(deliveryFee)}</Text>
        ) : (
          <Text className="text-green-600 font-semibold text-sm">
            {isSelfPickup ? 'Self pickup' : 'Select delivery'}
          </Text>
        )}
      </View>
      {pointsDiscount > 0 && (
        <View className="flex-row justify-between">
          <Text className="text-amber-600 text-sm font-medium">🌟 Points discount</Text>
          <Text className="text-amber-600 font-bold text-sm">-{formatCurrency(pointsDiscount)}</Text>
        </View>
      )}
      <View className="border-t border-gray-100 pt-2 mt-1">
        <View className="flex-row justify-between">
          <Text className="font-bold text-gray-900">Total</Text>
          <Text className="font-bold text-primary-600 text-lg">{formatCurrency(total)}</Text>
        </View>
      </View>
    </View>
  )
}

function PointsSection({ balance, settings, usePoints, setUsePoints, pointsToRedeem, setPointsToRedeem, preview }: {
  balance: any; settings: any; usePoints: boolean; setUsePoints: (v: boolean) => void
  pointsToRedeem: number; setPointsToRedeem: (v: number) => void; preview: any
}) {
  if (!settings?.is_enabled || !balance || balance.balance < settings.min_redeem_points) return null

  return (
    <View className="bg-white rounded-2xl p-4 mb-3"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Text className="font-bold text-gray-900">🌟  Use Points</Text>
          <View className="bg-amber-100 rounded-full px-2 py-0.5">
            <Text className="text-amber-700 text-xs font-bold">
              {balance.balance.toLocaleString()} pts
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => { setUsePoints(!usePoints); setPointsToRedeem(0) }}
          className={`w-12 h-6 rounded-full transition-colors ${usePoints ? 'bg-blue-500' : 'bg-gray-200'}`}
        >
          <View className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-all ${usePoints ? 'ml-6' : 'ml-0.5'}`} />
        </TouchableOpacity>
      </View>

      {usePoints && (
        <View className="gap-3">
          <View className="flex-row gap-2">
            {[
              settings.min_redeem_points,
              Math.floor(balance.balance * 0.5),
              balance.balance,
            ].filter((v, i, arr) => v <= balance.balance && arr.indexOf(v) === i)
             .map(pts => (
              <TouchableOpacity key={pts}
                onPress={() => setPointsToRedeem(pts)}
                className={`flex-1 py-2 rounded-xl border-2 items-center ${
                  pointsToRedeem === pts ? 'border-blue-500 bg-blue-50' : 'border-gray-100'}`}
              >
                <Text className={`text-xs font-bold ${pointsToRedeem === pts ? 'text-blue-600' : 'text-gray-600'}`}>
                  {pts.toLocaleString()} pts
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {pointsToRedeem > 0 && preview && (
            <View className="bg-green-50 rounded-xl p-3 flex-row items-center justify-between">
              <Text className="text-green-700 text-sm font-medium">Discount applied</Text>
              <Text className="text-green-700 font-bold">-{formatCurrency(preview.actualDiscount)}</Text>
            </View>
          )}
          <Text className="text-gray-400 text-[10px]">
            Max {settings.max_redeem_pct}% of subtotal · {settings.min_redeem_points} pts minimum
          </Text>
        </View>
      )}
    </View>
  )
}

// ─── Main screen ───────────────────────────────────────────────────────────────
import { invokeWorker } from '@/lib/worker'

export default function CheckoutScreen() {
  const insets  = useSafeAreaInsets()
  const { user } = useAuthStore()
  const { items, merchantId, getTotal, clearCart } = useCartStore()

  const [selectedAddress, setSelectedAddress]   = useState<Address | null>(null)
  const [deliveryOption, setDeliveryOption]     = useState<DeliveryOption | null>(null)
  const [paymentMethod, setPaymentMethod]       = useState<PaymentMethod | null>(null)
  const [isPlacing, setIsPlacing]               = useState(false)

  // Loyalty state
  const [loyaltyBalance, setLoyaltyBalance] = useState<any>(null)
  const [loyaltySettings, setLoyaltySettings] = useState<any>(null)
  const [pointsToRedeem, setPointsToRedeem]   = useState(0)
  const [usePoints, setUsePoints]             = useState(false)

  // E-Invoice state
  const [needsEInvoice, setNeedsEInvoice] = useState(false)
  const [einvoiceDetails, setEinvoiceDetails] = useState({
    tin: '',
    id_type: 'NRIC' as 'NRIC' | 'BRN' | 'PASSPORT',
    id_no: '',
    classification_code: '022'
  })
  const [einvoiceErrors, setEinvoiceErrors] = useState<Record<string, string>>({})
  const [hasPrefilled, setHasPrefilled] = useState(false)

  // Pre-fill E-Invoice details from last order
  useEffect(() => {
    if (!user?.id || hasPrefilled) return

    const fetchLastInvoice = async () => {
      const { data, error } = await supabase
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
          setNeedsEInvoice(true)
          setHasPrefilled(true)
        }
      }
    }

    fetchLastInvoice()
  }, [user?.id, hasPrefilled])

  useEffect(() => {
    if (!merchantId) return
    loyaltyService.getBalance(merchantId).then(setLoyaltyBalance)
    loyaltyService.getSettings(merchantId).then(setLoyaltySettings)
  }, [merchantId])

  // Fetch merchant payment settings to show/hide gateways
  const { data: paymentSettings } = useQuery({
    queryKey: ['merchant-payment-settings', merchantId],
    queryFn: async () => {
      if (!merchantId) return null
      const [bp, rp] = await Promise.all([
        supabase.from('merchant_billplz_config').select('enabled').eq('merchant_id', merchantId).maybeSingle(),
        supabase.from('merchant_razorpay_config').select('use_global_key, key_id').eq('merchant_id', merchantId).maybeSingle(),
      ])
      return {
        billplz: bp.data?.enabled ?? false,
        razorpay: rp.data ? (rp.data.use_global_key || !!rp.data.key_id) : true, // Default to true if not configured yet (using global)
      }
    },
    enabled: !!merchantId,
  })

  // Total weight from cart items (product.weight_grams stored in cart item)
  const totalWeightKg = useMemo(() => {
    const grams = items.reduce((sum, i) => sum + ((i.weightGrams ?? 500) * i.quantity), 0)
    return Math.max(grams / 1000, 0.1)
  }, [items])

  // Computed totals
  const deliveryFee    = deliveryOption?.priceRM ?? 0
  
  const pointsPreview = (loyaltySettings && pointsToRedeem > 0)
    ? loyaltyService.previewRedemption(pointsToRedeem, getTotal(), loyaltySettings)
    : null

  const pointsDiscount = pointsPreview?.actualDiscount ?? 0
  const grandTotal     = Math.max(getTotal() + deliveryFee - pointsDiscount, 0)

  const isSelfPickup   = deliveryOption?.type === 'self_pickup'
  const hasDelivery    = !!deliveryOption

  const disabledPayments = useMemo(() => {
    const disabled = isSelfPickup ? ['cod'] : []
    if (paymentSettings) {
      if (!paymentSettings.billplz) disabled.push('billplz')
      if (!paymentSettings.razorpay) disabled.push('razorpay')
    } else {
      // While loading or if settings missing, default to hiding online payments
      disabled.push('billplz', 'razorpay')
    }
    return disabled
  }, [isSelfPickup, paymentSettings])

  const canPlace       = !!selectedAddress && hasDelivery && !!paymentMethod && items.length > 0 && !!merchantId

  // No auto-redirect for pickup payment anymore, mandatory choice

  // Fetch saved addresses
  const { data: addresses = [] } = useQuery<Address[]>({
    queryKey: ['addresses', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user!.id)
        .order('is_default', { ascending: false })
      const def = data?.find(a => a.is_default)
      if (def) setSelectedAddress(def)
      return data ?? []
    },
    enabled: !!user?.id,
  })

  // Reset delivery option when address changes
  const handleAddressSelect = (addr: Address) => {
    setSelectedAddress(addr)
    setDeliveryOption(null) // force re-selection with new quotes
  }

  const handlePlaceOrder = async () => {
    if (!canPlace || !deliveryOption) return
    setIsPlacing(true)
    try {
      // ─── 1. Format items for the RPC ──────────────────────────────────────────
      const orderItems = items.map(i => ({
        product_id:   i.productId,
        variant_id:   i.variantId ?? null,
        product_name: i.productName,
        variant_name: i.variantName || null,
        unit_price:   i.price,
        quantity:     i.quantity,
      }))

      const orderNumber = `ORD-${Date.now()}`

      // ─── 2. Atomic Order Creation via RPC ─────────────────────────────────────
      const { data: orderId, error } = await supabase.rpc('create_order_v2', {
        p_order_number:      orderNumber,
        p_merchant_id:       merchantId!,
        p_customer_id:       user!.id,
        p_subtotal:          getTotal(),
        p_delivery_fee:      deliveryFee,
        p_discount_amount:   0,
        p_total_amount:      grandTotal,
        p_payment_method:    paymentMethod,
        p_delivery_type:     deliveryOption.type,
        p_delivery_provider: deliveryOption.provider,
        p_delivery_address: {
          name:     selectedAddress!.recipient_name,
          phone:    selectedAddress!.phone,
          line1:    selectedAddress!.address_line1,
          line2:    selectedAddress!.address_line2 ?? null,
          city:     selectedAddress!.city,
          state:    selectedAddress!.state,
          postcode: selectedAddress!.postcode,
        },
        p_items:             orderItems,
        p_einvoice_status:   needsEInvoice ? 'needs_einvoice_now' : 'pending_buyer_request',
        p_einvoice_details:  needsEInvoice ? { 
          tin: einvoiceDetails.tin.replace(/[\s-]/g, '').toUpperCase(),
          id_type: einvoiceDetails.id_type,
          id_no: einvoiceDetails.id_no.replace(/[\s-]/g, '').toUpperCase(),
          name: selectedAddress!.recipient_name, 
          email: user?.email, 
          phone: selectedAddress!.phone,
          address_line1: selectedAddress!.address_line1,
          address_line2: selectedAddress!.address_line2 || null,
          city: selectedAddress!.city,
          state: selectedAddress!.state,
          postcode: selectedAddress!.postcode
        } : null,
      })

      if (error) {
        if (error.message.includes('INSUFFICIENT_STOCK')) {
          Toast.show({ type: 'error', text1: 'Item out of stock', text2: 'One or more items in your cart are no longer available.' })
        } else {
          throw error
        }
        setIsPlacing(false)
        return
      }

      // ─── 3. Redeem points if selected ─────────────────────────────────────────
      if (usePoints && pointsToRedeem > 0 && user && pointsPreview) {
        const { data: redeemData } = await invokeWorker('redeem-loyalty-points', {
          body: {
            orderId,
            pointsToRedeem: pointsPreview.actualPoints,
            customerId:     user.id,
          },
        })
        if (redeemData?.error) console.warn('Points redemption failed:', redeemData.error)
      }

      // ─── 4. Post-creation flow ────────────────────────────────────────────────
      clearCart()

      if (paymentMethod === 'cod' || paymentMethod === 'manual' || grandTotal === 0) {
        if (grandTotal === 0 || paymentMethod === 'manual') {
          await supabase
            .from('orders')
            .update({ status: 'confirmed', payment_status: 'paid', paid_at: new Date().toISOString() })
            .eq('id', orderId)
        } else {
          await supabase
            .from('orders')
            .update({ status: 'confirmed', payment_status: 'unpaid' })
            .eq('id', orderId)
        }
        Toast.show({ type: 'success', text1: 'Order placed! 🎉', text2: orderNumber })
        router.back() // Pop checkout off the cart stack so Cart tab shows empty cart
        setTimeout(() => {
          router.replace(`/(customer)/(orders)/${orderId}`)
        }, 100)
      } else {
        router.replace({
          pathname: '/(customer)/(cart)/payment-webview',
          params:   { orderId, paymentMethod },
        })
      }
    } catch (err: any) {
      console.error('Checkout error:', err)
      Toast.show({ type: 'error', text1: 'Failed to place order', text2: err.message })
    }
    setIsPlacing(false)
  }


  // Validation message
  const validationMsg = !selectedAddress
    ? 'Select a delivery address'
    : !hasDelivery
    ? 'Select a delivery method'
    : !paymentMethod
    ? 'Select a payment method'
    : (needsEInvoice && Object.keys(einvoiceErrors).length > 0)
    ? 'Please fix e-invoice errors'
    : null

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="bg-white px-5 pt-4 pb-3 flex-row items-center gap-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Checkout</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Step 1: Delivery Address */}
        <Section title="1️⃣  Contact & Address">
          <AddressPicker
            addresses={addresses}
            selected={selectedAddress}
            onSelect={handleAddressSelect}
          />
          {!selectedAddress && isSelfPickup && (
            <Text className="text-gray-400 text-xs mt-2 px-1">
              * An address is still needed for your contact name & phone number.
            </Text>
          )}
        </Section>

        {/* Step 2: Delivery Method */}
        <Section title="2️⃣  Delivery Method">
          {merchantId ? (
            <DeliveryMethodPicker
              merchantId={merchantId}
              selectedAddress={selectedAddress}
              cartSubtotal={getTotal()}
              totalWeightKg={totalWeightKg}
              selected={deliveryOption}
              onSelect={setDeliveryOption}
            />
          ) : (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="#2563eb" />
              <Text className="text-gray-400 text-sm mt-2">Loading store delivery info...</Text>
            </View>
          )}
        </Section>

        {/* Step 3: Payment */}
        <Section title="3️⃣  Payment Method">
          <PaymentPicker
            selected={paymentMethod}
            onSelect={setPaymentMethod}
            disabledOptions={disabledPayments}
          />
        </Section>

        {/* Step 4: Loyalty Points */}
        <PointsSection
          balance={loyaltyBalance}
          settings={loyaltySettings}
          usePoints={usePoints}
          setUsePoints={setUsePoints}
          pointsToRedeem={pointsToRedeem}
          setPointsToRedeem={setPointsToRedeem}
          preview={pointsPreview}
        />

        {/* Step 4.5: E-Invoice */}
        <Section title="🧾  LHDN e-Invoice (Standard)">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-1 mr-4">
              <Text className="text-gray-900 text-sm font-semibold">Request Individual e-Invoice</Text>
              <Text className="text-gray-400 text-[10px]">Collect TIN and ID for tax purposes</Text>
            </View>
            <TouchableOpacity
              onPress={() => setNeedsEInvoice(!needsEInvoice)}
              className={`w-12 h-6 rounded-full transition-colors ${needsEInvoice ? 'bg-primary-500' : 'bg-gray-200'}`}
            >
              <View className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-all ${needsEInvoice ? 'ml-6' : 'ml-0.5'}`} />
            </TouchableOpacity>
          </View>
          
          {needsEInvoice && (
            <View className="mt-3 gap-3">
              <View>
                <Text className="text-gray-500 text-[10px] mb-1 ml-1 font-bold uppercase tracking-wider">TIN Number</Text>
                <Input
                  placeholder="e.g. C1234567890"
                  value={einvoiceDetails.tin}
                  onChangeText={(cur) => {
                    const val = cur.toUpperCase()
                    const errors = { ...einvoiceErrors }
                    if (val && !TIN_REGEX.test(val.replace(/[\s-]/g, ''))) {
                      errors.tin = 'Invalid TIN format'
                    } else {
                      delete errors.tin
                    }
                    setEinvoiceErrors(errors)
                    setEinvoiceDetails(p => ({ ...p, tin: val }))
                  }}
                  autoCapitalize="characters"
                />
                {einvoiceErrors.tin && <Text className="text-red-500 text-[10px] mt-1 ml-1 font-medium">{einvoiceErrors.tin}</Text>}
              </View>

                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Text className="text-gray-500 text-[10px] mb-1 ml-1 font-bold uppercase tracking-wider">ID Type</Text>
                      <View className="border border-gray-100 rounded-xl bg-gray-50 overflow-hidden">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 4, gap: 4 }}>
                          {ID_TYPES.map(type => (
                            <Pressable 
                              key={type}
                              onPress={() => setEinvoiceDetails(p => ({ ...p, id_type: type }))}
                              className={`px-3 py-1.5 rounded-lg ${einvoiceDetails.id_type === type ? 'bg-white shadow-sm' : ''}`}
                            >
                              <Text className={`text-[10px] font-bold ${einvoiceDetails.id_type === type ? 'text-primary-600' : 'text-gray-400'}`}>
                                {type}
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    </View>
                    <View className="flex-[2]">
                      <Text className="text-gray-500 text-[10px] mb-1 ml-1 font-bold uppercase tracking-wider">ID Number</Text>
                      <Input
                        placeholder={einvoiceDetails.id_type === 'NRIC' ? '900101015555' : '202101012345'}
                        value={einvoiceDetails.id_no}
                        onChangeText={(cur) => {
                          const val = cur.toUpperCase()
                          const errors = { ...einvoiceErrors }
                          const clean = val.replace(/[\s-]/g, '')
                          if (einvoiceDetails.id_type === 'NRIC' && clean && !NRIC_REGEX.test(clean)) {
                            errors.id_no = 'NRIC must be 12 digits'
                          } else if (einvoiceDetails.id_type === 'BRN' && clean && !BRN_REGEX.test(clean)) {
                            errors.id_no = 'Invalid BRN format'
                          } else {
                            delete errors.id_no
                          }
                          setEinvoiceErrors(errors)
                          setEinvoiceDetails(p => ({ ...p, id_no: val }))
                        }}
                        autoCapitalize="characters"
                      />
                      {einvoiceErrors.id_no && <Text className="text-red-500 text-[10px] mt-1 ml-1 font-medium">{einvoiceErrors.id_no}</Text>}
                    </View>
                  </View>
                  <View>
                    <Text className="text-gray-500 text-[10px] mb-1 ml-1 font-bold uppercase tracking-wider">Classification Code</Text>
                    <View className="border border-gray-100 rounded-xl bg-gray-50 overflow-hidden">
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 4, gap: 4 }}>
                        {CLASSIFICATION_CODES.map(c => (
                          <Pressable 
                            key={c.code}
                            onPress={() => setEinvoiceDetails(p => ({ ...p, classification_code: c.code }))}
                            className={`px-3 py-1.5 rounded-lg ${einvoiceDetails.classification_code === c.code ? 'bg-white shadow-sm' : ''}`}
                          >
                            <Text className={`text-[10px] font-bold ${einvoiceDetails.classification_code === c.code ? 'text-primary-600' : 'text-gray-400'}`}>
                              {c.label} ({c.code})
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
            </View>
          )}
        </Section>

        {/* Step 5: Order summary */}
        <Section title="📋  Order Summary">
          <OrderSummary
            subtotal={getTotal()}
            deliveryFee={deliveryFee}
            pointsDiscount={pointsDiscount}
            isSelfPickup={isSelfPickup}
          />
        </Section>

        <Text className="text-gray-400 text-xs text-center px-4 mt-1 leading-relaxed">
          By placing your order you agree to our Terms of Service and Privacy Policy.
        </Text>
      </ScrollView>

      {/* Sticky CTA */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 pt-3"
        style={{ paddingBottom: insets.bottom + 8 }}
      >
        <View className="flex-row justify-between items-baseline mb-3">
          <Text className="text-gray-500 text-sm">Grand Total</Text>
          <Text className="text-2xl font-bold text-gray-900">
            {formatCurrency(grandTotal)}
          </Text>
        </View>
        <Button onPress={handlePlaceOrder} disabled={!canPlace} loading={isPlacing}>
          {paymentMethod === 'cod' || paymentMethod === 'manual' || isSelfPickup
            ? 'Place Order'
            : 'Continue to Payment →'}
        </Button>
        {validationMsg && (
          <Text className="text-gray-400 text-xs text-center mt-2">
            ⚠️ {validationMsg}
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}
