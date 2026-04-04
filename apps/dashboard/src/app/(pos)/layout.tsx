'use client'

import { BarcodeListener } from '@/components/pos/BarcodeListener'

export default function PosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 flex flex-col bg-slate-50 font-sans antialiased overflow-hidden select-none">
      <BarcodeListener />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
