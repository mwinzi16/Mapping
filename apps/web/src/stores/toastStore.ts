import { create } from 'zustand'
import type { ToastMessage } from '../components/Toast'

interface ToastStore {
  toasts: ToastMessage[]
  addToast: (toast: Omit<ToastMessage, 'id'>) => void
  dismissToast: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
  },
  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }))
  },
}))
