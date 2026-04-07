import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native'
import { Image } from 'expo-image'
import { useState, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { deliveryService, LalamoveQuote, EasyParcelRate } from '@/services/delivery.service'
import { formatCurrency } from '@/lib/utils'
import Toast from 'react-native-toast-message'

type DeliveryTab = 'lalamove' | 'easyparcel'

interface Props {
  visible:   boolean
  orderId:   string
  onClose:   () => void
  onBooked:  () => void
}

// ─── Lalamove option card ──────────────────────────────────────────────────────
function LalamoveCard({
  quote,
  selected,
  onSelect,
}: {
  quote:    LalamoveQuote
  selected: boolean
  onSelect: () => void
}) {
  const priceRM = quote.totalPrice
    ? `RM ${(Number(quote.totalPrice) / 100).toFixed(2)}`
    : '—'

  return (
    <TouchableOpacity
      onPress={onSelect}
      className={`flex-row items-center gap-3 p-3.5 rounded-2xl border-2 mb-2
        ${selected ? 'border-primary-500 bg-primary-50' : 'border-gray-100'}`}
    >
      <Text style={{ fontSize: 28 }}>{quote.emoji}</Text>
      <View className="flex-1">
        <Text className="font-bold text-gray-900 text-sm">{quote.label}</Text>
        <Text className="text-gray-400 text-xs mt-0.5">{quote.description}</Text>
        <Text className="text-gray-400 text-xs">Max {quote.maxKg} kg</Text>
      </View>
      <View className="items-end">
        <Text className="font-bold text-primary-600 text-base">{priceRM}</Text>
        <Text className="text-gray-400 text-xs">~15–45 min</Text>
      </View>
      <View className={`w-5 h-5 rounded-full border-2 ml-1
        ${selected ? 'border-primary-500' : 'border-gray-300'}`}>
        {selected && <View className="flex-1 m-0.5 rounded-full bg-primary-500" />}
      </View>
    </TouchableOpacity>
  )
}

// ─── EasyParcel option card ────────────────────────────────────────────────────
function EasyParcelCard({
  rate,
  selected,
  onSelect,
}: {
  rate:     EasyParcelRate
  selected: boolean
  onSelect: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onSelect}
      className={`flex-row items-center gap-3 p-3.5 rounded-2xl border-2 mb-2
        ${selected ? 'border-primary-500 bg-primary-50' : 'border-gray-100'}`}
    >
      <Image
        source={{ uri: rate.courierLogo }}
        style={{ width: 44, height: 44, borderRadius: 8 }}
        contentFit="contain"
      />
      <View className="flex-1">
        <Text className="font-bold text-gray-900 text-sm" numberOfLines={1}>
          {rate.courierName}
        </Text>
        <Text className="text-gray-500 text-xs mt-0.5" numberOfLines={1}>
          {rate.serviceName}
        </Text>
        <View className="flex-row items-center gap-1 mt-0.5">
          <Ionicons name="time-outline" size={11} color="#9ca3af" />
          <Text className="text-gray-400 text-xs">{rate.delivery}</Text>
          <View className="w-1 h-1 rounded-full bg-gray-300 ml-1" />
          <Text className="text-gray-400 text-xs capitalize">{rate.serviceDetail}</Text>
        </View>
      </View>
      <View className="items-end">
        <Text className="font-bold text-primary-600 text-base">
          {formatCurrency(rate.price)}
        </Text>
        <Text className="text-gray-400 text-xs">{rate.weightKg.toFixed(2)} kg</Text>
      </View>
      <View className={`w-5 h-5 rounded-full border-2 ml-1
        ${selected ? 'border-primary-500' : 'border-gray-300'}`}>
        {selected && <View className="flex-1 m-0.5 rounded-full bg-primary-500" />}
      </View>
    </TouchableOpacity>
  )
}

