'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  MessageCircle,
  Send,
  PackageSearch,
  LifeBuoy
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Avatar,
  AvatarFallback
} from '@/components/ui/avatar'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatWidgetProps {
  merchantId: string
  storeName?: string
  accentColor?: string
  initialWelcome?: string
}

export function ChatWidget({
  merchantId,
  storeName = 'Our Support',
  accentColor = '#2563eb',
  initialWelcome
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Session persistence (localStorage)
  useEffect(() => {
    const saved = localStorage.getItem(`support-session-${merchantId}`)
    if (saved) setSessionId(saved)
  }, [merchantId])

  // Returns the session ID (creates one if needed), without relying on React state timing
  const ensureSession = async (): Promise<string | null> => {
    if (sessionId) return sessionId
    try {
      const resp = await fetch('/api/support/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId })
      })
      const data = await resp.json()
      if (data.sessionId) {
        setSessionId(data.sessionId)
        localStorage.setItem(`support-session-${merchantId}`, data.sessionId)
        return data.sessionId
      }
    } catch (e) {
      console.error('Failed to initialize session', e)
    }
    return null
  }

  useEffect(() => {
    if (isOpen && !sessionId) {
      ensureSession()
    }
  }, [isOpen])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const onTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = input.trim()
    if (!content || isLoading) return

    const sid = await ensureSession()
    if (!sid) return

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content }
    const assistantId = crypto.randomUUID()
    setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newMessage: content, sessionId: sid, merchantId })
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`${res.status}: ${errText}`)
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('No response body')

      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })

        // Parse SSE format from createTextStreamResponse
        const lines = chunk.split('\n')
        let chunkText = ''
        let hasProtocol = false

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          if (trimmed.startsWith('data: ')) {
            hasProtocol = true
            const raw = trimmed.slice(6)
            if (raw === '[DONE]') continue
            try {
              const data = JSON.parse(raw)
              if (data.type === 'text-delta') chunkText += data.textDelta
            } catch {}
          } else if (trimmed.startsWith('0:')) {
            hasProtocol = true
            try { chunkText += JSON.parse(trimmed.slice(2)) } catch {}
          }
        }
        if (!hasProtocol && chunk) chunkText = chunk

        if (chunkText) {
          accumulated += chunkText
          setMessages(prev =>
            prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m)
          )
        }
      }

      if (!accumulated) {
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: 'Sorry, something went wrong.' } : m)
        )
      }
    } catch (err: any) {
      console.error('[SupportWidget] Error:', err)
      setMessages(prev =>
        prev.map(m => m.id === assistantId
          ? { ...m, content: `Sorry, I encountered an error. Please try again.` }
          : m
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] font-sans antialiased">
      {/* Floating Bubble */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{ backgroundColor: accentColor }}
          className="relative group p-4 rounded-full text-white shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 ease-in-out cursor-pointer hover:shadow-primary/30"
        >
          <div className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 border-2 border-white"></span>
          </div>
          <MessageCircle size={28} className="group-hover:rotate-12 transition-transform" />
          <span className="absolute right-full mr-4 px-3 py-1.5 bg-background text-foreground rounded-lg shadow-xl text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border">
            Need help with your order?
          </span>
        </button>
      )}

      {/* Expanded Interface */}
      {isOpen && (
        <Card className="w-[380px] h-[600px] flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-[24px] overflow-hidden border-none slide-up-fade-in transition-all">
          <CardHeader 
            style={{ backgroundColor: accentColor }}
            className="text-white p-6 pb-8 rounded-b-[32px] relative overflow-hidden"
          >
            {/* Background pattern */}
            <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none">
              <svg viewBox="0 0 100 100" className="w-full h-full fill-white scale-150 rotate-45 transform">
                <circle cx="20" cy="20" r="10" />
                <circle cx="80" cy="20" r="15" />
                <circle cx="40" cy="70" r="12" />
              </svg>
            </div>
            
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 border-2 border-white/20 bg-white/10 ring-4 ring-white/5">
                  <AvatarFallback className="bg-transparent font-bold">
                    <LifeBuoy size={20} />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-lg font-bold leading-none mb-1">{storeName}</CardTitle>
                  <p className="text-xs text-white/80 font-medium tracking-wide flex items-center gap-1.5 uppercase text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span> Service: AI Agent
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 -mr-2 hover:bg-white/20 rounded-full transition-colors"
                aria-label="Close chat"
              >
                <X size={20} />
              </button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-hidden p-0 flex flex-col -mt-4 bg-white rounded-t-[32px] relative z-20">
            {/* Scrolling History */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-5 pb-8 space-y-6 scroll-smooth"
            >
              <div className="text-center py-4">
                <p className="text-[11px] text-muted-foreground bg-muted/40 inline-block px-3 py-1 rounded-full uppercase tracking-tighter font-semibold">
                  New Secure Session Started
                </p>
              </div>

              {/* Initial Welcome */}
              <div className="flex justify-start">
                <div className="flex gap-3 max-w-[85%]">
                  <Avatar className="w-8 h-8 flex-shrink-0 border bg-slate-50">
                    <AvatarFallback><LifeBuoy size={14} /></AvatarFallback>
                  </Avatar>
                  <div className="p-4 rounded-2xl rounded-tl-none bg-slate-100 border text-sm leading-relaxed text-slate-800 shadow-sm font-medium">
                    {initialWelcome || "Hi! I'm your AI shopping assistant. How can I help you today?"}
                    <div className="mt-4 flex flex-wrap gap-2">
                       <Button 
                         variant="outline" 
                         size="sm" 
                         className="h-8 text-[11px] font-semibold border-slate-200 rounded-lg hover:bg-white transition-all hover:scale-105 active:scale-95"
                         onClick={() => setInput('Track my order')}
                        >
                         <PackageSearch size={12} className="mr-1.5" /> Track my order
                       </Button>
                       <Button
                         variant="outline"
                         size="sm"
                         className="h-8 text-[11px] font-semibold border-slate-200 rounded-lg hover:bg-white transition-all hover:scale-105 active:scale-95"
                         onClick={() => setInput('What is your return policy?')}
                        >
                         What is your return policy?
                       </Button>
                    </div>
                  </div>
                </div>
              </div>

              {messages.map((m: any, idx: number) => (
                <div 
                  key={m.id || idx}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {m.role !== 'user' && (
                      <Avatar className="w-8 h-8 flex-shrink-0 border bg-slate-50">
                        <AvatarFallback><LifeBuoy size={14} /></AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-none shadow-lg'
                        : 'bg-slate-100 border rounded-tl-none shadow-sm text-slate-800'
                    }`}>
                      {m.content}
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex gap-3 max-w-[85%]">
                    <Avatar className="w-8 h-8 flex-shrink-0 border bg-slate-50">
                      <AvatarFallback><LifeBuoy size={14} /></AvatarFallback>
                    </Avatar>
                    <div className="p-4 rounded-2xl rounded-tl-none bg-slate-100 border shadow-sm">
                      <div className="flex gap-1.5">
                        <span className="w-1.5 h-1.5 bg-muted-foreground/30 rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-muted-foreground/30 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-1.5 h-1.5 bg-muted-foreground/30 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Footer */}
            <footer className="p-5 border-t bg-background relative overflow-hidden backdrop-blur-md">
              <form 
                onSubmit={onTextSubmit}
                className="flex gap-2 p-1 border rounded-full focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 transition-all transition-shadow duration-300"
              >
                <input
                  placeholder="Ask about your order..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  className="flex-1 px-4 text-sm font-medium border-none focus:outline-none bg-transparent h-10"
                />
                <button 
                  type="submit" 
                  disabled={!input.trim() || isLoading}
                  style={{ backgroundColor: accentColor }}
                  className="w-10 h-10 rounded-full text-white flex items-center justify-center flex-shrink-0 disabled:opacity-50 disabled:grayscale transition-all hover:brightness-110 active:scale-90"
                >
                  <Send size={18} />
                </button>
              </form>
              <p className="text-[10px] text-center mt-3 text-muted-foreground font-medium tracking-tight opacity-50 uppercase flex items-center justify-center gap-1.5">
                AI Agent — <LifeBuoy size={10} /> Powered by Gemini
              </p>
            </footer>
          </CardContent>
        </Card>
      )}

      {/* Styled Animations (Global for this component context) */}
      <style jsx global>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .slide-up-fade-in {
          animation: fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  )
}
