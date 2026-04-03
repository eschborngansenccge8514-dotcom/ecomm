'use client'

import { useState, useRef, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { toast } from 'react-hot-toast'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  initialSessionId?: string
}

export function AgentChatPanel({ initialSessionId }: Props) {
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId)
  const [messages, setMessages] = useState<Message[]>([])
  const [localInput, setLocalInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (initialSessionId) {
      console.log(`[MerchantMind] Loading history for session: ${initialSessionId}`)
      const loadHistory = async () => {
        setIsLoading(true)
        try {
          const res = await fetch(`/api/agent/sessions/${initialSessionId}/messages`)
          console.log(`[MerchantMind] History fetch status: ${res.status}`)
          if (res.ok) {
            const history = await res.json()
            console.log(`[MerchantMind] Loaded ${history.length} messages`)
            setMessages(history.map((m: any, idx: number) => ({
              id: `hist-${idx}-${Date.now()}`,
              role: m.role,
              content: m.content
            })))
          } else {
            const err = await res.text()
            console.error(`[MerchantMind] History fetch failed: ${err}`)
          }
        } catch (err) {
          console.error('[MerchantMind] Failed to load history:', err)
          toast.error('Failed to load chat history')
        } finally {
          setIsLoading(false)
        }
      }
      loadHistory()
    }
  }, [initialSessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => {
      if (sessionId) {
        navigator.sendBeacon(`/api/agent/sessions/${sessionId}/close`)
      }
    }
  }, [sessionId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = localInput.trim()
    if (!content || isLoading) return

    const userMsg: Message = {
      id: uuidv4(),
      role: 'user',
      content
    }

    setMessages(prev => [...prev, userMsg])
    setLocalInput('')
    setIsLoading(true)

    const assistantId = uuidv4()
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newMessage: content, sessionId })
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`${res.status}: ${errText}`)
      }

      const sid = res.headers.get('x-session-id')
      if (sid && !sessionId) setSessionId(sid)

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No response body')

      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        
        // Protocol Agnostic Parser: Support both DataStream v2 (data: {"type":...}) and raw text
        const lines = chunk.split('\n')
        let chunkText = ''
        let hasProtocol = false

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          // Handle AI SDK v4+ / v6+ SSE Protocol (data: {"type":...})
          if (trimmed.startsWith('data: ')) {
            hasProtocol = true
            const rawData = trimmed.slice(6)
            if (rawData === '[DONE]') continue
            try {
              const data = JSON.parse(rawData)
              if (data.type === 'text-delta') {
                chunkText += data.textDelta
              } else if (data.type === '0') { // Legacy DataStream v1 (0:"text")
                chunkText += data
              }
            } catch (e) {
              // Not valid JSON — skip
            }
          } 
          // Handle Legacy DataStream v1 (0:"text")
          else if (trimmed.startsWith('0:')) {
            hasProtocol = true
            try {
              chunkText += JSON.parse(trimmed.slice(2))
            } catch {}
          }
        }

        // Fallback to raw text if no protocol markers found in the chunk
        if (!hasProtocol && chunk) {
          chunkText = chunk
        }

        if (chunkText) {
          accumulated += chunkText
          setMessages(prev =>
            prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m)
          )
        }
      }

      if (!accumulated) {
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: '(No response)' } : m)
        )
      }

    } catch (err: any) {
      console.error('[MerchantMind] Chat Error:', err)
      setMessages(prev =>
        prev.map(m => m.id === assistantId
          ? { ...m, content: `⚠️ Error: ${err.message}` }
          : m
        )
      )
      toast.error(`Agent error: ${err.message}`)
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleFeedback = async (messageId: string, rating: 1 | -1) => {
    if (!sessionId) return
    try {
      const res = await fetch('/api/agent/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: messageId, session_id: sessionId, rating })
      })
      if (res.ok) toast.success('Feedback recorded!')
    } catch (e) {
      console.error('Feedback failed:', e)
    }
  }

  return (
    <div className="flex flex-col h-full border-l bg-background">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-semibold">MerchantMind</span>
        </div>
        {sessionId && (
          <span className="text-xs text-muted-foreground font-mono">
            {sessionId.slice(0, 8)}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm space-y-1 pt-12">
            <p className="font-medium">How can I help today?</p>
            <p className="text-xs">Ask about orders, sales, or LHDN e-invoice rules.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[82%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap
                ${msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'}`}
              >
                {msg.content || (
                  <span className="animate-pulse opacity-60">Thinking…</span>
                )}
              </div>
            </div>

            {msg.role === 'assistant' && !isLoading && msg.content && (
              <div className="flex justify-start pl-1 gap-1">
                <button
                  onClick={() => handleFeedback(msg.id, 1)}
                  className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-md
                             text-xs grayscale hover:grayscale-0 transition-all opacity-60 hover:opacity-100"
                  title="Helpful"
                >
                  👍
                </button>
                <button
                  onClick={() => handleFeedback(msg.id, -1)}
                  className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md
                             text-xs grayscale hover:grayscale-0 transition-all opacity-60 hover:opacity-100"
                  title="Not helpful"
                >
                  👎
                </button>
              </div>
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-3 border-t flex gap-2">
        <input
          ref={inputRef}
          value={localInput}
          onChange={(e) => setLocalInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit(e as any)
            }
          }}
          placeholder="Ask MerchantMind…"
          disabled={isLoading}
          className="flex-1 text-sm rounded-lg border bg-background px-3 py-2
                     focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !localInput.trim()}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground
                     text-sm font-medium disabled:opacity-40 hover:bg-primary/90
                     transition-colors"
        >
          {isLoading ? '…' : 'Send'}
        </button>
      </form>
    </div>
  )
}