// ─── Main sheet ────────────────────────────────────────────────────────────────
export function DeliveryBookingSheet({ visible, orderId, onClose, onBooked }: Props) {
  const [activeTab, setActiveTab]     = useState<DeliveryTab>('lalamove')
  const [isLoading, setIsLoading]     = useState(false)
  const [isBooking, setIsBooking]     = useState(false)
  const [lalamoveQuotes, setLalamoveQuotes] = useState<LalamoveQuote[]>([])
  const [epRates, setEpRates]               = useState<EasyParcelRate[]>([])
  const [epWeightKg, setEpWeightKg]         = useState(0)
  const [selectedLalamove, setSelectedLalamove] = useState<LalamoveQuote | null>(null)
  const [selectedEp, setSelectedEp]             = useState<EasyParcelRate | null>(null)
  const [error, setError]             = useState<string | null>(null)

  const loadQuotes = useCallback(async (tab: DeliveryTab) => {
    setIsLoading(true)
    setError(null)
    try {
      if (tab === 'lalamove') {
        const quotes = await deliveryService.getLalamoveQuotes(orderId)
        setLalamoveQuotes(quotes)
      } else {
        const { rates, weightKg } = await deliveryService.getEasyParcelRates(orderId)
        setEpRates(rates)
        setEpWeightKg(weightKg)
      }
    } catch (err: any) {
      setError(err.message)
    }
    setIsLoading(false)
  }, [orderId])

  const handleTabChange = (tab: DeliveryTab) => {
    setActiveTab(tab)
    setSelectedLalamove(null)
    setSelectedEp(null)
    const hasData = tab === 'lalamove' ? lalamoveQuotes.length > 0 : epRates.length > 0
    if (!hasData) loadQuotes(tab)
  }

  const handleOpen = () => {
    if (lalamoveQuotes.length === 0) loadQuotes('lalamove')
  }

  const handleBook = async () => {
    const canBook = activeTab === 'lalamove' ? !!selectedLalamove : !!selectedEp
    if (!canBook) return

    Alert.alert(
      'Confirm booking?',
      activeTab === 'lalamove'
        ? `Book ${selectedLalamove!.label} — RM ${(Number(selectedLalamove!.totalPrice) / 100).toFixed(2)}`
        : `Book ${selectedEp!.courierName} — ${formatCurrency(selectedEp!.price)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Book Now', onPress: doBook },
      ]
    )
  }

  const doBook = async () => {
    setIsBooking(true)
    try {
      if (activeTab === 'lalamove' && selectedLalamove) {
        await deliveryService.bookLalamove(
          orderId,
          selectedLalamove.quotationId,
          selectedLalamove.serviceType
        )
        Toast.show({ type: 'success', text1: 'Lalamove booked!', text2: 'Driver is being assigned.' })
      } else if (activeTab === 'easyparcel' && selectedEp) {
        const result = await deliveryService.bookEasyParcel(orderId, selectedEp.serviceId, epWeightKg)
        Toast.show({ type: 'success', text1: 'Shipment booked!', text2: `AWB: ${result.awb}` })
      }
      onBooked()
      onClose()
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Booking failed', text2: err.message })
    }
    setIsBooking(false)
  }

  const selectedPrice = activeTab === 'lalamove'
    ? (selectedLalamove ? `RM ${(Number(selectedLalamove.totalPrice) / 100).toFixed(2)}` : null)
    : (selectedEp ? formatCurrency(selectedEp.price) : null)

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onShow={handleOpen}
    >
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <Text className="text-xl font-bold text-gray-900">Book Delivery</Text>
          <TouchableOpacity
            onPress={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
          >
            <Ionicons name="close" size={18} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* Tab switcher */}
        <View className="flex-row mx-5 mt-4 mb-2 bg-gray-100 rounded-2xl p-1">
          {([
            { key: 'lalamove',   label: '🏍️  Instant',  sub: 'Lalamove' },
            { key: 'easyparcel', label: '📦  Courier',   sub: 'EasyParcel' },
          ] as { key: DeliveryTab; label: string; sub: string }[]).map(tab => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => handleTabChange(tab.key)}
              className={`flex-1 items-center py-2 rounded-xl
                ${activeTab === tab.key ? 'bg-white shadow' : ''}`}
            >
              <Text className={`font-semibold text-sm
                ${activeTab === tab.key ? 'text-gray-900' : 'text-gray-500'}`}>
                {tab.label}
              </Text>
              <Text className={`text-xs
                ${activeTab === tab.key ? 'text-gray-400' : 'text-gray-400'}`}>
                {tab.sub}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center gap-3">
            <ActivityIndicator size="large" color="#2563eb" />
            <Text className="text-gray-400 text-sm">
              {activeTab === 'lalamove' ? 'Getting live rates...' : 'Checking courier rates...'}
            </Text>
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-8 gap-4">
            <Ionicons name="warning-outline" size={40} color="#ef4444" />
            <Text className="text-gray-700 font-semibold text-center">Failed to load rates</Text>
            <Text className="text-gray-400 text-sm text-center">{error}</Text>
            <TouchableOpacity
              onPress={() => loadQuotes(activeTab)}
              className="bg-primary-500 rounded-xl px-5 py-2.5"
            >
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 160 }}>
            {activeTab === 'lalamove' && lalamoveQuotes.length === 0 && (
              <View className="items-center py-12">
                <Text className="text-gray-400 text-sm">No Lalamove services available for this route.</Text>
              </View>
            )}

            {activeTab === 'lalamove' && lalamoveQuotes.map(q => (
              <LalamoveCard
                key={q.serviceType}
                quote={q}
                selected={selectedLalamove?.serviceType === q.serviceType}
                onSelect={() => setSelectedLalamove(q)}
              />
            ))}

            {activeTab === 'easyparcel' && epRates.length === 0 && (
              <View className="items-center py-12">
                <Text className="text-gray-400 text-sm">No courier services available for this route.</Text>
              </View>
            )}

            {activeTab === 'easyparcel' && epRates.map(r => (
              <EasyParcelCard
                key={r.rateId}
                rate={r}
                selected={selectedEp?.rateId === r.rateId}
                onSelect={() => setSelectedEp(r)}
              />
            ))}

            {/* Note about EasyParcel prepaid credit */}
            {activeTab === 'easyparcel' && (
              <View className="bg-amber-50 rounded-xl p-3 mt-2 flex-row gap-2">
                <Ionicons name="information-circle-outline" size={16} color="#d97706" />
                <Text className="text-amber-700 text-xs flex-1 leading-relaxed">
                  EasyParcel booking deducts from your EasyParcel prepaid credit balance.
                  Top up at app.easyparcel.com if booking fails.
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* Sticky CTA */}
        {!isLoading && !error && (
          <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 pt-3 pb-8">
            <TouchableOpacity
              onPress={handleBook}
              disabled={isBooking || (!selectedLalamove && !selectedEp)}
              className="rounded-2xl py-4 items-center flex-row justify-center gap-2"
              style={{
                backgroundColor: (!selectedLalamove && !selectedEp) ? '#e5e7eb' : '#2563eb',
              }}
            >
              {isBooking
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="bicycle-outline" size={20} color={(!selectedLalamove && !selectedEp) ? '#9ca3af' : '#fff'} />
              }
              <Text
                style={{
                  fontWeight: '700',
                  fontSize: 16,
                  color: (!selectedLalamove && !selectedEp) ? '#9ca3af' : '#fff',
                }}
              >
                {isBooking
                  ? 'Booking...'
                  : selectedPrice
                    ? `Book for ${selectedPrice}`
                    : 'Select a delivery option'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  )
}
