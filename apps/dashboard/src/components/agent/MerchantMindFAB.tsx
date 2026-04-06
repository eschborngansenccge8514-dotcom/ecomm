'use client'
import { useState, useEffect } from 'react'
import { Zap, X, Sparkles, Clock, Plus, ChevronLeft } from 'lucide-react'
import { AgentChatPanel } from './AgentChatPanel'
import { cn } from '@/lib/utils'

export function MerchantMindFAB() {
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<'chat' | 'history'>('chat')
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [sessions, setSessions] = useState<any[]>([])

  // Load sessions and auto-select latest
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const res = await fetch('/api/agent/sessions')
        if (res.ok) {
          const data = await res.json()
          setSessions(data)
          // Default to latest session if none active
          if (data.length > 0 && !sessionId) {
            setSessionId(data[0].id)
          }
        }
      } catch (e) {
        console.error('Failed to load sessions:', e)
      }
    }
    loadSessions()
  }, [])

  const handleSelectSession = (id: string) => {
    setSessionId(id)
    setView('chat')
  }

  const handleNewChat = () => {
    setSessionId(undefined)
    setView('chat')
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-4 pointer-events-none">
      {/* Chat Window Container */}
      <div className={cn(
        "pointer-events-auto",
        "w-[500px] h-[800px] max-h-[calc(100vh-8rem)]",
        "bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden",
        "flex flex-col transition-all duration-300 origin-bottom-right",
        isOpen ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4 pointer-events-none"
      )}>
        {/* Header */}
        <div className="bg-blue-600 p-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {view === 'history' ? (
              <button onClick={() => setView('chat')} className="p-1 hover:bg-white/10 rounded-md">
                <ChevronLeft size={18} />
              </button>
            ) : (
              <div className="p-1.5 bg-white/10 rounded-lg">
                <Zap size={18} className="text-white fill-white" />
              </div>
            )}
            <div>
              <h3 className="font-bold text-sm tracking-tight">
                {view === 'history' ? 'Chat History' : 'MerchantMind AI'}
              </h3>
              <p className="text-[10px] text-blue-100 font-medium">
                {view === 'history' ? 'Pick up where you left off' : 'Your operations assistant'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {view === 'chat' ? (
              <button 
                onClick={() => setView('history')}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                title="History"
              >
                <Clock size={18} />
              </button>
            ) : (
              <button 
                onClick={handleNewChat}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                title="New Chat"
              >
                <Plus size={18} />
              </button>
            )}
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
          {/* Chat View */}
          <div className={cn(
            "absolute inset-0 transition-transform duration-300",
            view === 'chat' ? "translate-x-0" : "-translate-x-full"
          )}>
            <AgentChatPanel hideHeader={true} initialSessionId={sessionId} key={sessionId ?? 'new-session'} />
          </div>

          {/* History View */}
          <div className={cn(
            "absolute inset-0 bg-gray-50 flex flex-col transition-transform duration-300",
            view === 'history' ? "translate-x-0" : "translate-x-full"
          )}>
            <div className="p-2 border-b bg-white">
              <button
                onClick={handleNewChat}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} /> New Chat
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessions.length === 0 && (
                <div className="py-12 text-center text-sm text-gray-400">
                  No history yet
                </div>
              )}
              {sessions.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => handleSelectSession(s.id)}
                  className={cn(
                    "w-full text-left p-3 rounded-xl transition-all border group",
                    sessionId === s.id 
                      ? "bg-blue-50 border-blue-100 shadow-sm" 
                      : "bg-white border-transparent hover:border-gray-200"
                  )}
                >
                  <p className={cn(
                    "text-sm font-medium truncate",
                    sessionId === s.id ? "text-blue-700" : "text-gray-900"
                  )}>
                    {s.title || 'Untitled Session'}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {new Date(s.updated_at).toLocaleDateString('en-MY', { 
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                    })}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "pointer-events-auto",
          "w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-95 duration-500 group",
          isOpen 
            ? "bg-white text-gray-900 shadow-sm" 
            : "bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-1"
        )}
      >
        <div className="relative">
          <Sparkles 
            size={24} 
            className={cn(
              "transition-all duration-500 fill-current",
              isOpen ? "scale-0 opacity-0 rotate-90" : "scale-100 opacity-100 rotate-0"
            )} 
          />
          <X 
            size={24} 
            className={cn(
              "absolute inset-0 transition-all duration-500",
              isOpen ? "scale-100 opacity-100 rotate-0" : "scale-0 opacity-0 -rotate-90"
            )} 
          />
        </div>
      </button>
    </div>
  )
}
