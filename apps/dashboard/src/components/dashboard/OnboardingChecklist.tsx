'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, Circle, ChevronRight, Store, Package, MapPin, Clock, Smartphone, Image as ImageIcon, Rocket, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface ChecklistData {
  has_logo:          boolean
  has_banner:        boolean
  has_phone:         boolean
  has_hours:         boolean
  has_delivery_zone: boolean
  has_product:       boolean
  is_published:      boolean
  product_count:     number
  completion_pct:    number
}

export function OnboardingChecklist({ merchantId }: { merchantId: string }) {
  const supabase = createClient()
  const [data, setData] = useState<ChecklistData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchChecklist = async () => {
      const { data: res, error } = await supabase.rpc('get_onboarding_checklist', { p_merchant_id: merchantId })
      if (!error && res && res[0]) setData(res[0] as ChecklistData)
      setLoading(false)
    }
    fetchChecklist()
  }, [merchantId])

  if (loading || !data || data.completion_pct >= 100) return null

  const items = [
    { key: 'has_logo',          label: 'Upload Store Logo',       icon: ImageIcon,  href: '/onboarding?step=0' },
    { key: 'has_banner',        label: 'Upload Store Banner',     icon: ImageIcon,  href: '/onboarding?step=0' },
    { key: 'has_phone',         label: 'Set Phone Number',        icon: Smartphone, href: '/onboarding?step=1' },
    { key: 'has_hours',         label: 'Set Operating Hours',     icon: Clock,      href: '/onboarding?step=2' },
    { key: 'has_delivery_zone', label: 'Add Delivery Zones',      icon: MapPin,     href: '/onboarding?step=3' },
    { key: 'has_product',       label: 'Add First Product',       icon: Package,    href: '/onboarding?step=4' },
    { key: 'is_published',      label: 'Launch My Store',         icon: Rocket,     href: '/onboarding?step=5' },
  ]

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="p-6 bg-blue-600">
        <div className="flex items-center justify-between mb-4">
           <Store className="text-white w-5 h-5 opacity-80" />
           <span className="text-[10px] uppercase font-bold tracking-widest text-blue-100">Setup Guide ({data.completion_pct}%)</span>
        </div>
        <div className="relative h-2 bg-blue-900/20 rounded-full overflow-hidden">
           <div 
             className="absolute inset-y-0 left-0 bg-white rounded-full transition-all duration-1000" 
             style={{ width: `${data.completion_pct}%` }} 
           />
        </div>
        <h3 className="text-white font-bold mt-4 leading-tight">Complete your store setup to start selling!</h3>
      </div>

      <div className="p-4 space-y-1">
        {items.map((item) => {
          const isDone = (data as any)[item.key]
          return (
            <Link 
              key={item.key} 
              href={item.href}
              className={cn(
                "flex items-center gap-3 p-3 rounded-2xl transition-all group",
                isDone ? "opacity-50 grayscale" : "hover:bg-blue-50"
              )}
            >
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all",
                isDone ? "bg-green-50 border-green-200" : "bg-white border-gray-100 group-hover:border-blue-200 group-hover:shadow-sm"
              )}>
                {isDone ? <CheckCircle2 className="text-green-600 w-5 h-5" /> : <item.icon className="text-gray-400 group-hover:text-blue-500 w-5 h-5" />}
              </div>
              <span className={cn(
                "text-sm font-semibold flex-1 leading-tight",
                isDone ? "text-gray-400 line-through" : "text-gray-700 group-hover:text-blue-700"
              )}>
                {item.label}
              </span>
              {!isDone && <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-300 group-hover:translate-x-0.5 transition-all" />}
            </Link>
          )
        })}
      </div>

      <div className="p-4 bg-slate-50 border-t border-gray-50">
        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
           <ShieldCheck size={14} className="text-blue-400" /> Professional Merchant Check
        </div>
      </div>
    </div>
  )
}
