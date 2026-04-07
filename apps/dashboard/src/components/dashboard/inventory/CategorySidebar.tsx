'use client'

import React, { useState } from 'react'
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Trash2, 
  Pencil, 
  Eye, 
  EyeOff,
  Layers,
  Image as ImageIcon,
  ChevronRight
} from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { CategoryFormModal } from '../CategoryFormModal'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface Props {
  categories: any[]
  activeCategoryId: string | null
  onCategorySelect: (id: string | null) => void
  merchantId: string
  onCategoriesChange: (updated: any[]) => void
}

export function CategorySidebar({ 
  categories, 
  activeCategoryId, 
  onCategorySelect, 
  merchantId, 
  onCategoriesChange 
}: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any>(null)
  
  const supabase = createClient()

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSave = async (data: any) => {
    if (editingCategory) {
      const { data: updated, error } = await supabase
        .from('categories')
        .update({ ...data })
        .eq('id', editingCategory.id)
        .select('*, product_count:products(count)')
        .single()
      
      if (error) { toast.error(error.message); return }
      onCategoriesChange(categories.map(c => c.id === editingCategory.id ? updated : c))
      toast.success('Category updated')
    } else {
      const { data: inserted, error } = await supabase
        .from('categories')
        .insert({ 
          ...data, 
          merchant_id: merchantId, 
          sort_order: categories.length 
        })
        .select('*, product_count:products(count)')
        .single()
      
      if (error) { toast.error(error.message); return }
      onCategoriesChange([...categories, inserted])
      toast.success('Category created')
    }
    setIsModalOpen(false)
    setEditingCategory(null)
  }

  const toggleStatus = async (category: any) => {
    const newStatus = !category.is_active
    const previousCats = [...categories]
    onCategoriesChange(categories.map(c => c.id === category.id ? { ...c, is_active: newStatus } : c))
    
    const { error } = await supabase
      .from('categories')
      .update({ is_active: newStatus })
      .eq('id', category.id)
    
    if (error) {
      onCategoriesChange(previousCats)
      toast.error(error.message)
      return
    }
  }

  const handleDelete = async (category: any) => {
    const count = category.product_count?.[0]?.count ?? 0
    if (count > 0 && !confirm(`This category has ${count} products. Continue?`)) return
    
    const previousCats = [...categories]
    onCategoriesChange(categories.filter(c => c.id !== category.id))
    
    const { error } = await supabase.from('categories').delete().eq('id', category.id)
    if (error) {
      onCategoriesChange(previousCats)
      toast.error(error.message)
      return
    }
    toast.success('Category deleted')
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-gray-50 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-900">
            <Layers size={18} className="text-blue-600" />
            <span className="font-bold text-sm">Categories</span>
          </div>
          <button 
            onClick={() => { setEditingCategory(null); setIsModalOpen(true) }}
            className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
          >
            <Plus size={18} />
          </button>
        </div>
        
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={14} />
          <Input 
            placeholder="Search..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl border-gray-100 bg-gray-50/50 focus:bg-white"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        <button
          onClick={() => onCategorySelect(null)}
          className={cn(
            "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all group",
            activeCategoryId === null 
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
              : "text-gray-500 hover:bg-gray-50"
          )}
        >
          <div className="flex items-center gap-2">
            <LayoutGrid size={16} />
            <span>All Products</span>
          </div>
          {activeCategoryId === null && <ChevronRight size={14} />}
        </button>

        <div className="h-px bg-gray-50 my-2 mx-2" />

        {filteredCategories.map((cat) => {
          const isActive = cat.is_active !== false
          const isSelected = activeCategoryId === cat.id
          const count = cat.product_count?.[0]?.count ?? 0

          return (
            <div key={cat.id} className="relative group">
              <button
                onClick={() => onCategorySelect(cat.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all",
                  isSelected 
                    ? "bg-blue-50 text-blue-600 ring-1 ring-blue-100" 
                    : "text-gray-600 hover:bg-gray-50",
                  !isActive && "opacity-60"
                )}
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
                  {cat.image_url ? (
                    <div className="relative w-full h-full">
                      <Image src={cat.image_url} alt="" fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-300">
                      <ImageIcon size={14} />
                    </div>
                  )}
                </div>
                <div className="flex-1 text-left truncate">
                  <p className={cn("truncate", isSelected ? "font-bold text-blue-700" : "font-semibold")}>
                    {cat.name}
                  </p>
                  <p className="text-[10px] text-gray-400 font-medium">{count} items</p>
                </div>
              </button>

              <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 cursor-pointer border-none bg-transparent outline-none">
                        <MoreVertical size={14} />
                      </button>
                    }
                  />
                  <DropdownMenuContent align="end" className="rounded-xl p-1 min-w-[120px]">
                    <DropdownMenuItem 
                      onClick={() => { setEditingCategory(cat); setIsModalOpen(true) }}
                      className="text-xs gap-2"
                    >
                      <Pencil size={12} /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => toggleStatus(cat)}
                      className="text-xs gap-2"
                    >
                      {isActive ? <EyeOff size={12} /> : <Eye size={12} />}
                      {isActive ? 'Hide' : 'Show'}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDelete(cat)}
                      className="text-xs gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                    >
                      <Trash2 size={12} /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )
        })}
      </div>

      {isModalOpen && (
        <CategoryFormModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          category={editingCategory}
        />
      )}
    </div>
  )
}

function LayoutGrid({ size }: { size: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}
