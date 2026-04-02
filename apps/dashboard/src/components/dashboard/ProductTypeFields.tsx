'use client'
import { useState } from 'react'
import { TYPE_PRODUCT_FIELDS, type StoreType } from '@/lib/store-types'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Props {
  storeType:  StoreType
  values:     Record<string, string>
  onChange:   (key: string, value: string) => void
}

export function ProductTypeFields({ storeType, values, onChange }: Props) {
  const fields = TYPE_PRODUCT_FIELDS[storeType]
  if (!fields || !fields.length) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h3 className="font-bold text-gray-900 mb-4">
        {['🍜','👗','📱','💄','🏠','🥦','🛠️','🛍️'][
          ['food','fashion','electronics','beauty','home','groceries','services','general'].indexOf(storeType)
        ]} {storeType.charAt(0).toUpperCase() + storeType.slice(1)} Details
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {fields.map(field => (
          <div key={field.key}>
            <label className="text-sm font-medium text-gray-700 block mb-1">{field.label}</label>

            {field.type === 'text' || field.type === 'number' ? (
              <Input type={field.type} value={values[field.key] ?? ''}
                onChange={e => onChange(field.key, e.target.value)} />
            ) : field.type === 'select' ? (
              <select value={values[field.key] ?? ''}
                onChange={e => onChange(field.key, e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="">Select…</option>
                {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : field.type === 'toggle' ? (
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => onChange(field.key, values[field.key] === 'true' ? 'false' : 'true')}
                  className={cn('w-10 h-5 rounded-full transition-colors',
                    values[field.key] === 'true' ? 'bg-blue-600' : 'bg-gray-200')}>
                  <div className={cn('w-4 h-4 rounded-full bg-white shadow mx-0.5 transition-transform',
                    values[field.key] === 'true' ? 'translate-x-5' : 'translate-x-0')} />
                </button>
                <span className="text-sm text-gray-600">
                  {values[field.key] === 'true' ? 'Yes' : 'No'}
                </span>
              </div>
            ) : field.type === 'tags' ? (
              <TagInput
                value={values[field.key] ? values[field.key].split(',').filter(Boolean) : []}
                onChange={tags => onChange(field.key, tags.join(','))}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Inline tag input ──────────────────────────────────────────────────────────
function TagInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('')

  const add = () => {
    const t = input.trim()
    if (t && !value.includes(t)) { onChange([...value, t]); setInput('') }
  }

  return (
    <div className="flex flex-wrap gap-1.5 border border-gray-200 rounded-xl p-2 min-h-[40px]">
      {value.map(tag => (
        <span key={tag} className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
          {tag}
          <button type="button" onClick={() => onChange(value.filter(t => t !== tag))}
            className="text-blue-400 hover:text-blue-700">×</button>
        </span>
      ))}
      <input value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }}
        placeholder="Type and press Enter…"
        className="flex-1 min-w-[80px] text-xs outline-none bg-transparent" />
    </div>
  )
}
