'use client'

import { useState, useEffect } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

interface CategoryFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: { name: string; image_url?: string; is_active?: boolean }) => Promise<void>
  category?: any
}

export function CategoryFormModal({ 
  isOpen, 
  onClose, 
  onSave, 
  category 
}: CategoryFormModalProps) {
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (category) {
      setName(category.name || '')
      setImageUrl(category.image_url || '')
    } else {
      setName('')
      setImageUrl('')
    }
  }, [category, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    try {
      await onSave({ 
        name: name.trim(), 
        image_url: imageUrl.trim() || undefined 
      })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] rounded-[24px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {category ? 'Edit Category' : 'Add New Category'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-semibold text-gray-700">
              Category Name
            </Label>
            <Input
              id="name"
              placeholder="e.g. Main Course, Drinks, Starters"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 rounded-xl border-gray-100 bg-gray-50/50 focus:bg-white transition-all shadow-none"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image_url" className="text-sm font-semibold text-gray-700">
              Cover Image URL (Optional)
            </Label>
            <Input
              id="image_url"
              placeholder="https://..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="h-12 rounded-xl border-gray-100 bg-gray-50/50 focus:bg-white transition-all shadow-none"
            />
            <p className="text-[11px] text-gray-400 px-1">
              Provide a direct link to an image to represent this category.
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={onClose}
              className="rounded-xl h-12 px-6 font-semibold"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !name.trim()}
              className="rounded-xl h-12 px-8 font-bold bg-gray-900 hover:bg-black text-white transition-all shadow-lg shadow-gray-200 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : category ? 'Save Changes' : 'Create Category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
