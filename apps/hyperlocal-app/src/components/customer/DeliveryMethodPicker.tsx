import {
  View, Text, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native'
import { Image } from 'expo-image'
import { useEffect, useState, useRef } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { differenceInSeconds, parseISO } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import type { DeliveryOption } from '@/types/app.types'
import type { Address } from '@/types/app.types'

interface Props {
  merchantId:      string
  selectedAddress: Address | null
  cartSubtotal:    number
  totalWeightKg:   number
  selected:        DeliveryOption | null
  onSelect:        (option: DeliveryOption) => void
}

const C = {
  primary: '#2563eb',
  primary50: '#eff6ff',
  primary100: '#dbeafe',
  primary500: '#3b82f6',
  amber50: '#fffbeb',
  amber700: '#b45309',
  red50: '#fef2f2',
  red400: '#f87171',
  red600: '#dc2626',
  green100: '#dcfce7',
  green600: '#16a34a',
  green700: '#15803d',
  gray100: '#f3f4f6',
  gray400: '#9ca3af',
  gray900: '#111827',
}

// ─── Option row ────────────────────────────────────────────────────────────────
function OptionRow({
  option,
  selected,
  onSelect,
  timeLeft,
}: {
  option:   DeliveryOption
  selected: boolean
  onSelect: () => void
  timeLeft?: number
}) {
  const isInstant = option.type === 'instant'
  const isCourier = option.type === 'courier'

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  return (
    <TouchableOpacity
      onPress={onSelect}
      activeOpacity={0.8}
      style={[styles.optionRow, selected ? styles.optionRowSelected : styles.optionRowDefault]}
    >
      {/* Icon / Logo */}
      {isCourier ? (
        <Image
          source={{ uri: (option as any).courierLogo }}
          style={styles.courierLogo}
          contentFit="contain"
        />
      ) : (
        <View style={[styles.iconBox, selected ? styles.iconBoxSelected : styles.iconBoxDefault]}>
          <Text style={{ fontSize: 22 }}>
            {isInstant ? (option as any).emoji : '🏃'}
          </Text>
        </View>
      )}

      {/* Details */}
      <View style={{ flex: 1 }}>
        <Text style={styles.optionLabel}>
          {isInstant  ? (option as any).label
           : isCourier ? (option as any).courierName
           : 'Self Pickup'}
        </Text>
        <Text style={styles.optionSub} numberOfLines={1}>
          {isInstant  ? (option as any).description
           : isCourier ? `${(option as any).serviceName} · ${(option as any).delivery}`
           : 'Collect at the store. No delivery fee.'}
        </Text>
        
        {isInstant && timeLeft !== undefined && (
          <View style={styles.row}>
            <Ionicons name="timer-outline" size={12} color={timeLeft < 60 ? C.red600 : C.gray400} />
            <Text style={[styles.optionDetail, timeLeft < 60 && { color: C.red600, fontWeight: '600' }]}>
              {timeLeft > 0 ? `Price valid for ${formatTime(timeLeft)}` : 'Expired'}
            </Text>
          </View>
        )}

        {isCourier && (
          <View style={styles.row}>
            <Ionicons name="cube-outline" size={11} color={C.gray400} />
            <Text style={styles.optionDetail}>{(option as any).serviceDetail}</Text>
          </View>
        )}
      </View>

      {/* Price */}
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.optionPrice, option.priceRM === 0 ? styles.priceGreen : styles.pricePrimary]}>
          {option.priceRM === 0 ? 'Free' : formatCurrency(option.priceRM)}
        </Text>
        {isInstant && (
          <View style={styles.instantBadge}>
            <Text style={styles.instantBadgeText}>Instant</Text>
          </View>
        )}
      </View>

      {/* Radio */}
      <View style={[styles.radio, selected ? styles.radioSelected : styles.radioDefault]}>
        {selected && <View style={styles.radioDot} />}
      </View>
    </TouchableOpacity>
  )
}

