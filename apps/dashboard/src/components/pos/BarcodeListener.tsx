'use client'

import { useEffect, useRef } from 'react'
import { usePosCart } from '@/stores/pos-cart'
import { fetchPosProducts } from '@/lib/pos-actions'
import { toast } from 'react-hot-toast'

export function BarcodeListener() {
  const buffer = useRef<string>('')
  const lastKeyTime = useRef<number>(0)
  const addItem = usePosCart((s) => s.addItem)

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // 1. Ignore if input/textarea is focused, UNLESS it's our own search bar (optional)
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // We still allow barcode scanning globally, but most scanners act like keyboards.
        // A common pattern is to check the time between keypresses.
      }

      const currentTime = Date.now()
      
      // 2. Clear buffer if too much time passed between keys (HID scanners are fast)
      if (currentTime - lastKeyTime.current > 100) {
        buffer.current = ''
      }
      lastKeyTime.current = currentTime

      // 3. Handle 'Enter' which is the common suffix for HID scanners
      if (e.key === 'Enter') {
        if (buffer.current.length > 3) {
          const barcode = buffer.current
          buffer.current = ''
          
          try {
            // Check if product exists with this barcode
            const products = await fetchPosProducts('default_outlet')
            const found = products.find(p => p.barcode === barcode || p.sku === barcode)
            
            if (found) {
              addItem(found)
              toast.success(`Added: ${found.name}`, { icon: '🏷️' })
            } else {
              toast.error(`Barcode not recognized: ${barcode}`)
            }
          } catch (err) {
            console.error('Barcode processing error:', err)
          }
        }
        return
      }

      // 4. Append printable characters to buffer
      if (e.key.length === 1) {
        buffer.current += e.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [addItem])

  return null
}
