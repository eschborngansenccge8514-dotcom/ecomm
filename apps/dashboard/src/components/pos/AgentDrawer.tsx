'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  Sparkles, 
  X, 
  MessageSquare, 
  Send, 
  Terminal, 
  Bot,
  Maximize2,
  Minimize2,
  ChevronRight
} from 'lucide-react'
import { useChat } from '@ai-sdk/react'
import { usePosCart } from '@/stores/pos-cart'

export function AgentDrawer() {
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const cart = usePosCart()
  const scrollRef = useRef<HTMLDivElement>(null)

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/agent/pos-chat',
    body: {
      cartContext: {
        items: cart.items,
        totals: cart.getTotals(),
        customer: cart.customerName
      }
    }
  } as any) as any

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 group"
      >
        <Sparkles size={24} className="group-hover:rotate-12 transition-transform" />
        <div className="absolute right-full mr-3 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Ask MerchantMind (F8)
        </div>
      </button>
    )
  }

  return (
    <div 
      className={`fixed top-0 right-0 h-full bg-white z-[60] shadow-[-10px_0_40px_rgba(0,0,0,0.1)] transition-all duration-300 flex flex-col
        ${isExpanded ? 'w-[600px]' : 'w-[400px]'}`}
    >
      {/* Header */}
      <div className="h-16 border-b border-slate-100 flex items-center justify-between px-6 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-200">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">MerchantMind POS</h3>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Agent</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
          >
            {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 text-slate-400 hover:text-red-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center">
              <Bot size={32} className="text-slate-200" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-900">How can I help you today?</p>
              <p className="text-xs text-slate-400">Ask about products, apply discounts,<br/>or check stock levels.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full pt-4">
              {[
                'Apply 10% discount to all items',
                'What is the stock for Coca-Cola?',
                'Add a customer named John Doe'
              ].map((hint) => (
                <button 
                  key={hint}
                  className="px-4 py-2 text-[10px] font-bold text-slate-500 bg-slate-50 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-all text-left border border-slate-100"
                >
                  "{hint}"
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m: any) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed
                ${m.role === 'user' 
                  ? 'bg-slate-900 text-white rounded-tr-none' 
                  : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200 shadow-sm'}`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
             <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-tl-none border border-slate-200 flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '300ms' }} />
             </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-6 bg-slate-50/50 border-t border-slate-100">
        <form onSubmit={handleSubmit} className="relative">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Type your command..."
            className="w-full h-12 pl-4 pr-12 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 transition-all shadow-sm"
          />
          <button
            type="submit"
            disabled={!input || isLoading}
            className="absolute right-2 top-1.5 w-9 h-9 flex items-center justify-center bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:hover:bg-slate-900 transition-all shadow-lg shadow-slate-200"
          >
            <Send size={16} />
          </button>
        </form>
        <p className="mt-3 text-[10px] text-center font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
          <Terminal size={12} />
          F8 to toggle drawer
        </p>
      </div>
    </div>
  )
}
