'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PosSettingsState {
  terminalName: string
  autoPrint: boolean
  autoPrintZReport: boolean
  defaultPaymentMethod: 'cash' | 'card' | 'ewallet'
  quickPayAmounts: number[]
  setTerminalName: (name: string) => void
  setAutoPrint: (enabled: boolean) => void
  setAutoPrintZReport: (enabled: boolean) => void
  setDefaultPaymentMethod: (method: 'cash' | 'card' | 'ewallet') => void
  setQuickPayAmounts: (amounts: number[]) => void
}

export const usePosSettings = create<PosSettingsState>()(
  persist(
    (set) => ({
      terminalName: 'Terminal 01',
      autoPrint: true,
      autoPrintZReport: true,
      defaultPaymentMethod: 'cash',
      quickPayAmounts: [10, 20, 50, 100],
      setTerminalName: (name) => set({ terminalName: name }),
      setAutoPrint: (enabled) => set({ autoPrint: enabled }),
      setAutoPrintZReport: (enabled) => set({ autoPrintZReport: enabled }),
      setDefaultPaymentMethod: (method) => set({ defaultPaymentMethod: method }),
      setQuickPayAmounts: (amounts) => set({ quickPayAmounts: amounts }),
    }),
    {
      name: 'pos-settings-storage',
    }
  )
)
