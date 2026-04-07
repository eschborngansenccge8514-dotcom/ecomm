import React, { useState, useRef, useEffect } from 'react'
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator,
  Modal,
  ScrollView
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import Constants from 'expo-constants'
import { useChat } from '@ai-sdk/react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export default function MerchantMindScreen() {
  const insets = useSafeAreaInsets()
  const { profile } = useAuthStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isHistoryVisible, setIsHistoryVisible] = useState(false)
  const [sessions, setSessions] = useState<any[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const flatListRef = useRef<FlatList>(null)

  // Get host for local dev
  const getBaseUrl = () => {
    let url = 'http://localhost:3000'
    if (__DEV__) {
      const host = Constants.expoConfig?.hostUri?.split(':')[0]
      if (host && host !== 'localhost') {
        url = `http://${host}:3000`
      } else if (Platform.OS === 'android') {
        url = 'http://10.0.2.2:3000'
      }
    }
    return url
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchSessions = async () => {
    setIsRefreshing(true)
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (!authSession) return
      
      const sRes = await fetch(`${getBaseUrl()}/api/agent/sessions`, {
        headers: { 'Authorization': `Bearer ${authSession.access_token}` }
      })
      if (!sRes.ok) throw new Error('Failed')
      const data = await sRes.json()
      setSessions(data)
    } catch (err) {
      console.error('Fetch Sessions Error:', err)
    } finally {
      setIsRefreshing(false)
    }
  }

  const loadSessionContent = async (id: string) => {
    setIsHistoryVisible(false)
    setIsLoading(true)
    setSessionId(id)
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const mRes = await fetch(`${getBaseUrl()}/api/agent/sessions/${id}/messages`, {
        headers: { 'Authorization': `Bearer ${authSession?.access_token}` }
      })
      if (!mRes.ok) throw new Error('Failed to fetch biography')
      const history = await mRes.json()
      setMessages(history.map((m: any) => ({
        id: m.id || `h-${Math.random()}`,
        role: m.role,
        content: m.content
      })))
    } catch (err) {
      console.error('Load Session Error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchHistory = async () => {
    setIsLoading(true)
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (!authSession) return
      
      const baseUrl = getBaseUrl()
      
      // 1. Get recent sessions
      const sRes = await fetch(`${baseUrl}/api/agent/sessions`, {
        headers: { 'Authorization': `Bearer ${authSession.access_token}` }
      })
      if (!sRes.ok) throw new Error('Failed to fetch sessions')
      
      const sessions = await sRes.json()
      if (!Array.isArray(sessions) || sessions.length === 0) return
      
      const lastSessionId = sessions[0].id
      setSessionId(lastSessionId)
      
      // 2. Load messages for that session
      const mRes = await fetch(`${baseUrl}/api/agent/sessions/${lastSessionId}/messages`, {
        headers: { 'Authorization': `Bearer ${authSession.access_token}` }
      })
      if (!mRes.ok) throw new Error('Failed to fetch history')
      
      const history = await mRes.json()
      if (Array.isArray(history)) {
        setMessages(history.map((m: any) => ({
          id: m.id || `h-${Date.now()}-${Math.random()}`,
          role: m.role as 'user' | 'assistant',
          content: m.content
        })))
      }
    } catch (error) {
      console.error('[MerchantMind] History recovery failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Get session for Bearer token
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch(`${getBaseUrl()}/api/agent/chat`, { 
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ 
          newMessage: userMessage.content,
          sessionId: sessionId,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          stream: false // CRITICAL: Disable streaming for mobile/RN compatibility
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.message || `Failed to reach Agent (${response.status})`)
      }

      const data = await response.json()
      
      const assistantMessage: Message = {
        id: `assist-${Date.now()}`,
        role: 'assistant',
        content: data.text || "I'm sorry, I'm having trouble processing that right now.",
      }

      setMessages(prev => [...prev, assistantMessage])
      if (data.sessionId) setSessionId(data.sessionId)

    } catch (error: any) {
      console.error('Agent Error:', error)
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Oops! ${error.message || "I encountered an error. Please try again later."}`,
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const renderMessage = ({ item }: { item: Message }) => (
    <View className={`mb-4 flex-row ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <View 
        className={`max-w-[80%] px-4 py-3 rounded-2xl ${
          item.role === 'user' ? 'bg-primary-600 rounded-tr-none' : 'bg-white border border-gray-100 rounded-tl-none'
        }`}
      >
        <Text className={`text-sm leading-relaxed ${item.role === 'user' ? 'text-white' : 'text-gray-900'}`}>
          {item.content}
        </Text>
      </View>
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <View 
        className="px-5 py-4 bg-white border-b border-gray-100 flex-row items-center justify-between"
        style={{ paddingTop: Math.max(insets.top, 16) }}
      >
        <View className="flex-row items-center gap-2">
          <View className="w-8 h-8 bg-primary-50 rounded-full items-center justify-center">
            <Ionicons name="sparkles" size={16} color="#2563eb" />
          </View>
          <View>
            <Text className="text-lg font-bold text-gray-900 leading-tight">MerchantMind AI</Text>
            <Text className="text-[10px] text-green-500 font-bold uppercase tracking-widest">Active Assistant</Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          <TouchableOpacity 
            onPress={() => {
              setIsHistoryVisible(true)
              fetchSessions()
            }}
            className="w-10 h-10 bg-gray-50 rounded-xl items-center justify-center border border-gray-100"
          >
            <Ionicons name="time-outline" size={20} color="#64748b" />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => {
              setMessages([])
              setSessionId(null)
            }}
            className="flex-row items-center gap-1.5 bg-gray-50 h-10 px-4 rounded-xl border border-gray-100"
          >
            <Ionicons name="add-circle-outline" size={18} color="#64748b" />
            <Text className="text-sm font-bold text-gray-600">New</Text>
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          style={{ flex: 1 }}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 20 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20 opacity-30">
              <Ionicons name="chatbubbles-outline" size={64} color="#64748b" />
              <Text className="text-gray-600 mt-4 font-medium text-center px-10">
                Ask me anything about your shop, inventory, or latest sales.
              </Text>
            </View>
          }
        />

        <View 
          className="px-4 py-4 bg-white border-t border-gray-100 flex-row items-center gap-3"
          style={{ paddingBottom: Math.max(insets.bottom, 24) }}
        >
          <TouchableOpacity className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
            <Ionicons name="attach-outline" size={24} color="#64748b" />
          </TouchableOpacity>
          <View className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 flex-row items-center">
            <TextInput
              placeholder="Type your question..."
              className="flex-1 text-sm font-medium py-1"
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={500}
            />
            {isLoading ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              <TouchableOpacity 
                disabled={!input.trim()} 
                onPress={handleSendMessage}
                className={`ml-2 w-8 h-8 rounded-full items-center justify-center ${input.trim() ? 'bg-primary-600' : 'bg-gray-300'}`}
              >
                <Ionicons name="arrow-up" size={18} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={isHistoryVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View 
            className="bg-white rounded-t-[32px] h-[70%] p-6"
            style={{ paddingBottom: Math.max(insets.bottom, 24) }}
          >
            <View className="flex-row items-center justify-between mb-6">
              <View>
                <Text className="text-xl font-black text-gray-900">Chat History</Text>
                <Text className="text-xs text-gray-400 font-bold uppercase tracking-widest">Previous Sessions</Text>
              </View>
              <TouchableOpacity onPress={() => setIsHistoryVisible(false)} className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
                <Ionicons name="close" size={20} color="#1f2937" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {isRefreshing ? (
                <ActivityIndicator size="large" color="#2563eb" className="my-10" />
              ) : sessions.length === 0 ? (
                <View className="items-center py-20 opacity-30">
                  <Ionicons name="hourglass-outline" size={48} color="#64748b" />
                  <Text className="text-sm font-medium mt-4">No past chats found</Text>
                </View>
              ) : (
                sessions.map(s => (
                  <TouchableOpacity 
                    key={s.id}
                    onPress={() => loadSessionContent(s.id)}
                    className={`p-4 rounded-2xl mb-3 border ${sessionId === s.id ? 'bg-primary-50 border-primary-200' : 'bg-gray-50 border-gray-100'}`}
                  >
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className={`font-bold uppercase italic tracking-tighter ${sessionId === s.id ? 'text-primary-700' : 'text-gray-900'}`} numberOfLines={1}>
                        {s.title || 'Untitled Session'}
                      </Text>
                      {sessionId === s.id && (
                        <View className="bg-primary-600 px-2 py-0.5 rounded-full">
                          <Text className="text-[8px] text-white font-bold uppercase">Active</Text>
                        </View>
                      )}
                    </View>
                    <View className="flex-row items-center gap-1.5 opacity-40">
                      <Ionicons name="calendar-outline" size={10} color="#64748b" />
                      <Text className="text-[10px] font-bold text-gray-600">
                        {new Date(s.created_at).toLocaleDateString()} at {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}
