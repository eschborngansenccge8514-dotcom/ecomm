'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PosTransactionPayload } from '@project1/domain'

export interface PendingTransaction {
  id: string // Local temporary ID
  payload: PosTransactionPayload
  timestamp: number
  status: 'pending' | 'syncing' | 'failed'
  error?: string
}

interface OfflineState {
  isOfflineMode: boolean
  setOfflineMode: (offline: boolean) => void
  pendingTransactions: PendingTransaction[]
  addPending: (payload: PosTransactionPayload) => void
  removePending: (id: string) => void
  updateStatus: (id: string, status: 'pending' | 'syncing' | 'failed', error?: string) => void
  clearSynced: () => void
}

export const usePosOffline = create<OfflineState>()(
  persist(
    (set) => ({
      isOfflineMode: false,
      setOfflineMode: (offline) => set({ isOfflineMode: offline }),
      pendingTransactions: [],
      addPending: (payload) => set((state) => ({
        pendingTransactions: [
          ...state.pendingTransactions,
          {
            id: `OFF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            payload,
            timestamp: Date.now(),
            status: 'pending'
          }
        ]
      })),
      removePending: (id) => set((state) => ({
        pendingTransactions: state.pendingTransactions.filter((t) => t.id !== id)
      })),
      updateStatus: (id, status, error) => set((state) => ({
        pendingTransactions: state.pendingTransactions.map((t) => 
          t.id === id ? { ...t, status, error } : t
        )
      })),
      clearSynced: () => set((state) => ({
        pendingTransactions: state.pendingTransactions.filter((t) => t.status !== 'syncing' && t.status !== 'pending')
      })),
    }),
    {
      name: 'pos-offline-storage',
    }
  )
)
