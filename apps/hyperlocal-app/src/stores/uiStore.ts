import { create } from 'zustand'

interface Toast {
  id:      string
  type:    'success' | 'error' | 'info' | 'warning'
  message: string
}

interface UIState {
  toasts:        Toast[]
  isModalOpen:   boolean
  modalContent:  React.ReactNode | null
}

interface UIActions {
  showToast:  (type: Toast['type'], message: string) => void
  hideToast:  (id: string) => void
  openModal:  (content: React.ReactNode) => void
  closeModal: () => void
}

export const useUIStore = create<UIState & UIActions>((set, get) => ({
  toasts:       [],
  isModalOpen:  false,
  modalContent: null,

  showToast: (type, message) => {
    const id = Date.now().toString()
    set({ toasts: [...get().toasts, { id, type, message }] })
    setTimeout(() => get().hideToast(id), 3500)
  },

  hideToast: (id) =>
    set({ toasts: get().toasts.filter(t => t.id !== id) }),

  openModal:  (content) => set({ isModalOpen: true, modalContent: content }),
  closeModal: ()        => set({ isModalOpen: false, modalContent: null }),
}))
