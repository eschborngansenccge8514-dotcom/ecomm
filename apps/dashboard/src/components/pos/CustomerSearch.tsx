'use client'

import { useState, useEffect } from 'react'
import { Search, UserPlus, Phone, Mail, X, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePosCart, PosCartState } from '@/stores/pos-cart'
import { toast } from 'react-hot-toast'

interface CustomerSearchProps {
  isOpen: boolean
  onClose: () => void
}

export function CustomerSearch({ isOpen, onClose }: CustomerSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const setCustomer = usePosCart((s: PosCartState) => s.setCustomer)
  const currentCustomerId = usePosCart((s: PosCartState) => s.customerId)

  useEffect(() => {
    if (!query) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, email')
        .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(5)
      
      if (data) setResults(data)
      setIsSearching(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  if (!isOpen) return null

  const handleSelect = (customer: any) => {
    setCustomer(customer.id, customer.full_name, customer.phone)
    toast.success(`Customer linked: ${customer.full_name}`)
    onClose()
  }

  const handleClear = () => {
    setCustomer(undefined, undefined, undefined)
    toast.success('Customer removed from sale')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <UserPlus size={24} className="text-blue-500" />
            Customer Lookup
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={20} />
            <input 
              type="text"
              placeholder="Search by name, phone or email..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="w-full h-14 pl-12 pr-6 bg-slate-100 border-2 border-transparent focus:border-slate-900 focus:bg-white rounded-2xl font-bold text-slate-900 transition-all focus:outline-none"
            />
          </div>

          <div className="space-y-2 min-h-[300px]">
            {isSearching ? (
              <div className="flex flex-col items-center justify-center h-48 space-y-4 animate-pulse">
                <div className="w-10 h-10 bg-slate-100 rounded-full" />
                <div className="h-2 w-32 bg-slate-100 rounded" />
              </div>
            ) : results.length > 0 ? (
              results.map((c) => (
                <button 
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left group
                    ${currentCustomerId === c.id 
                      ? 'bg-blue-50 border-blue-200' 
                      : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-black group-hover:bg-slate-900 group-hover:text-white transition-all">
                      {c.full_name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm leading-tight">{c.full_name || 'No Name'}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest"><Phone size={10} /> {c.phone || '-'}</span>
                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest"><Mail size={10} /> {c.email?.slice(0, 10)}...</span>
                      </div>
                    </div>
                  </div>
                  {currentCustomerId === c.id && (
                    <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center">
                      <Check size={14} />
                    </div>
                  )}
                </button>
              ))
            ) : query ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 space-y-4">
                <Search size={40} className="opacity-20" />
                <p className="font-bold text-sm">No customers found</p>
                <button className="text-xs font-black text-blue-600 uppercase tracking-widest hover:underline"> Create New Customer </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 space-y-4">
                <UserPlus size={40} className="opacity-20" />
                <p className="font-bold text-sm">Start typing to search</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
           {currentCustomerId && (
             <button 
               onClick={handleClear}
               className="flex-1 h-14 rounded-2xl bg-white border border-red-200 text-red-600 font-bold hover:bg-red-50 transition-all shadow-sm"
             >
               Remove Customer
             </button>
           )}
           <button 
            onClick={onClose}
            className="flex-1 h-14 rounded-2xl bg-slate-900 text-white font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
