'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { usePosCart } from '@/stores/pos-cart'
import { fetchPosProducts, getOrInitializeSession } from '@/lib/pos-actions'
import { PosProduct } from '@project1/domain'
import { ProductGrid } from '@/components/pos/ProductGrid'
import { CartPanel } from '@/components/pos/CartPanel'
import { SearchBar } from '@/components/pos/SearchBar'
import { ActionHeader } from '@/components/pos/ActionHeader'
import { StartSessionModal } from '@/components/pos/StartSessionModal'

import { toast } from 'react-hot-toast'
import { useShallow } from 'zustand/react/shallow'
import { usePosOffline } from '@/stores/pos-offline'

export default function PosPage() {
  const router = useRouter()
  const [products, setProducts] = useState<PosProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [isStartSessionOpen, setIsStartSessionOpen] = useState(false)
  const [sessionInfo, setSessionInfo] = useState<{
    outletId?: string,
    sessionId?: string,
    outletName?: string,
    userName?: string,
    merchantName?: string,
    sessionRequired?: boolean
  }>({})

  
  const { setSession, setTaxRate, addItem } = usePosCart(
    useShallow((s) => ({
      setSession: s.setSession,
      setTaxRate: s.setTaxRate,
      addItem: s.addItem
    }))
  )

  const { cachedProducts, cachedSession, setCachedData, isOfflineMode } = usePosOffline()
  
  useEffect(() => {
    async function init() {
      const isActuallyOffline = isOfflineMode || (typeof navigator !== 'undefined' && !navigator.onLine)

      try {
        if (isActuallyOffline) {
          throw new Error('OFFLINE_MODE')
        }

        // Try to get fresh session info
        const info = await getOrInitializeSession(false)
        
        setSessionInfo({
          outletId: info.outletId,
          sessionId: info.sessionId,
          outletName: info.outletName,
          userName: info.userName,
          merchantName: info.merchantName,
          sessionRequired: info.sessionRequired
        })

        if (info.sessionRequired) {
          setIsStartSessionOpen(true)
        } else if (info.sessionId) {
          setSession(info.outletId, info.sessionId)
          setTaxRate(info.taxRate)
          
          // Try to get fresh products
          const data = await fetchPosProducts(info.outletId)
          setProducts(data)

          // Update cache for next offline use
          setCachedData(data, info)
        }

      } catch (err: any) {
        if (err?.message !== 'OFFLINE_MODE') {
          console.error('POS Init Error:', err)
        }
        
        // Avoid stale closures from the first mount by reading the latest state
        const state = usePosOffline.getState()
        
        // Fallback to cache if available
        if (state.cachedSession && state.cachedProducts.length > 0) {
          toast.success('Running in Offline Mode (Cached Data)', { icon: '📶' })
          
          setSession(state.cachedSession.outletId, state.cachedSession.sessionId)
          setTaxRate(state.cachedSession.taxRate)
          setSessionInfo({
            outletId: state.cachedSession.outletId,
            sessionId: state.cachedSession.sessionId,
            outletName: state.cachedSession.outletName,
            userName: state.cachedSession.userName,
            merchantName: state.cachedSession.merchantName
          })
          setProducts(state.cachedProducts)
        } else {
          toast.error('Failed to initialize POS. Please check your connection.')
        }
      } finally {
        setIsLoading(false)
      }
    }
    init()

    // Prefetch checkout page to ensure it's available offline
    router.prefetch('/pos/checkout')
  }, [setSession, router])

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean))
    return ['All', ...Array.from(cats)].sort()
  }, [products])

  const filteredProducts = products.filter((p) => {
    const matchesSearch = (p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.barcode?.includes(searchQuery) ||
                          p.sku?.toLowerCase().includes(searchQuery.toLowerCase())) ?? false
    const matchesCategory = category === 'All' || p.category === category
    return matchesSearch && matchesCategory
  })

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <ActionHeader 
        outletId={sessionInfo.outletId}
        sessionId={sessionInfo.sessionId}
        outletName={sessionInfo.outletName}
        userName={sessionInfo.userName}
        merchantName={sessionInfo.merchantName}
        onStartSession={() => setIsStartSessionOpen(true)}
      />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Products */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200">
          <div className="p-4 bg-white border-b border-slate-200 space-y-4">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap
                    ${category === cat 
                      ? 'bg-slate-900 text-white' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-pulse">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="aspect-square bg-slate-200 rounded-2xl" />
                ))}
              </div>
            ) : (
              <ProductGrid products={filteredProducts} onSelect={addItem} />
            )}
          </div>
        </div>

        {/* Right Side: Cart */}
        <div className="w-[400px] xl:w-[450px] bg-white flex flex-col shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
          <CartPanel />
        </div>
      </div>
      <StartSessionModal 
        isOpen={isStartSessionOpen} 
        outletId={sessionInfo.outletId || ''} 
        onSuccess={(sid) => {
          setIsStartSessionOpen(false);
          window.location.reload(); 
        }}
        onClose={() => setIsStartSessionOpen(false)}
      />
    </div>

  )
}
