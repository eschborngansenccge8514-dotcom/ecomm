'use client'

import { BarcodeListener } from '@/components/pos/BarcodeListener'
import { OfflineBanner } from '@/components/pos/OfflineBanner'

export default function PosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 flex flex-col bg-slate-50 font-sans antialiased overflow-hidden select-none">
      <BarcodeListener />
      <OfflineBanner />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
