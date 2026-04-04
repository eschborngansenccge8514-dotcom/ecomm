'use client'
import { useState, useEffect } from 'react'
import { useRouter }  from 'next/navigation'
import { Input }      from '@/components/ui/input'
import { Button }     from '@/components/ui/button'
import { cn }         from '@/lib/utils'
import { STORE_TYPES, type StoreType, DEFAULT_APPEARANCE, DEFAULT_CONFIG } from '@/lib/store-types'
import { MultiImageUpload } from '@/components/dashboard/MultiImageUpload'
import { 
  CheckCircle2, ChevronRight, ChevronLeft, Loader2, Store, MapPin, 
  Truck, Settings2, Package, Rocket, Info, Shield, Plus, X, Pencil, Trash
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

const STATES = ['Johor','Kedah','Kelantan','Melaka','Negeri Sembilan','Pahang','Perak','Perlis',
  'Pulau Pinang','Sabah','Sarawak','Selangor','Terengganu','Kuala Lumpur','Putrajaya','Labuan']

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

// ─── Step components ──────────────────────────────────────────────────────────

function OnboardingProgress({ step, total }: { step: number; total: number }) {
  const labels = ['Store Brand', 'Contact Info', 'Operating Hours', 'Delivery Zones', 'First Product', 'Launch!']
  return (
    <div className="flex flex-col gap-4 mb-10">
      <div className="flex items-center gap-2">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className={cn('h-1.5 rounded-full flex-1 transition-all duration-500',
            i < step ? 'bg-blue-600' : i === step ? 'bg-blue-300' : 'bg-gray-100')} />
        ))}
      </div>
      <div className="flex items-center justify-between px-1">
        <div className="text-sm font-bold text-gray-900">{labels[step]}</div>
        <div className="text-xs text-gray-400 font-medium uppercase tracking-wider">Step {step + 1} of {total}</div>
      </div>
    </div>
  )
}

// ─── Main wizard component ───────────────────────────────────────────────────

