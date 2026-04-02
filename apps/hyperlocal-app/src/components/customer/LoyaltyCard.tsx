import { View, Text, TouchableOpacity } from 'react-native'
import { useEffect, useState } from 'react'
import { loyaltyService } from '@/services/loyalty.service'
import { Ionicons } from '@expo/vector-icons'
import { router }   from 'expo-router'

const TIER_CONFIG = {
  bronze:   { label: 'Bronze',   emoji: '🥉', color: '#92400e', bg: '#fef3c7', progress: '#d97706' },
  silver:   { label: 'Silver',   emoji: '🥈', color: '#374151', bg: '#f3f4f6', progress: '#6b7280' },
  gold:     { label: 'Gold',     emoji: '🥇', color: '#78350f', bg: '#fef9c3', progress: '#eab308' },
  platinum: { label: 'Platinum', emoji: '💎', color: '#1e1b4b', bg: '#ede9fe', progress: '#7c3aed' },
}

interface Props {
  merchantId:   string
  programName?: string
  compact?:     boolean
}

export function LoyaltyCard({ merchantId, programName = 'Loyalty Points', compact = false }: Props) {
  const [balance, setBalance]   = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      loyaltyService.getBalance(merchantId),
      loyaltyService.getSettings(merchantId),
    ]).then(([b, s]) => {
      setBalance(b)
      setSettings(s)
      setLoading(false)
    })
  }, [merchantId])

  if (loading || !settings?.is_enabled) return null

  const tier   = (balance?.tier ?? 'bronze') as keyof typeof TIER_CONFIG
  const cfg    = TIER_CONFIG[tier]
  const pts    = balance?.balance ?? 0
  const spent  = Number(balance?.total_spent_rm ?? 0)

  // Progress to next tier
  const nextThreshold =
    tier === 'bronze'   ? settings.tier_silver_rm :
    tier === 'silver'   ? settings.tier_gold_rm   :
    tier === 'gold'     ? settings.tier_platinum_rm : null

  const prevThreshold =
    tier === 'silver'   ? settings.tier_silver_rm   :
    tier === 'gold'     ? settings.tier_gold_rm     :
    tier === 'platinum' ? settings.tier_platinum_rm : 0

  const progressPct = nextThreshold
    ? Math.min(((spent - prevThreshold) / (nextThreshold - prevThreshold)) * 100, 100)
    : 100

  if (compact) {
    return (
      <TouchableOpacity
        onPress={() => router.push(`/(customer)/loyalty/${merchantId}`)}
        className="flex-row items-center gap-2 bg-amber-50 rounded-xl px-3 py-2"
      >
        <Text>{cfg.emoji}</Text>
        <Text className="text-amber-800 font-bold text-sm">{pts.toLocaleString()} pts</Text>
        <Text className="text-amber-600 text-xs">· {cfg.label}</Text>
        <Ionicons name="chevron-forward" size={14} color="#92400e" />
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(customer)/loyalty/${merchantId}`)}
      activeOpacity={0.9}
      style={{ backgroundColor: cfg.bg }}
      className="rounded-2xl p-4 mx-4 mb-3"
    >
      <View className="flex-row items-center justify-between mb-3">
        <View>
          <Text className="text-xs font-semibold opacity-60" style={{ color: cfg.color }}>
            {programName}
          </Text>
          <View className="flex-row items-center gap-1.5 mt-0.5">
            <Text>{cfg.emoji}</Text>
            <Text className="font-bold text-lg" style={{ color: cfg.color }}>
              {cfg.label} Member
            </Text>
          </View>
        </View>
        <View className="items-end">
          <Text className="text-2xl font-bold" style={{ color: cfg.color }}>
            {pts.toLocaleString()}
          </Text>
          <Text className="text-xs opacity-60" style={{ color: cfg.color }}>points</Text>
        </View>
      </View>

      {/* Progress bar */}
      {nextThreshold && (
        <View>
          <View className="h-1.5 rounded-full bg-black/10 overflow-hidden">
            <View className="h-full rounded-full"
              style={{ width: `${progressPct}%`, backgroundColor: cfg.progress }} />
          </View>
          <Text className="text-xs mt-1 opacity-60" style={{ color: cfg.color }}>
            RM {(Number(nextThreshold) - spent).toFixed(2)} more to {
              tier === 'bronze' ? 'Silver' : tier === 'silver' ? 'Gold' : 'Platinum'
            } {tier === 'silver' ? '🥈' : tier === 'bronze' ? '🥈' : '💎'}
          </Text>
        </View>
      )}
      {tier === 'platinum' && (
        <Text className="text-xs mt-1 opacity-60" style={{ color: cfg.color }}>
          💎 You've reached the highest tier!
        </Text>
      )}
    </TouchableOpacity>
  )
}
