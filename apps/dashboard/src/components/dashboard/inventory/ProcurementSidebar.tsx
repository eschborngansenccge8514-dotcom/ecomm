'use client'

import React from 'react'
import { 
  ShoppingCart, 
  FileCheck, 
  Truck, 
  ChevronRight,
  Briefcase,
  CreditCard
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  activeTab: string
  onTabSelect: (tab: string) => void
  counts: {
    orders: number
    receipts: number
    suppliers: number
    payments: number
  }
}

export function ProcurementSidebar({ 
  activeTab, 
  onTabSelect, 
  counts 
}: Props) {
  const menuItems = [
    { 
      id: 'orders', 
      label: 'Purchase Orders', 
      icon: ShoppingCart, 
      count: counts.orders,
      description: 'Manage procurement'
    },
    { 
      id: 'receipts', 
      label: 'Goods Receipts', 
      icon: FileCheck, 
      count: counts.receipts,
      description: 'Inventory intake'
    },
    { 
      id: 'payments', 
      label: 'Payments', 
      icon: CreditCard, 
      count: counts.payments,
      description: 'Vendor settlements'
    },
    { 
      id: 'suppliers', 
      label: 'Suppliers', 
      icon: Truck, 
      count: counts.suppliers,
      description: 'Vendor directory'
    }
  ]

  return (
    <div className="flex flex-col h-full bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden min-h-[500px]">
      <div className="p-5 border-b border-gray-50 space-y-4">
        <div className="flex items-center gap-2 text-gray-900">
          <div className="p-1.5 bg-blue-50 rounded-lg">
            <Briefcase size={18} className="text-blue-600" />
          </div>
          <span className="font-bold text-sm tracking-tight">Procurement</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {menuItems.map((item) => {
          const isSelected = activeTab === item.id
          const Icon = item.icon

          return (
            <button
              key={item.id}
              onClick={() => onTabSelect(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs transition-all group",
                isSelected 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                  : "text-gray-500 hover:bg-gray-50"
              )}
            >
              <div className={cn(
                "p-2 rounded-lg shrink-0 transition-colors",
                isSelected ? "bg-white/20" : "bg-gray-100 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600"
              )}>
                <Icon size={16} />
              </div>
              
              <div className="flex-1 text-left truncate">
                <p className={cn("truncate font-bold", isSelected ? "text-white" : "text-gray-900")}>
                  {item.label}
                </p>
                <p className={cn("text-[10px] font-medium", isSelected ? "text-blue-100" : "text-gray-400")}>
                  {item.count} {item.id === 'suppliers' ? 'Vendors' : 'Entries'}
                </p>
              </div>

              {isSelected && <ChevronRight size={14} className="text-white/70" />}
            </button>
          )
        })}
      </div>

      <div className="p-4 bg-gray-50/50 mt-auto border-t border-gray-50">
        <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Procurement Tip</p>
          <p className="text-[10px] text-blue-700 mt-1 font-medium leading-relaxed">
            Consolidate orders from the same supplier to reduce shipping costs.
          </p>
        </div>
      </div>
    </div>
  )
}
