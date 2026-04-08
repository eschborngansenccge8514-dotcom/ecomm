'use client'

import { useState, useRef, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { Paperclip, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { analyseReceipt } from '@/app/(dashboard)/expenses/actions'

interface Props {
  initialSessionId?: string
  hideHeader?: boolean
  userId?: string
}

export function AgentChatPanel({ initialSessionId, hideHeader = false, userId }: Props) {
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [streamErrorId, setStreamErrorId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Please log in first")

      const fileName = `${user.id}/${Date.now()}-${file.name}`
      const { data, error } = await supabase.storage
        .from('receipts')
        .upload(fileName, file)

      if (error) throw error

      toast.loading("Analyzing receipt...", { id: "analyze" })
      const result = await analyseReceipt(data.path, file.type)
      
      const payload = `[Attached Receipt - ${file.name}]\nExtracted details: ${JSON.stringify(result.extraction, null, 2)}\n\nPlease record this expense and let me know when it's done.`
      
      toast.success("Receipt parsed! Submitting to agent...", { id: "analyze" })
      handleSubmit(undefined, payload)

    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`, { id: "analyze" })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e?: React.FormEvent, overrideText?: string) => {
    e?.preventDefault()
    const text = (overrideText ?? input).trim()
    if (!text || isLoading) return

    setInput('')
    setIsLoading(true)

    // Cancel any in-flight request before starting a new one
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const userMsgId = `user-${Date.now()}`
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: text }])

    const assistantId = `assistant-${Date.now()}`
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, newMessage: text, messages }),
        signal: controller.signal,
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
      if (err.name === 'AbortError') return
      console.error('[MerchantMind] Chat Error:', err)
      toast.error(`Agent error: ${err.message}`)
      setStreamErrorId(assistantId)
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
    if (!sessionId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`agent-messages-${sessionId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'agent_messages',
        filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        // Deduplicate: If we already have this message (e.g. it was sent from dashboard), don't add
        setMessages(prev => {
          const exists = prev.some(m => m.id === payload.new.id)
          if (exists) return prev
          
          return [...prev, {
            id: payload.new.id,
            role: payload.new.role as 'user' | 'assistant',
            content: payload.new.content
          }]
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
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
    <div className={cn("flex flex-col h-full bg-background", !hideHeader && "border-l")}>
      {!hideHeader && (
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
      )}

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
                {streamErrorId === msg.id ? (
                  <span className="text-destructive opacity-80">⚠ Response interrupted. Please try again.</span>
                ) : msg.content || (
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
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*,application/pdf" 
          onChange={handleFileUpload} 
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || isUploading}
          className="p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
          title="Attach Receipt"
        >
          {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
        </button>
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
          disabled={isLoading || isUploading}
          className="flex-1 text-sm rounded-lg border bg-background px-3 py-2
                     focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || isUploading || !input.trim()}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground
                     text-sm font-medium disabled:opacity-40 hover:bg-primary/90
                     transition-colors flex-shrink-0"
        >
          {isLoading ? '…' : 'Send'}
        </button>
      </form>
    </div>
  )
}
