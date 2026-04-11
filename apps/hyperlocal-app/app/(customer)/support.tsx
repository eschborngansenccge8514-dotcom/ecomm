import React, { useState, useEffect, useRef } from 'react'
import EventSource from 'react-native-sse'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '@/stores/authStore'
import { BlurView } from 'expo-blur'
import Animated, { FadeInDown } from 'react-native-reanimated'

export default function SupportChatScreen() {
  const { merchantId, storeName, orderId, sessionId: sessionIdParam } = useLocalSearchParams<{ merchantId: string; storeName: string; orderId: string; sessionId: string }>()
  const insets = useSafeAreaInsets()
  const { profile, user } = useAuthStore()
  const [sessionId, setSessionId] = useState<string | null>(sessionIdParam ?? null)
  const [resolvedMerchantId, setResolvedMerchantId] = useState<string>(merchantId)
  const flatListRef = useRef<FlatList>(null)

  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Start a fresh support session
  const startNewChat = async () => {
    setMessages([])
    setSessionId(null)
    await initSession()
  }

  // API URL - use local IP for physical devices/emulators to reach the host
  const API_URL = process.env.EXPO_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3000'

  const handleSubmit = () => {
    const text = input.trim()
    if (!text || isLoading) return

    setInput('')
    setIsLoading(true)

    const userMsgId = 'user-' + Date.now().toString() + Math.random().toString(36).slice(2)
    setMessages((prev) => [...prev, { id: userMsgId, role: 'user', content: text }])

    const assistantId = 'assistant-' + Date.now().toString() + Math.random().toString(36).slice(2)
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    let accumulatedContent = ''

    const es = new EventSource(`${API_URL}/api/support/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        merchantId: resolvedMerchantId,
        customerId: user?.id,
        customerEmail: user?.email,
        customerName: profile?.full_name,
        orderId: orderId || undefined,
        newMessage: text
      }),
    })

    es.addEventListener('message', (event: any) => {
      if (event.data === '[DONE]') {
        es.close()
        setIsLoading(false)
        return
      }
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'text-delta') {
          const delta = data.delta ?? data.textDelta ?? ''
          accumulatedContent += delta
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: accumulatedContent } : m
            )
          )
        }
      } catch (err) {
        if (typeof event.data === 'string' && event.data.startsWith('0:')) {
          try {
            accumulatedContent += JSON.parse(event.data.slice(2))
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: accumulatedContent } : m
              )
            )
          } catch {}
        }
      }
    })

    es.addEventListener('error', (event) => {
      console.error('[SupportChat] EventSource Error:', event)
      setIsLoading(false)
      es.close()
    })
  }

  // Handle initial message
  const initialMessage = useLocalSearchParams().initialMessage as string
  const hasSentInitial = useRef(false)

  useEffect(() => {
    if (initialMessage && sessionId && !hasSentInitial.current) {
      hasSentInitial.current = true
      setInput(initialMessage)
      setTimeout(handleSubmit, 100)
    }
  }, [sessionId, initialMessage])

  const initSession = async () => {
    try {
      const resp = await fetch(`${API_URL}/api/support/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          merchantId,
          customerEmail: user?.email,
          customerName: profile?.full_name
        })
      })
      const data = await resp.json()
      if (data.sessionId) setSessionId(data.sessionId)
      if (data.merchantId) setResolvedMerchantId(data.merchantId)
    } catch (e) {
      console.error('Failed to init support session', e)
    }
  }

  // Initialize session (only if no sessionId passed in)
  useEffect(() => {
    if (!sessionIdParam) {
      initSession()
    } else {
      // Load messages for the provided session
      fetch(`${API_URL}/api/support/session/${sessionIdParam}/messages`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            setMessages(data.map((m: any) => ({ id: m.id, role: m.role, content: m.content })))
          }
        })
        .catch(e => console.error('Failed to load session messages', e))
    }
  }, [merchantId, user?.email])

  const renderMessage = ({ item, index }: { item: any, index: number }) => {
    const isUser = item.role === 'user' || item.role === 'customer'
    return (
      <Animated.View
        entering={FadeInDown.delay(index * 50).springify()}
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.botBubble
        ]}
      >
        <Text style={[styles.messageText, isUser ? styles.userText : styles.botText]}>
          {item.content}
        </Text>
      </Animated.View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>{storeName || 'Support'}</Text>
            <View style={styles.statusIndicator}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>AI Assistant</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(customer)/chat-history')}
            style={styles.historyToggleButton}
          >
            <Ionicons name="time-outline" size={22} color="#2563eb" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={startNewChat}
            style={styles.historyToggleButton}
          >
            <Ionicons name="add-circle-outline" size={24} color="#2563eb" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, index) => item.id || index.toString()}
            renderItem={renderMessage}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: Platform.OS === 'ios' ? 100 : 80 }
            ]}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="chatbubbles-outline" size={48} color="#94a3b8" />
                </View>
                <Text style={styles.emptyText}>Ask anything about products, orders, or policies!</Text>
              </View>
            }
          />

          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            style={styles.inputWrapper}
          >
            <View style={[styles.inputContainer, { marginBottom: Math.max(insets.bottom, 20) }]}>
              <TextInput
                style={styles.input}
                placeholder="Type your message..."
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={500}
              />
              <TouchableOpacity 
                onPress={() => handleSubmit()}
                disabled={!input.trim() || isLoading}
                style={[
                  styles.sendButton,
                  { opacity: !input.trim() || isLoading ? 0.5 : 1 }
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="send" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  historyToggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  statusText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  botText: {
    color: '#1e293b',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: 240,
    fontSize: 14,
    lineHeight: 20,
  },
  inputWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
    maxHeight: 120,
    fontSize: 15,
    color: '#1e293b',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
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
  }
})

