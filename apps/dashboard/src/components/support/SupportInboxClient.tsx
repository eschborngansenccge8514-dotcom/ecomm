'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { 
  Badge 
} from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { 
  Tabs, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs'
import { 
  Avatar, 
  AvatarFallback 
} from '@/components/ui/avatar'
import { 
  Card, 
  CardContent 
} from '@/components/ui/card'
import { 
  Search, 
  Send, 
  User, 
  Bot, 
  ShieldAlert, 
  CheckCircle2, 
  MoreVertical,
  Tag,
  Filter
} from 'lucide-react'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface SupportInboxClientProps {
  userId: string
  initialSessions: any[]
  defaultSessionId?: string | null
}

const CATEGORIES = {
  'sales': { label: 'Sales', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' },
  'order_issue': { label: 'Order Issue', color: 'bg-rose-50 text-rose-700 border-rose-100', dot: 'bg-rose-500' },
  'refund': { label: 'Refund', color: 'bg-orange-50 text-orange-700 border-orange-100', dot: 'bg-orange-500' },
  'tech_support': { label: 'Tech Support', color: 'bg-indigo-50 text-indigo-700 border-indigo-100', dot: 'bg-indigo-500' },
  'inquiry': { label: 'Inquiry', color: 'bg-blue-50 text-blue-700 border-blue-100', dot: 'bg-blue-500' },
  'feedback': { label: 'Feedback', color: 'bg-purple-50 text-purple-700 border-purple-100', dot: 'bg-purple-500' },
  'other': { label: 'Other', color: 'bg-slate-50 text-slate-700 border-slate-100', dot: 'bg-slate-500' },
} as const

export function SupportInboxClient({ userId, initialSessions, defaultSessionId }: SupportInboxClientProps) {
  const [sessions, setSessions] = useState(initialSessions)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(defaultSessionId || null)
  const [messages, setMessages] = useState<any[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [loadingMessages, setLoadingMessages] = useState(false)
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<'active' | 'resolved' | 'closed' | 'all'>('active')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  const supabase = createClient()
  const scrollRef = useRef<HTMLDivElement>(null)

  // If a default session ID is provided, ensure it's visible by showing all sessions
  useEffect(() => {
    if (defaultSessionId) {
      setStatusFilter('all')
    }
  }, [defaultSessionId])

  const selectedSession = sessions.find(s => s.id === selectedSessionId)

  const filteredSessions = sessions.filter(session => {
    // 1. Search Query Filter - matches name or email
    const searchMatch = !searchQuery || 
      session.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.customer_email?.toLowerCase().includes(searchQuery.toLowerCase())

    // 2. Status Filter
    let statusMatch = true
    if (statusFilter === 'active') {
      // Show open and escalated when active is selected
      statusMatch = session.status === 'open' || session.status === 'escalated'
    } else if (statusFilter !== 'all') {
      statusMatch = session.status === statusFilter
    }

    // 3. Category Filter
    let categoryMatch = true
    if (categoryFilter === 'uncategorized') {
      categoryMatch = !session.category
    } else if (categoryFilter !== 'all') {
      categoryMatch = session.category === categoryFilter
    }

    return searchMatch && statusMatch && categoryMatch
  })

  // Listen for realtime session updates
  useEffect(() => {
    const channel = supabase
      .channel('public:support_sessions')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'support_sessions',
        filter: `merchant_id=eq.${userId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setSessions(prev => [payload.new, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setSessions(prev => prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new } : s))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  // Fetch messages when a session is selected
  useEffect(() => {
    if (!selectedSessionId) return

    async function fetchMessages() {
      setLoadingMessages(true)
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('session_id', selectedSessionId)
        .order('created_at', { ascending: true })

      if (!error) setMessages(data || [])
      setLoadingMessages(false)
    }

    fetchMessages()

    // Subscribe to messages for this session
    const mChannel = supabase
      .channel(`support_messages:${selectedSessionId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'support_messages',
        filter: `session_id=eq.${selectedSessionId}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(mChannel)
    }
  }, [selectedSessionId])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!inputMessage.trim() || !selectedSessionId) return

    const { error } = await supabase.from('support_messages').insert({
      session_id: selectedSessionId,
      merchant_id: userId,
      role: 'merchant',
      content: inputMessage
    })

    if (!error) {
      setInputMessage('')
      // Also ensure AI handling is disabled when merchant sends a message
      if (selectedSession?.is_ai_handling) {
        await supabase
          .from('support_sessions')
          .update({ is_ai_handling: false })
          .eq('id', selectedSessionId)
      }
    }
  }

  async function toggleAiHandling() {
    if (!selectedSessionId || !selectedSession) return
    const newVal = !selectedSession.is_ai_handling
    const { error } = await supabase
      .from('support_sessions')
      .update({ is_ai_handling: newVal })
      .eq('id', selectedSessionId)
    
    if (!error) {
      setSessions(prev => prev.map(s => s.id === selectedSessionId ? { ...s, is_ai_handling: newVal } : s))
    }
  }

  async function updateSessionStatus(newStatus: 'resolved' | 'closed') {
    if (!selectedSessionId || !selectedSession) return
    
    // Update session status
    const { error: sessionError } = await supabase
      .from('support_sessions')
      .update({ status: newStatus })
      .eq('id', selectedSessionId)
    
    if (sessionError) {
      console.error('Error updating session status:', sessionError)
      return
    }

    // Resolve any linked escalations if session is resolved or closed
    await supabase
      .from('support_escalations')
      .update({ status: 'resolved' })
      .eq('session_id', selectedSessionId)
      .eq('status', 'pending')

    // Update local state and deselect if closed
    setSessions(prev => prev.map(s => s.id === selectedSessionId ? { ...s, status: newStatus } : s))
    if (newStatus === 'closed') {
      setSelectedSessionId(null)
    }
  }

  async function updateSessionCategory(category: string) {
    if (!selectedSessionId) return
    
    const { error } = await supabase
      .from('support_sessions')
      .update({ category })
      .eq('id', selectedSessionId)
    
    if (!error) {
      setSessions(prev => prev.map(s => s.id === selectedSessionId ? { ...s, category } : s))
    }
  }

  return (
    <div className="flex h-full bg-slate-50/50 backdrop-blur-sm overflow-hidden">
      {/* Sessions List */}
      <div className="flex flex-col w-80 bg-white/40 border-r border-slate-200/60 backdrop-blur-md overflow-hidden h-full shadow-inner">
        <div className="flex flex-col border-b border-slate-200/50 bg-white/80 sticky top-0 z-10 backdrop-blur-xl">
          <div className="p-4 pb-2">
            <div className="relative group">
              <Search className="absolute w-4 h-4 text-slate-400 left-3 top-3 group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="Search conversations..." 
                className="pl-9 h-10 bg-slate-100/50 border-none focus-visible:bg-white transition-all rounded-xl placeholder:text-slate-400" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="px-4 pb-4 space-y-2">
            <Tabs 
              value={statusFilter} 
              onValueChange={(v: any) => setStatusFilter(v)}
              className="w-full"
            >
              <TabsList className="grid grid-cols-4 h-9 p-1 bg-slate-100/80 rounded-xl">
                <TabsTrigger value="active" className="text-[10px] uppercase font-bold tracking-wider rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Active</TabsTrigger>
                <TabsTrigger value="resolved" className="text-[10px] uppercase font-bold tracking-wider rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Done</TabsTrigger>
                <TabsTrigger value="closed" className="text-[10px] uppercase font-bold tracking-wider rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Closed</TabsTrigger>
                <TabsTrigger value="all" className="text-[10px] uppercase font-bold tracking-wider rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">All</TabsTrigger>
              </TabsList>
            </Tabs>

            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v || 'all')}>
              <SelectTrigger className="h-8 text-[10px] uppercase tracking-wider font-bold bg-slate-50 border-none rounded-lg hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-2">
                  <Filter size={12} className="text-slate-500" />
                  <SelectValue placeholder="All Categories" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-2xl border-slate-200">
                <SelectItem value="all" className="text-xs font-medium">All Conversations</SelectItem>
                <SelectItem value="uncategorized" className="text-xs font-medium text-slate-500 italic">Uncategorized</SelectItem>
                {Object.entries(CATEGORIES).map(([key, { label }]) => (
                  <SelectItem key={key} value={key} className="text-xs font-semibold">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto h-full scrollbar-hide">
          {filteredSessions.length === 0 ? (
            <div className="p-12 text-sm text-center text-slate-400 opacity-80 flex flex-col items-center gap-4 py-20">
              <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300">
                <Search size={32} strokeWidth={1.5} />
              </div>
              <p className="font-medium">No results found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100/60">
              {filteredSessions.map((session: any) => (
                <div 
                  key={session.id}
                  onClick={() => setSelectedSessionId(session.id)}
                  className={cn(
                    "p-5 cursor-pointer relative transition-all duration-300",
                    selectedSessionId === session.id 
                      ? 'bg-primary/[0.03] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-primary' 
                      : 'hover:bg-slate-50/80 active:scale-[0.98]'
                  )}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {session.category && CATEGORIES[session.category as keyof typeof CATEGORIES] && (
                        <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", CATEGORIES[session.category as keyof typeof CATEGORIES].dot)} />
                      )}
                      <span className={cn("truncate text-sm tracking-tight", selectedSessionId === session.id ? "font-bold text-slate-900" : "font-semibold text-slate-700")}>
                        {session.customer_name || 'Anonymous'}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap uppercase tracking-widest">
                      {formatDistanceToNow(new Date(session.updated_at), { addSuffix: false })}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "h-4 text-[9px] px-1.5 uppercase font-black tracking-widest border-opacity-40",
                        session.status === 'escalated' ? "bg-rose-500 text-white border-none shadow-sm shadow-rose-200" : "bg-slate-100/50 text-slate-600"
                      )}
                    >
                      {session.status}
                    </Badge>
                    {session.is_ai_handling && (
                      <Badge variant="secondary" className="h-4 text-[9px] px-1.5 bg-blue-600 text-white border-none uppercase font-black tracking-widest shadow-sm shadow-blue-200 flex items-center gap-1">
                        <Bot size={8} strokeWidth={3} /> AI
                      </Badge>
                    )}
                    {session.category && (
                      <span className={cn("text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-widest border border-opacity-20", CATEGORIES[session.category as keyof typeof CATEGORIES]?.color)}>
                        {CATEGORIES[session.category as keyof typeof CATEGORIES]?.label}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Conversation Thread */}
      <div className="flex flex-col flex-1 bg-white/40 backdrop-blur-sm h-full relative">
        {selectedSessionId ? (
          <>
            <header className="flex items-center justify-between px-6 py-4 bg-white/80 border-b border-slate-200/50 backdrop-blur-xl sticky top-0 z-20">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="w-10 h-10 rounded-2xl border-2 border-white shadow-md ring-1 ring-slate-200/50">
                    <AvatarFallback className="bg-gradient-to-br from-slate-50 to-slate-100 text-slate-600 font-bold uppercase">
                      {selectedSession?.customer_name?.charAt(0) || <User size={20} />}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ring-1 ring-black/5",
                    selectedSession?.status === 'open' ? 'bg-emerald-500' : 
                    selectedSession?.status === 'escalated' ? 'bg-rose-500' : 'bg-slate-400'
                  )} />
                </div>
                <div>
                  <div className="text-base font-black text-slate-900 tracking-tight leading-none mb-1">
                    {selectedSession?.customer_name || 'Anonymous Customer'}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400 tracking-tight">
                      {selectedSession?.customer_email || 'No contact mail'}
                    </span>
                    {selectedSession?.category && (
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">• {CATEGORIES[selectedSession.category as keyof typeof CATEGORIES]?.label}</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={toggleAiHandling}
                  className={cn(
                    "h-9 rounded-xl gap-2 text-xs font-black uppercase tracking-widest transition-all",
                    selectedSession?.is_ai_handling 
                      ? "bg-amber-50 text-amber-600 hover:bg-amber-100" 
                      : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                  )}
                >
                  {selectedSession?.is_ai_handling ? (
                    <><ShieldAlert size={14} strokeWidth={2.5} /> Take Over</>
                  ) : (
                    <><Bot size={14} strokeWidth={2.5} /> AI Active</>
                  )}
                </Button>

                <div className="h-6 w-px bg-slate-200/50" />

                <DropdownMenu>
                  <DropdownMenuTrigger 
                    render={
                      <Button variant="ghost" size="sm" className="h-9 rounded-xl gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50">
                        <Tag size={14} strokeWidth={2.5} />
                        {selectedSession?.category ? CATEGORIES[selectedSession.category as keyof typeof CATEGORIES]?.label : 'Tag'}
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-2xl border-slate-200">
                    <div className="px-2 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Category</div>
                    {Object.entries(CATEGORIES).map(([key, { label, color }]) => (
                      <DropdownMenuItem 
                        key={key} 
                        onClick={() => updateSessionCategory(key)}
                        className="rounded-xl flex items-center justify-between px-3 py-2 cursor-pointer focus:bg-slate-50"
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full", CATEGORIES[key as keyof typeof CATEGORIES].dot)} />
                          <span className="text-sm font-bold text-slate-700">{label}</span>
                        </div>
                        {selectedSession?.category === key && <CheckCircle2 size={14} className="text-primary" strokeWidth={3} />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger 
                    render={
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-400 hover:bg-slate-50 outline-none">
                        <MoreVertical size={18} strokeWidth={2.5} />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-2xl border-slate-200">
                    <div className="px-2 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Update Status</div>
                    <DropdownMenuItem onClick={() => updateSessionStatus('resolved')} className="rounded-xl px-3 py-2 cursor-pointer font-bold text-slate-700 focus:bg-emerald-50 focus:text-emerald-700">
                      Mark as Resolved
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateSessionStatus('closed')} className="rounded-xl px-3 py-2 cursor-pointer font-bold text-rose-600 focus:bg-rose-50 focus:text-rose-700">
                      Close Session
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            <div 
              ref={scrollRef}
              className="flex-1 p-8 space-y-8 overflow-y-auto bg-gradient-to-b from-transparent to-slate-50/40 scroll-smooth h-full"
            >
              {loadingMessages ? (
                <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-700">
                   <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
                   <div className="text-sm font-black text-slate-400 uppercase tracking-widest">Syncing conversation...</div>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-30 text-slate-400 py-32">
                   <ShieldAlert size={48} strokeWidth={1} />
                   <p className="mt-4 font-bold uppercase tracking-widest text-xs">Waiting for first message</p>
                </div>
              ) : messages.map((m, idx) => (
                <div 
                  key={m.id || idx} 
                  className={cn(
                    "flex animate-in slide-in-from-bottom-2 duration-500",
                    m.role === 'customer' || m.role === 'user' ? 'justify-start' : 'justify-end'
                  )}
                >
                  <div className={cn(
                    "flex gap-4 max-w-[80%] group",
                    m.role === 'customer' || m.role === 'user' ? 'flex-row' : 'flex-row-reverse'
                  )}>
                    <Avatar className={cn(
                      "w-8 h-8 rounded-xl flex-shrink-0 mt-0.5 border shadow-sm transition-transform group-hover:scale-110",
                      m.role === 'assistant' ? 'border-blue-200 bg-blue-50' : m.role === 'merchant' ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-slate-50'
                    )}>
                      <AvatarFallback className="text-[10px] font-black uppercase">
                        {m.role === 'assistant' ? <Bot size={14} className="text-blue-600" /> : <User size={14} className={m.role === 'merchant' ? 'text-indigo-600' : 'text-slate-600'} />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                       <div className={cn(
                        "p-4 rounded-2xl text-[14px] leading-relaxed shadow-sm ring-1",
                        m.role === 'customer' || m.role === 'user' 
                          ? 'bg-white text-slate-800 ring-slate-100 rounded-tl-none' 
                          : m.role === 'assistant'
                            ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white ring-blue-500 rounded-tr-none shadow-blue-200/50'
                            : 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white ring-indigo-500 rounded-tr-none shadow-indigo-200/50'
                      )}>
                        {m.content}
                      </div>
                      <div className={cn(
                        "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400",
                        m.role === 'customer' || m.role === 'user' ? 'justify-start ml-0.5' : 'justify-end mr-0.5'
                      )}>
                        {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                        {m.role === 'assistant' && <span className="bg-blue-100 text-blue-600 px-1 rounded">AI</span>}
                        {m.role === 'merchant' && <span className="bg-indigo-100 text-indigo-600 px-1 rounded">Live</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <footer className="p-6 bg-white/80 backdrop-blur-xl border-t border-slate-200/50 sticky bottom-0 z-20">
              <form onSubmit={handleSendMessage} className="relative max-w-4xl mx-auto flex items-end gap-3 glass-container p-2 rounded-3xl bg-slate-100/60 ring-1 ring-slate-200/50 focus-within:ring-primary/40 focus-within:bg-white transition-all shadow-lg shadow-slate-100">
                <textarea 
                  placeholder={selectedSession?.is_ai_handling ? "Sending a message stops the AI assistant..." : "Message this customer..."}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-3 px-4 resize-none min-h-[48px] max-h-40 font-semibold"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e as any);
                    }
                  }}
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  className={cn(
                    "w-12 h-12 rounded-2xl flex-shrink-0 transition-all active:scale-95 shadow-xl",
                    inputMessage.trim() ? "bg-primary shadow-primary/30" : "bg-slate-300 pointer-events-none"
                  )}
                  disabled={!inputMessage.trim()}
                >
                  <Send size={20} strokeWidth={3} />
                </Button>
              </form>
            </footer>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 py-12 px-6 text-center animate-in fade-in zoom-in duration-700 h-full">
            <div className="relative mb-8">
               <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
               <div className="relative w-32 h-32 rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50 shadow-2xl flex items-center justify-center border-t border-slate-200 overflow-hidden ring-1 ring-slate-200/50">
                  <div className="absolute inset-0 bg-blue-500/5 mix-blend-overlay" />
                  <User size={64} className="text-slate-200" strokeWidth={1} />
               </div>
            </div>
            <div className="space-y-3 max-w-md">
              <h3 className="text-3xl font-black text-slate-800 tracking-tighter">Support Inbox</h3>
              <p className="text-base font-semibold text-slate-400 leading-relaxed">
                 Select a customer conversation from the list to view order details, message history, and take over from the AI assistant.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
