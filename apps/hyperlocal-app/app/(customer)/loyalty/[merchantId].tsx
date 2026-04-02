import {
  View, Text, ScrollView, TouchableOpacity,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useEffect, useState }  from 'react'
import { loyaltyService }       from '@/services/loyalty.service'
import { format }               from 'date-fns'
import { Ionicons }             from '@expo/vector-icons'
import { useSafeAreaInsets }    from 'react-native-safe-area-context'

const TIER_CONFIG = {
  bronze:   { label: 'Bronze',   emoji: '🥉', bg: '#fef3c7', color: '#92400e' },
  silver:   { label: 'Silver',   emoji: '🥈', bg: '#f3f4f6', color: '#374151' },
  gold:     { label: 'Gold',     emoji: '🥇', bg: '#fef9c3', color: '#78350f' },
  platinum: { label: 'Platinum', emoji: '💎', bg: '#ede9fe', color: '#1e1b4b' },
}

export default function LoyaltyScreen() {
  const { merchantId } = useLocalSearchParams<{ merchantId: string }>()
  const insets = useSafeAreaInsets()
  const [balance, setBalance]   = useState<any>(null)
  const [history, setHistory]   = useState<any[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!merchantId) return
    Promise.all([
      loyaltyService.getBalance(merchantId),
      loyaltyService.getHistory(merchantId),
      loyaltyService.getSettings(merchantId),
    ]).then(([b, h, s]) => {
      setBalance(b); setHistory(h); setSettings(s)
      setLoading(false)
    })
  }, [merchantId])

  const tier = (balance?.tier ?? 'bronze') as keyof typeof TIER_CONFIG
  const cfg  = TIER_CONFIG[tier]

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Hero */}
      <View style={{ backgroundColor: cfg.bg, paddingTop: insets.top + 16 }} className="px-5 pb-8">
        <TouchableOpacity onPress={() => router.back()} className="mb-4">
          <Ionicons name="arrow-back" size={24} color={cfg.color} />
        </TouchableOpacity>
        
        <Text className="text-2xl font-bold" style={{ color: cfg.color }}>
          {cfg.emoji} {cfg.label} Member
        </Text>
        <View className="flex-row items-baseline gap-2 mt-2">
          <Text className="text-4xl font-bold" style={{ color: cfg.color }}>
            {(balance?.balance ?? 0).toLocaleString()}
          </Text>
          <Text className="text-lg" style={{ color: cfg.color }}>points</Text>
        </View>
        <Text className="text-sm opacity-60 mt-1" style={{ color: cfg.color }}>
          Total earned: {(balance?.total_earned ?? 0).toLocaleString()} pts ·
          Spent: RM {Number(balance?.total_spent_rm ?? 0).toFixed(2)}
        </Text>
      </View>

      {/* How it works */}
      {settings && (
        <View className="mx-4 -mt-4 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <Text className="font-bold text-gray-900 mb-3">How it works</Text>
          <div className="gap-2">
            {[
              { icon: 'star-outline',   text: `Earn ${settings.points_per_rm} pt per RM1 spent` },
              { icon: 'gift-outline',   text: `${settings.min_redeem_points} pts minimum to redeem` },
              { icon: 'cash-outline',   text: `100 pts = RM ${(100 * settings.rm_per_point).toFixed(2)} discount` },
              { icon: 'shield-outline', text: `Max ${settings.max_redeem_pct}% of order redeemable` },
            ].map((row, i) => (
              <View key={i} className="flex-row items-center gap-2 mb-2">
                <Ionicons name={row.icon as any} size={16} color="#6b7280" />
                <Text className="text-gray-600 text-sm">{row.text}</Text>
              </View>
            ))}
          </div>
        </View>
      )}

      {/* Tier benefits */}
      <View className="mx-4 mt-3 bg-white rounded-2xl p-4 border border-gray-100">
        <Text className="font-bold text-gray-900 mb-3">Tier Benefits</Text>
        {settings && [
          { tier: 'Bronze',   min: 0,                     mult: 1,                                    emoji: '🥉', key: 'bronze' },
          { tier: 'Silver',   min: settings.tier_silver_rm,   mult: settings.tier_silver_multiplier,   emoji: '🥈', key: 'silver' },
          { tier: 'Gold',     min: settings.tier_gold_rm,     mult: settings.tier_gold_multiplier,     emoji: '🥇', key: 'gold' },
          { tier: 'Platinum', min: settings.tier_platinum_rm, mult: settings.tier_platinum_multiplier, emoji: '💎', key: 'platinum' },
        ].map(t => (
          <View key={t.key}
            className={`flex-row items-center justify-between py-2 border-b border-gray-50 last:border-0 ${
              tier === t.key ? 'bg-amber-50 -mx-2 px-2 rounded-xl' : ''}`}
          >
            <View className="flex-row items-center gap-2">
              <Text>{t.emoji}</Text>
              <View>
                <Text className="font-semibold text-gray-800 text-sm">{t.tier}</Text>
                <Text className="text-gray-400 text-xs">
                  {t.min === 0 ? 'Starting tier' : `RM ${t.min}+ spent`}
                </Text>
              </View>
            </View>
            <Text className="text-blue-600 font-bold text-sm">×{t.mult} pts</Text>
          </View>
        ))}
      </View>

      {/* Transaction history */}
      <View className="mx-4 mt-3 mb-8">
        <Text className="font-bold text-gray-900 mb-3">Points History</Text>
        {history.length === 0 ? (
          <View className="bg-white rounded-2xl p-8 items-center border border-gray-100">
            <Text className="text-gray-400 text-sm">No transactions yet</Text>
          </View>
        ) : (
          <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {history.map((txn, i) => (
              <View key={txn.id}
                className={`flex-row items-center justify-between px-4 py-3 ${
                  i < history.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                <View className="flex-row items-center gap-3">
                  <View className={`w-8 h-8 rounded-full items-center justify-center ${
                    txn.type === 'earn' ? 'bg-green-100' : 'bg-red-100'}`}
                  >
                    <Ionicons
                      name={txn.type === 'earn' ? 'arrow-up' : 'arrow-down'}
                      size={14}
                      color={txn.type === 'earn' ? '#16a34a' : '#dc2626'}
                    />
                  </View>
                  <View>
                    <Text className="text-sm font-semibold text-gray-800 capitalize">
                      {txn.type === 'earn' ? 'Earned' : 'Redeemed'}
                    </Text>
                    <Text className="text-xs text-gray-400">
                      {format(new Date(txn.created_at), 'd MMM yyyy')}
                    </Text>
                  </View>
                </View>
                <View className="items-end">
                  <Text className={`font-bold text-sm ${txn.type === 'earn' ? 'text-green-600' : 'text-red-500'}`}>
                    {txn.points_delta > 0 ? '+' : ''}{txn.points_delta.toLocaleString()}
                  </Text>
                  <Text className="text-[10px] text-gray-400">
                    Bal: {txn.balance_after.toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  )
}
