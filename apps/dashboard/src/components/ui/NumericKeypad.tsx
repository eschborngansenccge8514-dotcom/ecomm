'use client'

import React from 'react'
import { Delete, XCircle } from 'lucide-react'

interface NumericKeypadProps {
  onInput: (value: string) => void
  onDelete: () => void
  onClear: () => void
}

export function NumericKeypad({ onInput, onDelete, onClear }: NumericKeypadProps) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'DEL']

  const handleKeyClick = (key: string) => {
    if (key === 'C') {
      onClear()
    } else if (key === 'DEL') {
      onDelete()
    } else {
      onInput(key)
    }
  }

  return (
    <div className="grid grid-cols-3 gap-3 p-2">
      {keys.map((key) => {
        const isSpecial = key === 'C' || key === 'DEL'
        return (
          <button
            key={key}
            type="button"
            onClick={() => handleKeyClick(key)}
            className={`
              h-16 flex items-center justify-center rounded-2xl text-xl font-bold transition-all active:scale-95
              ${isSpecial 
                ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' 
                : 'bg-white border border-slate-100 shadow-sm text-slate-900 hover:border-indigo-200 hover:bg-indigo-50/30'
              }
            `}
          >
            {key === 'DEL' ? <Delete size={20} /> : key === 'C' ? <XCircle size={20} /> : key}
          </button>
        )
      })}
    </div>
  )
}
