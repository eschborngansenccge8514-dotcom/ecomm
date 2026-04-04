// @ts-nocheck
'use client'

import { useState, useRef, useEffect } from 'react'
// @ts-ignore
import { useChat } from '@ai-sdk/react'
import { toast } from 'react-hot-toast'

interface Props {
  initialSessionId?: string
}

export function AgentChatPanel({ initialSessionId }: Props) {
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || isLoading) return
    
    const text = input.trim()
    setInput('')
    setIsLoading(true)

    const userMsgId = `user-${Date.now()}`
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: text }])

    const assistantId = `assistant-${Date.now()}`
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, newMessage: text, messages }),
      })

      const sid = res.headers.get('x-session-id')
      if (sid && !sessionId) setSessionId(sid)

      if (!res.ok) throw new Error(await res.text())
      if (!res.body) throw new Error('No body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulatedContent = ''
      let chunkBuffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        chunkBuffer += decoder.decode(value, { stream: true })
        
        // Data Stream Protocol uses single \n separators
        const lines = chunkBuffer.split('\n')
        chunkBuffer = lines.pop() || '' 

        for (const line of lines) {
          if (!line.trim()) continue
          
          // Data Stream Protocol prefixes:
          // 0: text chunks
          // d: data/structured delta
          // data: fallback for raw SSE
          
          let cleanLine = line.trim()
          if (cleanLine.startsWith('data: ')) {
            cleanLine = cleanLine.slice(6)
          }

          if (cleanLine === '[DONE]') {
             setIsLoading(false)
             continue
          }

          try {
            if (cleanLine.startsWith('0:')) {
              // 0:"text"
              const text = JSON.parse(cleanLine.slice(2))
              accumulatedContent += text
            } else if (cleanLine.startsWith('d:')) {
              // d:{"type":"text-delta","delta":"..."}
              const data = JSON.parse(cleanLine.slice(2))
              if (data.type === 'text-delta') {
                accumulatedContent += data.delta ?? data.textDelta ?? ''
              }
            } else if (cleanLine.startsWith('{')) {
               // Full JSON fallback
               const data = JSON.parse(cleanLine)
               if (data.type === 'text-delta') {
                  accumulatedContent += data.delta ?? data.textDelta ?? ''
               }
            }
            
            // Update messages on every valid chunk for real-time feel
            setMessages(prev => prev.map(m => 
              m.id === assistantId ? { ...m, content: accumulatedContent } : m
            ))
          } catch (err) {
            // Ignore incomplete chunks or non-json
          }
        }
      }
    } catch (err: any) {
      console.error('[MerchantMind] Chat Error:', err)
      toast.error(`Agent error: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (initialSessionId) {
      console.log(`[MerchantMind] Loading history for session: ${initialSessionId}`)
      const loadHistory = async () => {
        try {
          const res = await fetch(`/api/agent/sessions/${initialSessionId}/messages`)
          if (res.ok) {
            const history = await res.json()
            setMessages(history.map((m: any, idx: number) => ({
              id: `hist-${idx}-${Date.now()}`,
              role: m.role as 'user' | 'assistant',
              content: m.content
            })))
          }
        } catch (err) {
          console.error('[MerchantMind] Failed to load history:', err)
        }
      }
      loadHistory()
    }
  }, [initialSessionId, setMessages])

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

        {messages.map((msg: any) => (
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
          value={input}
          onChange={(e) => setInput(e.target.value)}
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
          disabled={isLoading || !input.trim()}
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
