'use client'

import { useState, useTransition, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Trash2, 
  Pencil, 
  Eye, 
  EyeOff,
  LayoutGrid,
  Layers,
  Box,
  Image as ImageIcon
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { CategoryFormModal } from './CategoryFormModal'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'

export function CategoriesClient({ categories: initial, merchantId }: {
  categories: any[]; merchantId: string
}) {
  const [cats, setCats] = useState(initial)
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any>(null)
  const [isPending, startTransition] = useTransition()
  
  const supabase = createClient()
  const router = useRouter()

  const stats = useMemo(() => {
    return {
      total: cats.length,
      active: cats.filter(c => c.is_active !== false).length,
      totalProducts: cats.reduce((acc, curr) => acc + (curr.product_count?.[0]?.count || 0), 0)
    }
  }, [cats])

  const filteredCategories = useMemo(() => {
    return cats.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [cats, searchQuery])

  const handleSave = async (data: any) => {
    if (editingCategory) {
      const { data: updated, error } = await supabase
        .from('categories')
        .update({ ...data })
        .eq('id', editingCategory.id)
        .select('*, product_count:products(count)')
        .single()
      
      if (error) { toast.error(error.message); return }
      setCats(prev => prev.map(c => c.id === editingCategory.id ? updated : c))
      toast.success('Category updated')
    } else {
      const { data: inserted, error } = await supabase
        .from('categories')
        .insert({ 
          ...data, 
          merchant_id: merchantId, 
          sort_order: cats.length 
        })
        .select('*, product_count:products(count)')
        .single()
      
      if (error) { toast.error(error.message); return }
      setCats(prev => [...prev, inserted])
      toast.success('Category created')
    }
    setIsModalOpen(false)
    setEditingCategory(null)
  }

  const toggleStatus = async (category: any) => {
    const newStatus = !category.is_active
    
    // Optimistic update
    const previousCats = [...cats]
    setCats(prev => prev.map(c => c.id === category.id ? { ...c, is_active: newStatus } : c))
    
    const { error } = await supabase
      .from('categories')
      .update({ is_active: newStatus })
      .eq('id', category.id)
    
    if (error) {
      setCats(previousCats)
      toast.error(error.message)
      return
    }
    toast.success(`Category ${newStatus ? 'activated' : 'hidden'}`)
  }

  const handleDelete = async (category: any) => {
    const count = category.product_count?.[0]?.count ?? 0
    if (count > 0 && !confirm(`This category has ${count} products. They will become uncategorized. Continue?`)) return
    
    // Optimistic update
    const previousCats = [...cats]
    setCats(prev => prev.filter(c => c.id !== category.id))
    
    const { error } = await supabase.from('categories').delete().eq('id', category.id)
    if (error) {
      setCats(previousCats)
      toast.error(error.message)
      return
    }
    toast.success('Category deleted')
  }

  return (
    <div className="space-y-8">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4 flex-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
              <Layers size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
              <p className="text-sm text-gray-500 font-medium">Manage how your customers discover products</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-white px-5 py-3 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total</span>
              <span className="text-xl font-bold text-gray-900">{stats.total}</span>
            </div>
            <div className="bg-white px-5 py-3 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Active</span>
              <span className="text-xl font-bold text-blue-600">{stats.active}</span>
            </div>
            <div className="bg-white px-5 py-3 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Products</span>
              <span className="text-xl font-bold text-emerald-600">{stats.totalProducts}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <Input 
              placeholder="Search categories..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-12 w-full md:w-64 rounded-2xl border-gray-100 bg-white focus:ring-2 focus:ring-blue-500/10 transition-all text-sm"
            />
          </div>
          <Button 
            onClick={() => { setEditingCategory(null); setIsModalOpen(true) }}
            className="h-12 rounded-2xl px-6 bg-gray-900 hover:bg-black text-white font-bold transition-all shadow-lg shadow-gray-200"
          >
            <Plus size={18} className="mr-2" />
            Add New
          </Button>
        </div>
      </div>

      {/* Grid */}
      {filteredCategories.length === 0 ? (
        <div className="bg-white rounded-[32px] border border-dashed border-gray-200 py-24 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4">
            <LayoutGrid size={40} />
          </div>
          <h3 className="text-lg font-bold text-gray-900">No categories found</h3>
          <p className="text-gray-500 max-w-xs mt-2 text-sm font-medium">
            {searchQuery 
              ? `We couldn't find any category matching "${searchQuery}"`
              : "Group your products into categories like 'Main Course' or 'Drinks' to help customers browse."}
          </p>
          {!searchQuery && (
            <Button 
              variant="outline" 
              onClick={() => setIsModalOpen(true)}
              className="mt-6 rounded-xl border-gray-200 h-11 px-6 font-bold"
            >
              Get Started
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCategories.map((cat) => {
            const count = cat.product_count?.[0]?.count ?? 0
            const isActive = cat.is_active !== false

            return (
              <div 
                key={cat.id}
                className={cn(
                  "group relative bg-white rounded-[32px] border transition-all duration-300 hover:shadow-2xl hover:shadow-gray-200/50 p-6 flex flex-col gap-5",
                  !isActive ? "border-gray-100 opacity-75" : "border-gray-100 hover:border-blue-100"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="w-14 h-14 bg-gray-50 rounded-2xl overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform duration-300 border border-gray-50">
                    {cat.image_url ? (
                      <div className="relative w-full h-full">
                        <Image src={cat.image_url} alt={cat.name} fill className="object-cover" />
                      </div>
                    ) : (
                      <ImageIcon className="text-gray-300" size={24} />
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => toggleStatus(cat)}
                      className={cn(
                        "p-2.5 rounded-xl transition-all",
                        isActive 
                          ? "text-blue-600 bg-blue-50 hover:bg-blue-100" 
                          : "text-gray-400 bg-gray-50 hover:bg-gray-100"
                      )}
                      title={isActive ? "Hide Category" : "Show Category"}
                    >
                      {isActive ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), "h-10 w-10 rounded-xl hover:bg-gray-50")}>
                            <MoreVertical size={18} className="text-gray-400" />
                          </button>
                        }
                      />
                      <DropdownMenuContent align="end" className="rounded-xl border-gray-100 p-1.5 min-w-[140px] shadow-xl">
                        <DropdownMenuItem 
                          onClick={() => { setEditingCategory(cat); setIsModalOpen(true) }}
                          className="rounded-lg gap-2 font-medium cursor-pointer"
                        >
                          <Pencil size={15} /> Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(cat)}
                          className="rounded-lg gap-2 font-medium cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                        >
                          <Trash2 size={15} /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 text-lg group-hover:text-blue-600 transition-colors">
                    {cat.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="rounded-lg border-gray-100 bg-gray-50/50 text-gray-500 font-bold px-2 py-0.5 text-[10px] tracking-tight">
                      {count} PRODUCTS
                    </Badge>
                    {!isActive && (
                      <Badge className="rounded-lg bg-gray-100 text-gray-500 font-bold px-2 py-0.5 text-[10px] tracking-tight">
                        HIDDEN
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                  <Button 
                    variant="ghost" 
                    className="h-9 rounded-xl text-xs font-bold text-gray-500 hover:text-blue-600 hover:bg-blue-50 px-3"
                    onClick={() => router.push(`/products?category=${cat.id}`)}
                  >
                    View Products
                  </Button>
                  <span className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">
                    ID: {cat.id.slice(0, 8)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <CategoryFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        category={editingCategory}
      />
    </div>
  )
}

