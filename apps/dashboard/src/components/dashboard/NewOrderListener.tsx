'use client'
import { useEffect, useRef, useCallback } from 'react'
import { useRouter }    from 'next/navigation'
import toast            from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { ShoppingBag }  from 'lucide-react'

export function NewOrderListener({ merchantId }: { merchantId: string }) {
  const router    = useRouter()
  const audioRef  = useRef<AudioContext | null>(null)
  const isFirst   = useRef(true)   // skip initial snapshot

  const playChime = useCallback(() => {
    try {
      const ctx  = new AudioContext()
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type      = 'sine'
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3)
      gain.gain.setValueAtTime(0.4, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.6)
    } catch {}
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel  = supabase
      .channel(`new-orders-${merchantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `merchant_id=eq.${merchantId}` },
        (payload) => {
          if (isFirst.current) { isFirst.current = false; return }
          const order = payload.new as any
          playChime()
          toast.custom((t) => (
            <div
              onClick={() => { router.push(`/orders/${order.id}`); toast.dismiss(t.id) }}
              className={`flex items-center gap-3 bg-white border-2 border-blue-500 rounded-2xl shadow-lg px-4 py-3 cursor-pointer max-w-sm
                ${t.visible ? 'animate-enter' : 'animate-leave'}`}
            >
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                <ShoppingBag size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">New Order! 🎉</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  {order.order_number} · RM {Number(order.total_amount).toFixed(2)}
                </p>
              </div>
            </div>
          ), { duration: 8000, position: 'top-right' })
          router.refresh()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [merchantId, playChime, router])

  return null
}
