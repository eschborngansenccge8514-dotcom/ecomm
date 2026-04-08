import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '@/stores/authStore'
import { BlurView } from 'expo-blur'

const API_URL = process.env.EXPO_PUBLIC_DASHBOARD_URL ?? 'http://192.168.1.102:3000'

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '20', borderColor: color + '40' }]}>
      <Text style={[styles.badgeText, { color }]}>{text.toUpperCase()}</Text>
    </View>
  )
}

export default function ChatHistoryScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()
  const [sessions, setSessions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadSessions = async () => {
    if (!user?.email) return
    setIsLoading(true)
    try {
      const resp = await fetch(`${API_URL}/api/support/session?customerEmail=${user.email}`)
      const data = await resp.json()
      if (Array.isArray(data)) setSessions(data)
    } catch (e) {
      console.error('Failed to load chat history', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [user?.email])

  const handleOpenSession = (session: any) => {
    router.push({
      pathname: '/(customer)/support',
      params: {
        merchantId: session.merchant_id,
        storeName: session.merchants?.store_name ?? 'Support',
        sessionId: session.id,
      },
    })
  }

  const renderSession = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.sessionCard} onPress={() => handleOpenSession(item)} activeOpacity={0.7}>
      <View style={styles.sessionIconWrap}>
        <Ionicons name="chatbubble-ellipses" size={22} color="#2563eb" />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.sessionHeader}>
          <Text style={styles.sessionStoreName} numberOfLines={1}>
            {item.merchants?.store_name ?? 'Support Session'}
          </Text>
          <Text style={styles.sessionDate}>
            {new Date(item.updated_at).toLocaleDateString()}
          </Text>
        </View>
        {item.last_message && (
          <Text style={styles.sessionPreview} numberOfLines={1}>
            {item.last_message}
          </Text>
        )}
        <View style={styles.sessionFooter}>
          <Badge
            text={item.status}
            color={item.status === 'open' ? '#10b981' : '#64748b'}
          />
          <Text style={styles.sessionTime}>
            {new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Chat History</Text>
            <Text style={styles.headerSubtitle}>Your past conversations</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(customer)/support')}
            style={styles.newChatButton}
          >
            <Ionicons name="add" size={20} color="#2563eb" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        renderItem={renderSession}
        showsVerticalScrollIndicator={false}
        refreshing={isLoading}
        onRefresh={loadSessions}
        ListHeaderComponent={
          sessions.length > 0 ? (
            <Text style={styles.sectionLabel}>ALL CONVERSATIONS</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {isLoading ? (
              <ActivityIndicator color="#2563eb" />
            ) : (
              <>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="chatbubbles-outline" size={48} color="#94a3b8" />
                </View>
                <Text style={styles.emptyTitle}>No conversations yet</Text>
                <Text style={styles.emptySubtitle}>
                  Chat with a store to get help with products, orders, or policies.
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(customer)/(home)')}
                  style={styles.browseButton}
                >
                  <Text style={styles.browseButtonText}>Browse Stores</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    zIndex: 10,
  },
  headerContent: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  newChatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
  },
  list: {
    padding: 16,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1.2,
    marginBottom: 12,
    marginTop: 4,
  },
  sessionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sessionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sessionStoreName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    marginRight: 8,
  },
  sessionDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  sessionPreview: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
  },
  sessionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionTime: {
    fontSize: 11,
    color: '#cbd5e1',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: '#2563eb',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  browseButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
})
