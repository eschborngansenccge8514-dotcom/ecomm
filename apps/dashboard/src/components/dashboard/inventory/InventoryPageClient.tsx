'use client'

import React, { useState, useEffect } from 'react'
import { 
  BarChart2, 
  ChevronDown, 
  ChevronUp, 
  Zap, 
  Package,
  Plus,
  Search
} from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ProductsClient } from '@/components/dashboard/ProductsClient'
import { ProductFormModal } from '@/components/dashboard/ProductFormModal'
import { CategorySidebar } from './CategorySidebar'
import { InventoryStatsHeader } from './InventoryStatsHeader'
import type { StoreType } from '@/lib/store-types'

// Dynamic import for Recharts
const AreaChart = dynamic(() => import('recharts').then(mod => mod.AreaChart), { ssr: false })
const Area = dynamic(() => import('recharts').then(mod => mod.Area), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false })

interface Props {
  products: any[]
  categories: any[]
  merchantId: string
  storeType: StoreType
  inventoryData: any
}

export function InventoryPageClient({ 
  products: initialProducts, 
  categories: initialCategories, 
  merchantId, 
  storeType, 
  inventoryData 
}: Props) {
  const router = useRouter()
  const [categories, setCategories] = useState(initialCategories)
  const [products, setProducts] = useState(initialProducts)
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [showInsights, setShowInsights] = useState(false)
  const [showProductForm, setShowProductForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)

  useEffect(() => {
    setProducts(initialProducts)
  }, [initialProducts])

  const handleProductSaved = (saved: any, isNew: boolean) => {
    if (isNew) {
      setProducts(prev => [saved, ...prev])
    } else {
      setProducts(prev => prev.map(p => p.id === saved.id ? saved : p))
    }
    setShowProductForm(false)
    setEditingProduct(null)
    router.refresh()
  }

  return (
    <div className="flex flex-col h-full space-y-6 max-w-[1600px] mx-auto pb-10">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tightest">Inventory <span className="text-blue-600">Hub</span></h1>
          <p className="text-slate-500 font-medium mt-1">Real-time stock monitoring and multi-channel fulfillment center.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => setShowInsights(!showInsights)}
            className="rounded-xl border-gray-200 font-bold gap-2 text-gray-600 hover:text-blue-600 hover:border-blue-100 hover:bg-blue-50 transition-all"
          >
            <BarChart2 size={18} />
            {showInsights ? 'Hide Insights' : 'Show Insights'}
          </Button>
          <Button 
            onClick={() => { setEditingProduct(null); setShowProductForm(true) }}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
          >
            <Plus size={18} />
            Add Product
          </Button>
          <Link 
            href="/inventory/reorder"
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
          >
            <Zap size={18} />
            Reorder Help
          </Link>
        </div>
      </div>

      {/* Stats Header */}
      <InventoryStatsHeader data={inventoryData} />

      {/* Insights Section (Collapsible) */}
      {showInsights && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-4 duration-500">
          <Card className="lg:col-span-2 border-none shadow-sm rounded-3xl overflow-hidden bg-white/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold">Stock Movements</CardTitle>
              <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5 text-emerald-600">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  Stock In
                </div>
                <div className="flex items-center gap-1.5 text-red-600">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  Stock Out
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={inventoryData.daily_movements}>
                    <defs>
                      <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="stock_in" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorIn)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="stock_out" 
                      stroke="#ef4444" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorOut)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Top Movers</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-50 max-h-[300px] overflow-y-auto custom-scrollbar">
                {inventoryData.top_movers.length > 0 ? inventoryData.top_movers.map((mover: any, i: number) => (
                  <div key={i} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-black text-xs">
                        {i + 1}
                      </div>
                      <span className="text-sm text-gray-900 font-bold truncate max-w-[150px]">{mover.name}</span>
                    </div>
                    <span className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl">
                      {mover.volume} SOLD
                    </span>
                  </div>
                )) : (
                  <div className="p-10 text-center text-gray-400 text-sm font-medium italic">No sales data available</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Unified Workspace */}
      <div className="flex flex-1 gap-6 min-h-[600px] overflow-hidden">
        {/* Left Sidebar: Categories */}
        <div className="w-72 shrink-0 h-full overflow-y-auto no-scrollbar">
          <CategorySidebar 
            categories={categories}
            activeCategoryId={activeCategoryId}
            onCategorySelect={setActiveCategoryId}
            merchantId={merchantId}
            onCategoriesChange={setCategories}
          />
        </div>

        {/* Right Main Content: Products */}
        <div className="flex-1 bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <ProductsClient 
            products={products}
            categories={categories}
            merchantId={merchantId}
            storeType={storeType}
            activeCategoryId={activeCategoryId ?? 'all'}
            hideHeader={true}
          />
        </div>
      </div>

      {/* Modals */}
      {showProductForm && (
        <ProductFormModal
          merchantId={merchantId}
          categories={categories}
          product={editingProduct}
          storeType={storeType}
          onClose={() => { setShowProductForm(false); setEditingProduct(null) }}
          onSaved={handleProductSaved}
        />
      )}
    </div>
  )
}
