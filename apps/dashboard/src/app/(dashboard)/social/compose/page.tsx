'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Globe, Camera, Image as ImageIcon, Send, Clock, Loader2, ChevronLeft, Check, Share2, Plus } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { invokeWorker } from '@/lib/worker'

export default function ComposePostPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [merchantId, setMerchantId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [products, setProducts] = useState<any[]>([])
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  
  const [caption, setCaption] = useState('')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [platforms, setPlatforms] = useState({ facebook: true, instagram: true })
  const [scheduledAt, setScheduledAt] = useState(new Date(Date.now() + 3600000).toISOString().slice(0, 16))

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Find the merchant owned by the current authenticated user
      const { data: merchants } = await supabase.from('merchants').select('id').eq('owner_id', user.id).limit(1)
      if (merchants && merchants[0]) {
        setMerchantId(merchants[0].id)
        
        const { data: prodData } = await supabase
          .from('products')
          .select('id, name, images, price')
          .eq('merchant_id', merchants[0].id)
          .eq('status', 'active')
          .limit(10)
        
        setProducts(prodData || [])
      }
    }
    loadData()
  }, [])

  const handleSelectProduct = (product: any) => {
    setSelectedProduct(product)
    setCaption(`Check out our ${product.name}! Only RM${product.price}. \n\n#${product.name.replace(/\s+/g, '')} #newarrival`)
    if (product.images && product.images.length > 0) {
      setImageUrls(product.images)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !merchantId) return

    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${merchantId}/${Date.now()}.${fileExt}`
      const { data, error } = await supabase.storage
        .from('social-media')
        .upload(fileName, file)

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from('social-media')
        .getPublicUrl(fileName)

      setImageUrls(prev => [...prev, publicUrl])
      toast.success('Image uploaded successfully')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent, isImmediate = false) => {
    e.preventDefault()
    if (!merchantId) return
    if (imageUrls.length === 0) {
      toast.error('Please select at least one image')
      return
    }

    try {
      const platformValue = platforms.facebook && platforms.instagram ? 'both' : platforms.facebook ? 'facebook' : 'instagram'
      
      const { data: post, error } = await supabase
        .from('social_posts')
        .insert({
          merchant_id: merchantId,
          platform: platformValue,
          caption,
          image_urls: imageUrls,
          scheduled_at: isImmediate ? new Date().toISOString() : new Date(scheduledAt).toISOString(),
          status: isImmediate ? 'publishing' : 'scheduled',
          post_type: imageUrls.length > 1 ? 'carousel' : 'single',
        })
        .select('id')
        .single()

      if (error) throw error

      if (isImmediate) {
        toast.loading('Publishing to social media...', { id: 'publishing' })
        const { error: workerError } = await invokeWorker(`meta/publish/${post.id}`)
        toast.dismiss('publishing')
        if (workerError) throw workerError
        toast.success('Post published successfully!')
      } else {
        toast.success('Post scheduled successfully!')
      }

      router.push('/social')
      router.refresh()
    } catch (err: any) {
      toast.dismiss('publishing')
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/social">
          <Button variant="ghost" size="icon" className="rounded-xl">
            <ChevronLeft size={20} />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">Compose Post</h1>
          <p className="text-sm text-muted-foreground">Draft and schedule your next highlight.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">1. Content & Caption</h2>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700 uppercase">Select Product (Optional)</label>
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {products.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProduct(p)}
                    className={cn(
                      "flex-shrink-0 w-20 h-20 rounded-xl border-2 transition-all relative overflow-hidden",
                      selectedProduct?.id === p.id ? "border-blue-600 ring-2 ring-blue-100" : "border-gray-100 opacity-60 hover:opacity-100"
                    )}
                  >
                    {p.images?.[0] ? (
                      <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-50 flex items-center justify-center text-[10px] p-1 text-center font-bold">{p.name}</div>
                    )}
                    {selectedProduct?.id === p.id && (
                      <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
                        <Check size={20} className="text-blue-600" strokeWidth={4} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700 uppercase">Caption</label>
              <Textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="Write something engaging..."
                className="min-h-[120px] rounded-xl border-gray-100 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700 uppercase">Images</label>
              <div className="grid grid-cols-3 gap-2">
                {imageUrls.map((url, i) => (
                  <div key={i} className="aspect-square rounded-xl border overflow-hidden relative group">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button 
                      type="button"
                      onClick={() => setImageUrls(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Plus className="rotate-45" size={12} />
                    </button>
                  </div>
                ))}
                <div className="relative aspect-square">
                  <input 
                    type="file" 
                    id="image-upload" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleUpload}
                    disabled={uploading}
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('image-upload')?.click()}
                    disabled={uploading}
                    className="w-full h-full rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors"
                  >
                    {uploading ? <Loader2 size={20} className="animate-spin mb-1" /> : <ImageIcon size={20} className="mb-1" />}
                    <span className="text-[10px] font-bold">{uploading ? 'Uploading...' : 'Add Image'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">2. Scheduling</h2>
            <div className="flex items-center gap-4">
              <Clock size={16} className="text-gray-400" />
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="rounded-xl border-gray-100 h-11"
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">3. Platforms</h2>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setPlatforms(p => ({ ...p, facebook: !p.facebook }))}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-xl border transition-all",
                  platforms.facebook ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-100 opacity-60"
                )}
              >
                <div className="flex items-center gap-3">
                  <Globe className={cn("shrink-0", platforms.facebook ? "text-blue-600" : "text-gray-400")} />
                  <span className={cn("text-sm font-bold", platforms.facebook ? "text-blue-900" : "text-gray-500")}>Facebook Page</span>
                </div>
                {platforms.facebook && <Check size={16} className="text-blue-600" strokeWidth={3} />}
              </button>
              <button
                type="button"
                onClick={() => setPlatforms(p => ({ ...p, instagram: !p.instagram }))}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-xl border transition-all",
                  platforms.instagram ? "bg-pink-50 border-pink-200" : "bg-gray-50 border-gray-100 opacity-60"
                )}
              >
                <div className="flex items-center gap-3">
                  <Camera className={cn("shrink-0", platforms.instagram ? "text-pink-600" : "text-gray-400")} />
                  <span className={cn("text-sm font-bold", platforms.instagram ? "text-pink-900" : "text-gray-500")}>Instagram Profile</span>
                </div>
                {platforms.instagram && <Check size={16} className="text-pink-600" strokeWidth={3} />}
              </button>
            </div>
          </div>

          <div className="bg-gray-900 rounded-2xl p-6 text-white shadow-xl">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Preview</h3>
            <div className="bg-white rounded-xl overflow-hidden border border-gray-800 text-gray-900">
              <div className="p-3 flex items-center gap-2 border-b border-gray-50">
                <div className="w-8 h-8 rounded-full bg-gray-100 border" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold leading-none">Your Business Name</span>
                  <span className="text-[9px] text-gray-400 leading-none mt-1">Sponsored</span>
                </div>
              </div>
              <div className="p-3">
                <p className="text-[11px] font-medium leading-relaxed whitespace-pre-wrap">{caption || 'Your caption will appear here...'}</p>
              </div>
              {imageUrls[0] ? (
                <div className="aspect-square bg-gray-100 w-full">
                  <img src={imageUrls[0]} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="aspect-square bg-gray-50 w-full flex items-center justify-center">
                  <ImageIcon size={32} className="text-gray-200" />
                </div>
              )}
              <div className="p-3 flex items-center gap-4 text-gray-400">
                <Share2 size={16} />
                <ImageIcon size={16} />
                <Clock size={16} />
              </div>
            </div>
            
            <div className="flex flex-col gap-2 mt-6">
              <Button 
                type="button"
                onClick={(e) => handleSubmit(e as any, true)}
                disabled={loading || (!platforms.facebook && !platforms.instagram)}
                className="w-full rounded-xl h-12 bg-blue-600 hover:bg-black text-white font-black border-0 shadow-lg shadow-blue-500/20 active:scale-95 transition-all text-xs uppercase tracking-widest"
              >
                {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : <Send size={18} className="mr-2" />}
                Post Now
              </Button>
              <Button 
                type="submit" 
                disabled={loading || (!platforms.facebook && !platforms.instagram)}
                variant="outline"
                className="w-full rounded-xl h-11 border-gray-100 text-gray-500 font-bold hover:bg-gray-50 transition-all text-[10px] uppercase tracking-widest"
              >
                Schedule for {format(new Date(scheduledAt), 'MMM d, HH:mm')}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