// ─── Tab button ────────────────────────────────────────────────────────────────
function TabBtn({
  label, active, onPress,
}: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}
    >
      <Text style={[styles.tabLabel, active ? styles.tabLabelActive : styles.tabLabelInactive]}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
import { invokeWorker } from '@/lib/worker'

export function DeliveryMethodPicker({
  merchantId, selectedAddress, cartSubtotal,
  totalWeightKg, selected, onSelect,
}: Props) {
  type Tab = 'pickup' | 'instant' | 'courier'
  const [tab, setTab]               = useState<Tab>('pickup')
  const [isInstantLoading, setIsInstantLoading] = useState(false)
  const [isCourierLoading, setIsCourierLoading] = useState(false)
  const [hasFetchedInst, setHasFetchedInst]   = useState(false)
  const [hasFetchedCour, setHasFetchedCour]   = useState(false)
  const [instError, setInstError]       = useState<string | null>(null)
  const [courError, setCourError]       = useState<string | null>(null)
  const [instant, setInstant]           = useState<DeliveryOption[]>([])
  const [courier, setCourier]           = useState<DeliveryOption[]>([])
  const [selfPickup, setSelfPickup]     = useState<DeliveryOption | null>({
    type:        'self_pickup',
    provider:    'self_pickup',
    label:       'Self Pickup',
    emoji:       '🏃',
    description: 'Collect from the store yourself',
    priceRM:     0,
  })
  const [now, setNow] = useState(new Date())
  // Ref to guard against concurrent fetch calls (avoids stale-closure race on isInstantLoading)
  const fetchingRef = useRef(false)

  // Timer effect
  useEffect(() => {
    if (tab !== 'instant' || instant.length === 0) return
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [tab, instant.length])

  // Expiration check — use fetchingRef to avoid stale-closure race
  useEffect(() => {
    if (tab === 'instant' && instant.length > 0) {
      const expired = instant.some(opt => {
        const expiresAt = (opt as any).expiresAt
        if (!expiresAt) return false
        return differenceInSeconds(parseISO(expiresAt), now) <= 0
      })
      if (expired && !fetchingRef.current) {
        fetchInstantQuotes() // Auto refresh
      }
    }
  }, [now])

  const fetchInstantQuotes = async () => {
    if (!merchantId || !selectedAddress) return
    if (fetchingRef.current) return   // prevent concurrent fetches
    fetchingRef.current = true
    setIsInstantLoading(true)
    setInstError(null)
    try {
      const { data, error: fnError } = await invokeWorker('get-delivery-quotes', {
        body: {
          mode: 'instant',
          merchantId,
          deliveryAddress: {
            id:       selectedAddress.id,
            line1:    selectedAddress.address_line1,
            line2:    selectedAddress.address_line2 ?? '',
            city:     selectedAddress.city,
            state:    selectedAddress.state,
            postcode: selectedAddress.postcode,
            lat:      (selectedAddress as any).lat,
            lng:      (selectedAddress as any).lng,
          },
          totalWeightKg,
          parcelValue: cartSubtotal,
        },
      })
      if (fnError)     throw new Error(fnError.message)
      if (data?.error) throw new Error(data.error)
      setInstant(data.instant ?? [])
      setHasFetchedInst(true)
      if (data.instant?.[0] && !selected) onSelect(data.instant[0])
    } catch (err: any) {
      setInstError(err.message)
    } finally {
      setIsInstantLoading(false)
      fetchingRef.current = false
    }
  }

  const fetchCourierQuotes = async () => {
    if (!merchantId || !selectedAddress) return
    setIsCourierLoading(true)
    setCourError(null)
    try {
      const { data, error: fnError } = await invokeWorker('get-delivery-quotes', {
        body: {
          mode: 'courier',
          merchantId,
          deliveryAddress: {
            id:       selectedAddress.id,
            line1:    selectedAddress.address_line1,
            line2:    selectedAddress.address_line2 ?? '',
            city:     selectedAddress.city,
            state:    selectedAddress.state,
            postcode: selectedAddress.postcode,
            lat:      (selectedAddress as any).lat,
            lng:      (selectedAddress as any).lng,
          },
          totalWeightKg,
          parcelValue: cartSubtotal,
        },
      })
      if (fnError)     throw new Error(fnError.message)
      if (data?.error) throw new Error(data.error)
      setCourier(data.courier ?? [])
      setHasFetchedCour(true)
    } catch (err: any) {
      setCourError(err.message)
    } finally {
      setIsCourierLoading(false)
    }
  }

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab)
    if (newTab === 'instant' && !hasFetchedInst && !isInstantLoading) {
      fetchInstantQuotes()
    }
    if (newTab === 'courier' && !hasFetchedCour && !isCourierLoading) {
      fetchCourierQuotes()
    }
  }

  useEffect(() => {
    setInstant([])
    setCourier([])
    setHasFetchedInst(false)
    setHasFetchedCour(false)
    setInstError(null)
    setCourError(null)

    if (merchantId && selectedAddress) {
      // If user is already on a tab that needs data, fetch it now
      if (tab === 'instant') fetchInstantQuotes()
      if (tab === 'courier') fetchCourierQuotes()
    }
  }, [selectedAddress?.id, merchantId])

  const tabOptions = [
    { key: 'pickup'  as Tab, label: '🏃  Pickup' },
    { key: 'instant' as Tab, label: `🏍️  Instant (${instant.length})` },
    { key: 'courier' as Tab, label: `📦  Courier (${courier.length})` },
  ]

  const visibleOptions: DeliveryOption[] =
    tab === 'instant' ? instant :
    tab === 'courier' ? courier :
    selfPickup ? [selfPickup] : []

  return (
    <View>
      {/* Tab selector - using plain style, no className on pressables */}
      <View style={styles.tabBar}>
        {tabOptions.map(t => (
          <TabBtn
            key={t.key}
            label={t.label}
            active={tab === t.key}
            onPress={() => handleTabChange(t.key)}
          />
        ))}
      </View>

      {tab === 'instant' && instant.length > 0 && (
        <View style={styles.row}>
          <Ionicons name="time-outline" size={13} color={C.gray400} />
          <Text style={[styles.optionDetail, { marginLeft: 4 }]}>
            Instant prices are live quotes · valid for ~10 minutes
          </Text>
        </View>
      )}

      {!selectedAddress && tab !== 'pickup' ? (
        <View style={styles.warningBox}>
          <Ionicons name="information-circle-outline" size={18} color={C.amber700} />
          <Text style={styles.warningText}>
            Select a delivery address above to see {tab} options.
          </Text>
        </View>
      ) : ((tab === 'instant' && isInstantLoading) || (tab === 'courier' && isCourierLoading)) ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={C.primary} />
          <Text style={styles.loadingText}>
            {tab === 'instant' ? 'Finding local riders...' : 'Calculating courier rates...'}
          </Text>
        </View>
      ) : ((tab === 'instant' && instError) || (tab === 'courier' && courError)) ? (
        <View style={styles.errorBox}>
          <Ionicons name="warning-outline" size={16} color={C.red600} />
          <View style={{ flex: 1 }}>
            <Text style={styles.errorTitle}>Could not load {tab} rates</Text>
            <Text style={styles.errorSub}>{tab === 'instant' ? instError : courError}</Text>
            <TouchableOpacity
              onPress={() => tab === 'instant' ? fetchInstantQuotes() : fetchCourierQuotes()}
              style={styles.retryBtn}
            >
              <Ionicons name="refresh-outline" size={14} color={C.primary} />
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View>
          {visibleOptions.length === 0 ? (
            <View style={styles.centered}>
              <Text style={{ color: C.gray400, fontSize: 14 }}>
                {tab === 'instant'
                  ? 'No instant delivery available for this route.'
                  : tab === 'courier'
                  ? 'No courier services found for this postcode.'
                  : 'Pickup is currently unavailable.'}
              </Text>
            </View>
          ) : (
            visibleOptions.map((opt) => {
              const key =
                opt.type === 'instant' ? (opt as any).serviceType :
                opt.type === 'courier' ? (opt as any).rateId :
                'self_pickup'

              const expiresAt = (opt as any).expiresAt
              const timeLeft = expiresAt ? Math.max(0, differenceInSeconds(parseISO(expiresAt), now)) : undefined

              return (
                <OptionRow
                  key={key}
                  option={opt}
                  timeLeft={timeLeft}
                  selected={
                    selected?.type === opt.type &&
                    (opt.type === 'self_pickup'
                      ? true
                      : opt.type === 'instant'
                      ? (selected as any).serviceType === (opt as any).serviceType
                      : (selected as any).rateId === (opt as any).rateId)
                  }
                  onSelect={() => onSelect(opt)}
                />
              )
            })
          )}
        </View>
      )}

      <Text style={styles.weightNote}>
        Estimated parcel weight: {totalWeightKg.toFixed(2)} kg
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row:             { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8, paddingHorizontal: 4 },
  centered:        { alignItems: 'center', paddingVertical: 24, gap: 12 },
  loadingText:     { color: C.gray400, fontSize: 14 },
  weightNote:      { color: C.gray400, fontSize: 11, textAlign: 'right', marginTop: 4 },

  // Tab bar
  tabBar:          { flexDirection: 'row', backgroundColor: C.gray100, borderRadius: 16, padding: 4, marginBottom: 12 },
  tab:             { flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: 'center' },
  tabActive:       { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  tabLabel:        { fontSize: 13, fontWeight: '600' },
  tabLabelActive:  { color: C.gray900 },
  tabLabelInactive:{ color: C.gray400 },

  // Option row
  optionRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 2, marginBottom: 8 },
  optionRowDefault: { borderColor: C.gray100, backgroundColor: '#fff' },
  optionRowSelected:{ borderColor: C.primary500, backgroundColor: C.primary50 },
  iconBox:          { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconBoxDefault:   { backgroundColor: C.gray100 },
  iconBoxSelected:  { backgroundColor: C.primary100 },
  courierLogo:      { width: 44, height: 44, borderRadius: 8 },
  optionLabel:      { fontWeight: '700', color: C.gray900, fontSize: 14 },
  optionSub:        { color: C.gray400, fontSize: 12, marginTop: 2 },
  optionDetail:     { color: C.gray400, fontSize: 11, marginLeft: 2 },
  optionPrice:      { fontWeight: '700', fontSize: 16 },
  pricePrimary:     { color: C.primary },
  priceGreen:       { color: C.green600 },
  instantBadge:     { backgroundColor: C.green100, borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 },
  instantBadgeText: { color: C.green700, fontSize: 10, fontWeight: '600' },
  radio:            { width: 20, height: 20, borderRadius: 10, borderWidth: 2, marginLeft: 4, alignItems: 'center', justifyContent: 'center' },
  radioDefault:     { borderColor: '#d1d5db' },
  radioSelected:    { borderColor: C.primary500 },
  radioDot:         { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary500 },

  // Warning / Error boxes
  warningBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: C.amber50, borderRadius: 12, marginBottom: 12 },
  warningText: { color: C.amber700, fontSize: 14, flex: 1 },
  errorBox:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, backgroundColor: C.red50, borderRadius: 12, marginBottom: 12 },
  errorTitle:  { color: C.red600, fontWeight: '600', fontSize: 14 },
  errorSub:    { color: C.red400, fontSize: 12, marginTop: 2 },
  retryBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: '#fff', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.primary100 },
  retryText:   { color: C.primary, fontSize: 13, fontWeight: '600' },
})
