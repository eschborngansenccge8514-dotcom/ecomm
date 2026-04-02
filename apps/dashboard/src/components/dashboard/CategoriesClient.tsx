'use client'
import { useState }     from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button }       from '@/components/ui/button'
import { Input }        from '@/components/ui/input'
import toast            from 'react-hot-toast'
import { Plus, GripVertical, Pencil, Trash2, Check, X } from 'lucide-react'

export function CategoriesClient({ categories: initial, merchantId }: {
  categories: any[]; merchantId: string
}) {
  const [cats, setCats]       = useState(initial)
  const [adding, setAdding]   = useState(false)
  const [newName, setNewName] = useState('')
  const [editId, setEditId]   = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const supabase = createClient()

  const handleAdd = async () => {
    if (!newName.trim()) return
    const { data, error } = await supabase
      .from('categories')
      .insert({ name: newName.trim(), merchant_id: merchantId, sort_order: cats.length })
      .select('*, product_count:products(count)').single()
    if (error) { toast.error(error.message); return }
    setCats(prev => [...prev, data])
    setNewName('')
    setAdding(false)
    toast.success('Category added')
  }

  const handleEdit = async (id: string) => {
    if (!editName.trim()) return
    const { error } = await supabase.from('categories').update({ name: editName.trim() }).eq('id', id)
    if (error) { toast.error(error.message); return }
    setCats(prev => prev.map(c => c.id === id ? { ...c, name: editName } : c))
    setEditId(null)
    toast.success('Category updated')
  }

  const handleDelete = async (cat: any) => {
    const count = cat.product_count?.[0]?.count ?? 0
    if (count > 0 && !confirm(`This category has ${count} products. They will become uncategorized. Continue?`)) return
    const { error } = await supabase.from('categories').delete().eq('id', cat.id)
    if (error) { toast.error(error.message); return }
    setCats(prev => prev.filter(c => c.id !== cat.id))
    toast.success('Category deleted')
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-900">Product Categories</h2>
        <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus size={14} className="mr-1" /> Add Category
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {adding && (
          <div className="flex items-center gap-2 p-4 border-b border-gray-50">
            <Input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Category name..." onKeyDown={e => { if (e.key === 'Enter') handleAdd() }} />
            <Button size="sm" onClick={handleAdd}><Check size={15} /></Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewName('') }}>
              <X size={15} />
            </Button>
          </div>
        )}

        {cats.length === 0 && !adding ? (
          <p className="text-center text-gray-400 py-12 text-sm">No categories yet</p>
        ) : (
          <ul>
            {cats.map((cat, idx) => (
              <li key={cat.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                <GripVertical size={16} className="text-gray-300 shrink-0" />
                {editId === cat.id ? (
                  <>
                    <Input autoFocus value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="flex-1 h-8"
                      onKeyDown={e => { if (e.key === 'Enter') handleEdit(cat.id) }} />
                    <button onClick={() => handleEdit(cat.id)} className="text-green-600 hover:text-green-700">
                      <Check size={16} />
                    </button>
                    <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-gray-800">{cat.name}</span>
                    <span className="text-xs text-gray-400">
                      {cat.product_count?.[0]?.count ?? 0} products
                    </span>
                    <button onClick={() => { setEditId(cat.id); setEditName(cat.name) }}
                      className="text-gray-400 hover:text-blue-600 transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(cat)}
                      className="text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Categories appear in the customer app to filter products.
        Products without a category are shown under "All".
      </p>
    </div>
  )
}