export function OnboardingWizard({ merchant }: { merchant: any }) {
  const router    = useRouter()
  const supabase  = createClient()
  const [step,      setStep]    = useState<number>(merchant.onboarding_step || 0)
  const [saving,    setSaving]  = useState(false)
  
  // Form states
  const [appearance, setAppearance] = useState(merchant.appearance || DEFAULT_APPEARANCE)
  const [config,     setConfig]     = useState(merchant.store_config || DEFAULT_CONFIG)
  const [hours,      setHours]      = useState<any[]>(merchant.hours || [])
  const [zones,      setZones]      = useState<any[]>(merchant.zones || [])
  const [product,    setProduct]    = useState({ name: '', price: 0, description: '', images: [], categoryId: '' })
  
  const saveStep = async (nextStep?: number) => {
    setSaving(true)
    try {
      const data: any = { onboarding_step: nextStep ?? step }
      if (step === 0) data.appearance = appearance
      if (step === 1) {
        data.store_config = config
        data.lat = config.lat
        data.lng = config.lng
      }
      if (step === 2) {
        // Save hours separate table
        await supabase.from('merchant_operating_hours').delete().eq('merchant_id', merchant.id)
        if (hours.length > 0) {
          await supabase.from('merchant_operating_hours').insert(hours.map(h => ({ ...h, merchant_id: merchant.id })))
        }
      }
      if (step === 3) {
        // Save zones separate table
        await supabase.from('delivery_zones').delete().eq('merchant_id', merchant.id)
        if (zones.length > 0) {
          await supabase.from('delivery_zones').insert(zones.map(z => ({ 
            merchant_id: merchant.id,
            zone_name: z.zone_name,
            delivery_fee: z.delivery_fee,
            min_order_amount: z.min_order_amount,
            radius_km: z.radius_km
          })))
        }
      }
      if (step === 4) {
        // Create first product
        if (product.name) {
          await supabase.from('products').insert({
            merchant_id: merchant.id,
            name: product.name,
            price: product.price,
            description: product.description,
            images: product.images,
            status: 'active'
          })
        }
      }
      if (step === 5) {
        data.onboarding_completed = true
        data.onboarding_completed_at = new Date().toISOString()
      }

      const { error } = await supabase.from('merchants').update(data).eq('id', merchant.id)
      if (error) throw error

      if (nextStep !== undefined) {
        setStep(nextStep)
        toast.success(`Progress saved!`)
      }
      if (step === 5) {
        toast.success('Congratulations! Your store is ready.')
        router.refresh()
        router.push('/')
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const next = () => saveStep(step + 1)
  const prev = () => setStep(s => s - 1)

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <OnboardingProgress step={step} total={6} />

      <div className="bg-white rounded-[2rem] shadow-xl shadow-blue-900/5 border border-gray-100 overflow-hidden min-h-[500px] flex flex-col">
        <div className="p-8 md:p-12 flex-1">

          {/* ── Step 0: Brand Identity ───────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                  <Store className="text-white" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Define Your Brand</h2>
                  <p className="text-sm text-gray-400 mt-1">First impressions matter. Let's make your store look amazing.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-bold text-gray-700 block mb-2">Store Logo</label>
                    <div className="flex items-start gap-4">
                       <div className="group relative w-32 h-32 rounded-3xl border-2 border-dashed border-gray-100 bg-gray-50 flex items-center justify-center overflow-hidden hover:border-blue-400 transition-all cursor-pointer">
                         {appearance.logoUrl ? (
                           <img src={appearance.logoUrl} className="w-full h-full object-cover" />
                         ) : <Plus className="text-gray-300" />}
                         <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            try {
                              const { uploadToR2 } = await import('@/lib/storage')
                              const publicUrl = await uploadToR2(file, `merchant-assets/${merchant.id}/logos/${Date.now()}-${file.name}`)
                              setAppearance((p: any) => ({ ...p, logoUrl: publicUrl }))
                            } catch (err: any) {
                              toast.error(err.message)
                            }
                         }} />
                       </div>
                       <div className="flex-1 space-y-2">
                         <p className="text-xs text-gray-400 leading-relaxed">
                           Recommend 512x512px. Transparent background (PNG/WebP) works best on all layouts.
                         </p>
                         {appearance.logoUrl && (
                           <button onClick={() => setAppearance((p: any) => ({ ...p, logoUrl: '' }))} className="text-[10px] uppercase tracking-wider font-bold text-red-500 hover:text-red-600">Remove logo</button>
                         )}
                       </div>
                    </div>
                  </div>

                  <div>
                     <label className="text-sm font-bold text-gray-700 block mb-2">Primary Color</label>
                     <div className="flex items-center gap-3">
                        <input type="color" value={appearance.primaryColor} onChange={(e) => setAppearance((p: any) => ({ ...p, primaryColor: e.target.value }))}
                          className="w-12 h-12 rounded-xl border-none p-0 cursor-pointer overflow-hidden shadow-sm" />
                        <Input value={appearance.primaryColor} onChange={(e) => setAppearance((p: any) => ({ ...p, primaryColor: e.target.value }))} className="font-mono text-sm uppercase w-32" />
                        <div className="text-[10px] text-gray-400 uppercase font-bold tracking-widest ml-auto">Brand Accent</div>
                     </div>
                  </div>

                  <div>
                    <label className="text-sm font-bold text-gray-700 block mb-2">Tagline</label>
                    <Input value={appearance.tagline} onChange={(e) => setAppearance((p: any) => ({ ...p, tagline: e.target.value }))}
                      placeholder="e.g. Authentic Thai street food in the heart of PJ" />
                  </div>
                </div>

                <div className="bg-slate-50 rounded-[2rem] p-6 flex flex-col border border-gray-100">
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-4">Real-time Preview</span>
                  <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden relative group">
                    <div className="h-20 bg-gray-100 animate-pulse relative">
                       {appearance.bannerUrl && <img src={appearance.bannerUrl} className="w-full h-full object-cover" />}
                       <label className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                          <input type="file" className="hidden" onChange={async (e) => {
                             const file = e.target.files?.[0]
                             if (!file) return
                             try {
                               const { uploadToR2 } = await import('@/lib/storage')
                               const publicUrl = await uploadToR2(file, `merchant-assets/${merchant.id}/banners/${Date.now()}-${file.name}`)
                               setAppearance((p: any) => ({ ...p, bannerUrl: publicUrl }))
                             } catch (err: any) {
                               toast.error(err.message)
                             }
                          }} />
                          <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-[10px] font-bold text-gray-900 border border-white">CHANGE BANNER</div>
                       </label>
                    </div>
                    <div className="p-4 flex flex-col items-center">
                       <div className="w-16 h-16 rounded-2xl bg-white shadow-xl -mt-10 mb-3 border-2 border-white overflow-hidden">
                          {appearance.logoUrl ? <img src={appearance.logoUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-50 flex items-center justify-center"><Store size={20} className="text-gray-200" /></div>}
                       </div>
                       <div className="h-3 w-32 bg-gray-900 rounded-full mb-2" style={{ backgroundColor: appearance.primaryColor }} />
                       <div className="h-2 w-24 bg-gray-100 rounded-full" />
                    </div>
                    <div className="p-4 border-t border-gray-50 flex gap-2">
                       <div className="flex-1 h-32 bg-gray-50 rounded-2xl border border-gray-100" />
                       <div className="flex-1 h-32 bg-gray-50 rounded-2xl border border-gray-100" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 1: Contact Info ─────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                  <MapPin className="text-white" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Contact & Location</h2>
                  <p className="text-sm text-gray-400 mt-1">How can customers reach you and where is your store?</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="text-sm font-bold text-gray-700 block mb-1">Business Email</label>
                  <Input value={config.email} onChange={(e) => setConfig((p: any) => ({ ...p, email: e.target.value }))} placeholder="e.g. hello@store.com" />
                </div>
                <div className="space-y-4">
                  <label className="text-sm font-bold text-gray-700 block mb-1">Store Phone</label>
                  <Input value={config.phone} onChange={(e) => setConfig((p: any) => ({ ...p, phone: e.target.value }))} placeholder="+60 1X-XXXXXXXX" />
                </div>
                <div className="col-span-full space-y-4">
                  <label className="text-sm font-bold text-gray-700 block mb-1">Store Address</label>
                  <textarea value={config.address} onChange={(e) => setConfig((p: any) => ({ ...p, address: e.target.value }))}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" rows={3} placeholder="Full building/street address..." />
                </div>
                <div className="space-y-4">
                  <label className="text-sm font-bold text-gray-700 block mb-1">Postcode</label>
                  <Input value={config.postcode} onChange={(e) => setConfig((p: any) => ({ ...p, postcode: e.target.value }))} placeholder="e.g. 47301" maxLength={5} />
                </div>
                <div className="space-y-4">
                  <label className="text-sm font-bold text-gray-700 block mb-1">State</label>
                  <select value={config.state} onChange={(e) => setConfig((p: any) => ({ ...p, state: e.target.value }))}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm flex items-center justify-between focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">Select State</option>
                    {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="col-span-full pt-6 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <label className="text-sm font-bold text-gray-700 block mb-1">Latitude</label>
                    <Input type="number" step="any" value={config.lat || ''} 
                      onChange={(e) => setConfig((p: any) => ({ ...p, lat: e.target.value ? parseFloat(e.target.value) : null }))} 
                      placeholder="0.0000" />
                  </div>
                  <div className="space-y-4">
                    <label className="text-sm font-bold text-gray-700 block mb-1">Longitude</label>
                    <Input type="number" step="any" value={config.lng || ''} 
                      onChange={(e) => setConfig((p: any) => ({ ...p, lng: e.target.value ? parseFloat(e.target.value) : null }))} 
                      placeholder="0.0000" />
                  </div>
                </div>

                <div className="col-span-full">
                  <Button variant="outline" type="button" 
                    onClick={() => {
                      if ('geolocation' in navigator) {
                        toast.promise(
                          new Promise((resolve, reject) => {
                            navigator.geolocation.getCurrentPosition(
                              (pos) => {
                                setConfig((p: any) => ({ ...p, lat: pos.coords.latitude, lng: pos.coords.longitude }))
                                resolve(pos)
                              },
                              (err) => reject(err)
                            )
                          }),
                          {
                            loading: 'Detecting location...',
                            success: 'Location detected!',
                            error: 'Location access denied or unavailable.',
                          }
                        )
                      } else {
                        toast.error('Geolocation not supported')
                      }
                    }}
                    className="w-full h-12 rounded-2xl border-blue-100 text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-2">
                    <MapPin size={16} />
                    Detect My Current Location
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Hours ────────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                  <Settings2 className="text-white" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Operating Hours</h2>
                  <p className="text-sm text-gray-400 mt-1">Let customers know when you're open for business.</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-[2rem] p-8 border border-gray-100">
                <div className="space-y-3">
                  {DAYS.map((day, idx) => {
                    const existing = hours.find(h => h.day_of_week === idx)
                    const isActive = !!existing
                    return (
                      <div key={day} className={cn("flex items-center gap-4 p-4 rounded-2xl bg-white shadow-sm border transition-all", isActive ? "border-blue-200 ring-1 ring-blue-50" : "border-transparent opacity-60")}>
                        <div className="w-12 h-10 flex items-center justify-center font-bold text-gray-900">{day}</div>
                        <button type="button" onClick={() => {
                          if (isActive) setHours(h => h.filter(x => x.day_of_week !== idx))
                          else setHours(h => [...h, { day_of_week: idx, open_time: '09:00', close_time: '18:00', is_closed: false }])
                        }} className={cn("px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors", isActive ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400")}>
                          {isActive ? 'OPEN' : 'CLOSED'}
                        </button>
                        {isActive && (
                          <div className="flex items-center gap-3 ml-auto">
                            <input type="time" value={existing.open_time} onChange={(e) => setHours(h => h.map(x => x.day_of_week === idx ? { ...x, open_time: e.target.value } : x))} className="text-sm border-none bg-gray-50 rounded-lg px-2 py-1 focus:ring-1 focus:ring-blue-300" />
                            <span className="text-gray-300">to</span>
                            <input type="time" value={existing.close_time} onChange={(e) => setHours(h => h.map(x => x.day_of_week === idx ? { ...x, close_time: e.target.value } : x))} className="text-sm border-none bg-gray-50 rounded-lg px-2 py-1 focus:ring-1 focus:ring-blue-300" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Delivery Zones ───────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                  <Truck className="text-white" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Delivery Options</h2>
                  <p className="text-sm text-gray-400 mt-1">Set up where you deliver and your shipping fees.</p>
                </div>
              </div>

               <div className="space-y-4">
                 {zones.length === 0 ? (
                   <div className="bg-slate-50 rounded-[2rem] border-2 border-dashed border-gray-100 p-12 text-center">
                     <Truck size={40} className="text-gray-200 mx-auto mb-4" />
                     <p className="text-sm text-gray-500 mb-6">No delivery zones created yet.</p>
                     <Button onClick={() => setZones([...zones, { zone_name: 'Local Area', radius_km: 5, delivery_fee: 5, min_order_amount: 20 }])} variant="outline" className="rounded-2xl px-6 border-blue-200 text-blue-600 hover:bg-blue-50">
                       <Plus size={16} className="mr-2" /> Add My First Zone
                     </Button>
                   </div>
                 ) : (
                   <div className="grid gap-4">
                      {zones.map((zone, idx) => (
                        <div key={idx} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-6 group hover:border-blue-200 transition-all">
                           <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center shrink-0">
                             <MapPin className="text-blue-600" size={24} />
                           </div>
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                             <div>
                               <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Zone Name</label>
                               <input value={zone.zone_name} onChange={(e) => setZones(p => p.map((z,i) => i === idx ? { ...z, zone_name: e.target.value } : z))} className="text-sm font-bold text-gray-900 border-none bg-transparent p-0 focus:ring-0 w-full" />
                             </div>
                             <div>
                               <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Radius (km)</label>
                               <input type="number" value={zone.radius_km} onChange={(e) => setZones(p => p.map((z,i) => i === idx ? { ...z, radius_km: Number(e.target.value) } : z))} className="text-sm font-bold text-gray-900 border-none bg-transparent p-0 focus:ring-0 w-full" />
                             </div>
                             <div>
                               <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Fee (RM)</label>
                               <input type="number" value={zone.delivery_fee} onChange={(e) => setZones(p => p.map((z,i) => i === idx ? { ...z, delivery_fee: Number(e.target.value) } : z))} className="text-sm font-bold text-gray-900 border-none bg-transparent p-0 focus:ring-0 w-full" />
                             </div>
                             <div>
                               <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Min Order</label>
                               <input type="number" value={zone.min_order_amount} onChange={(e) => setZones(p => p.map((z,i) => i === idx ? { ...z, min_order_amount: Number(e.target.value) } : z))} className="text-sm font-bold text-gray-900 border-none bg-transparent p-0 focus:ring-0 w-full" />
                             </div>
                           </div>
                           <button onClick={() => setZones(p => p.filter((_,i) => i !== idx))} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                             <Trash size={18} />
                           </button>
                        </div>
                      ))}
                      <Button onClick={() => setZones([...zones, { zone_name: 'New Zone', radius_km: 10, delivery_fee: 10, min_order_amount: 50 }])} variant="ghost" className="rounded-2xl border-2 border-dashed border-gray-100 hover:bg-gray-50 text-gray-400 h-16">
                        <Plus size={16} className="mr-2" /> Add Zone
                      </Button>
                   </div>
                 )}
               </div>
            </div>
          )}

          {/* ── Step 4: First Product ────────────────────────────────────── */}
          {step === 4 && (
             <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                    <Package className="text-white" size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Your First Product</h2>
                    <p className="text-sm text-gray-400 mt-1">Let's add your very first item to see how it looks!</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-6">
                       <div className="space-y-2">
                         <label className="text-sm font-bold text-gray-700 block">Product Name</label>
                         <Input value={product.name} onChange={(e) => setProduct(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Signature Nasi Lemak" className="h-12 rounded-2xl" />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <label className="text-sm font-bold text-gray-700 block">Price (RM)</label>
                             <Input type="number" value={product.price} onChange={(e) => setProduct(p => ({ ...p, price: Number(e.target.value) }))} placeholder="0.00" className="h-12 rounded-2xl" />
                          </div>
                          <div className="space-y-2">
                             <label className="text-sm font-bold text-gray-700 block">Category</label>
                             <select className="w-full border border-gray-200 rounded-2xl px-4 h-12 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                               <option>Main Course</option>
                               <option>Appetizer</option>
                               <option>Drinks</option>
                             </select>
                          </div>
                       </div>
                       <div className="space-y-2">
                         <label className="text-sm font-bold text-gray-700 block">Description</label>
                         <textarea value={product.description} onChange={(e) => setProduct(p => ({ ...p, description: e.target.value }))} className="w-full border border-gray-200 rounded-3xl px-5 py-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" rows={4} placeholder="Delicious, homemade, traditional..." />
                       </div>
                    </div>

                    <div className="bg-slate-50 rounded-[2rem] p-6 border border-gray-100 h-fit">
                       <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-4 block">Product Images</span>
                       <MultiImageUpload 
                         value={product.images} 
                         onChange={(urls) => setProduct(p => ({ ...p, images: urls as any }))} 
                         maxImages={3}
                         path={merchant.id}
                       />
                    </div>
                  </div>
                </div>
             </div>
          )}

          {/* ── Step 5: Launch ───────────────────────────────────────────── */}
          {step === 5 && (
            <div className="h-full flex flex-col items-center justify-center py-12 space-y-10 animate-in zoom-in-95 duration-700">
               <div className="relative">
                  <div className="absolute inset-0 bg-blue-400 rounded-full blur-3xl opacity-20 animate-pulse" />
                  <div className="relative w-32 h-32 bg-blue-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-blue-200 rotate-12">
                    <Rocket className="text-white" size={56} />
                  </div>
               </div>

               <div className="text-center space-y-4 max-w-sm">
                  <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">You're All Set!</h2>
                  <p className="text-gray-500 leading-relaxed">
                    Great job! You've successfully completed the onboarding. Your store is now ready to receive orders.
                  </p>
               </div>

               <div className="w-full grid gap-4">
                  <div className="flex items-center gap-4 p-4 rounded-3xl bg-green-50 border border-green-100 text-green-700">
                    <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-sm shadow-green-100">
                       <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Store verified & secured</p>
                      <p className="text-[10px] opacity-75 font-medium leading-none mt-1 uppercase tracking-wider">KYC Level 1 Complete</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 rounded-3xl bg-blue-50 border border-blue-100 text-blue-700">
                    <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-100">
                       <Shield size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Billing information active</p>
                      <p className="text-[10px] opacity-75 font-medium leading-none mt-1 uppercase tracking-wider">Next Payout: End of Month</p>
                    </div>
                  </div>
               </div>
            </div>
          )}

        </div>

        {/* ── Footer / Navigation ─────────────────────────────────────── */}
        <div className="px-8 pb-8 md:px-12 md:pb-12 bg-white/50 backdrop-blur-sm border-t border-gray-50 flex items-center justify-between">
           {step > 0 ? (
             <button onClick={prev} className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-gray-900 transition-colors py-4">
               <ChevronLeft size={18} /> Back
             </button>
           ) : <div />}

           <div className="flex gap-4">
             <Button variant="ghost" onClick={() => saveStep()} className="text-sm font-bold text-blue-600 rounded-2xl hover:bg-blue-50">Save Draft</Button>
             <Button onClick={next} disabled={saving} className="rounded-2xl px-10 h-14 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200 text-base">
                {saving ? <Loader2 size={18} className="animate-spin" /> : step === 5 ? 'Launch Dashboard' : 'Continue'}
                {!saving && step < 5 && <ChevronRight size={18} className="ml-2" />}
             </Button>
           </div>
        </div>
      </div>

      <div className="mt-12 flex items-center justify-center gap-8 text-xs text-gray-300 font-bold uppercase tracking-[0.2em]">
        <div className="flex items-center gap-2 pb-1 border-b-2 border-transparent hover:border-gray-100 cursor-pointer transition-colors"><Shield size={14} /> Encrypted</div>
        <div className="flex items-center gap-2 pb-1 border-b-2 border-transparent hover:border-gray-100 cursor-pointer transition-colors"><CheckCircle2 size={14} /> Verified</div>
        <div className="flex items-center gap-2 pb-1 border-b-2 border-transparent hover:border-gray-100 cursor-pointer transition-colors hover:text-blue-600">Need Help?</div>
      </div>
    </div>
  )
}
