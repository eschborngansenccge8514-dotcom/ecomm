'use client'
import { useState, useCallback } from 'react'
import { Upload, X, Check, Image as ImageIcon, Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

interface ImageFile {
  id:       string
  url:      string
  name:     string
  isPrimary: boolean
  progress:  number
  status:    'uploading' | 'complete' | 'error'
}

interface MultiImageUploadProps {
  value: string[]
  onChange: (urls: string[]) => void
  onPrimaryChange?: (url: string) => void
  maxImages?: number
  bucket?: string
  path?: string
}

export function MultiImageUpload({
  value = [],
  onChange,
  onPrimaryChange,
  maxImages = 5,
  bucket = 'product-images',
  path = 'uploads'
}: MultiImageUploadProps) {
  const supabase = createClient()
  const [images, setImages] = useState<ImageFile[]>(
    value.map((url, i) => ({
      id: Math.random().toString(36).substr(2, 9),
      url,
      name: url.split('/').pop() || '',
      isPrimary: i === 0,
      progress: 100,
      status: 'complete'
    }))
  )

  const uploadFile = async (file: File) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newImage: ImageFile = {
      id,
      url: URL.createObjectURL(file),
      name: file.name,
      isPrimary: images.length === 0,
      progress: 0,
      status: 'uploading'
    }

    setImages(prev => [...prev, newImage])

    try {
      const fileName = `${path}/${Date.now()}-${file.name}`
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path)

      setImages(prev => prev.map(img =>
        img.id === id ? { ...img, url: publicUrl, status: 'complete', progress: 100 } : img
      ))

      const updatedUrls = [...images.filter(i => i.status === 'complete').map(i => i.url), publicUrl]
      onChange(updatedUrls)
      if (newImage.isPrimary) onPrimaryChange?.(publicUrl)

    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`)
      setImages(prev => prev.filter(img => img.id !== id))
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    if (images.length + files.length > maxImages) {
      toast.error(`You can only upload up to ${maxImages} images`)
      return
    }
    files.forEach(uploadFile)
  }, [images, maxImages])

  const removeImage = (id: string) => {
    const imgToRemove = images.find(i => i.id === id)
    const newImages = images.filter(i => i.id !== id)
    setImages(newImages)
    onChange(newImages.filter(i => i.status === 'complete').map(img => img.url))
    if (imgToRemove?.isPrimary && newImages.length > 0) {
      newImages[0].isPrimary = true
      onPrimaryChange?.(newImages[0].url)
    }
  }

  const setPrimary = (id: string) => {
    const newImages = images.map(img => ({
      ...img,
      isPrimary: img.id === id
    }))
    setImages(newImages)
    const primaryUrl = newImages.find(i => i.id === id)?.url
    if (primaryUrl) onPrimaryChange?.(primaryUrl)
  }

  return (
    <div className="space-y-4 w-full">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {images.map((img) => (
          <div key={img.id} className={cn(
            "relative group aspect-square rounded-2xl overflow-hidden border-2 transition-all",
            img.isPrimary ? "border-blue-500 shadow-md" : "border-gray-100 hover:border-gray-300"
          )}>
            <img src={img.url} alt={img.name} className="w-full h-full object-cover" />

            {/* Overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              {!img.isPrimary && img.status === 'complete' && (
                <button onClick={() => setPrimary(img.id)} className="p-2 bg-white rounded-full text-blue-600 hover:scale-110 transition-transform">
                  <Check size={16} />
                </button>
              )}
              <button onClick={() => removeImage(img.id)} className="p-2 bg-white rounded-full text-red-600 hover:scale-110 transition-transform">
                <X size={16} />
              </button>
            </div>

            {/* Status indicators */}
            {img.isPrimary && (
              <div className="absolute top-2 left-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                PRIMARY
              </div>
            )}

            {img.status === 'uploading' && (
              <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center p-4">
                <Loader2 size={24} className="text-blue-500 animate-spin mb-2" />
                <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${img.progress}%` }} />
                </div>
              </div>
            )}
          </div>
        ))}

        {images.length < maxImages && (
          <label onDragOver={(e) => e.preventDefault()} onDrop={onDrop}
            className="aspect-square rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all group">
            <input type="file" className="hidden" multiple accept="image/*"
              onChange={(e) => Array.from(e.target.files || []).forEach(uploadFile)} />
            <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center mb-2 group-hover:scale-110 transition-transform border border-gray-100">
              <Plus size={20} className="text-gray-400 group-hover:text-blue-500" />
            </div>
            <span className="text-xs font-medium text-gray-500 group-hover:text-blue-600">Add Images</span>
            <span className="text-[10px] text-gray-400 mt-1">{images.length}/{maxImages} max</span>
          </label>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-400">
        <ImageIcon size={12} />
        Supports JPG, PNG, WebP up to 5MB each. Drag & drop multiple files.
      </div>
    </div>
  )
}
