'use client'

import { Search, X } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative group">
      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-slate-900 transition-colors">
        <Search size={22} className="stroke-[2.5]" />
      </div>
      <input
        type="text"
        placeholder="Search product, SKU or scan barcode..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-14 pl-12 pr-12 bg-slate-100 border-none rounded-2xl text-lg font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all"
        autoFocus
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-slate-900 transition-colors"
        >
          <X size={20} className="stroke-[2.5]" />
        </button>
      )}
    </div>
  )
}
