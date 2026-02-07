import React, { useEffect } from 'react'

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

interface ToastProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

const TOAST_STYLES = {
  success: 'bg-green-600 border-green-500',
  error: 'bg-red-600 border-red-500',
  warning: 'bg-yellow-600 border-yellow-500',
  info: 'bg-blue-600 border-blue-500',
} as const

const TOAST_ICONS = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
} as const

const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm" role="alert" aria-live="polite">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration || 5000)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onDismiss])

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg text-white text-sm animate-slide-in ${TOAST_STYLES[toast.type]}`}>
      <span className="text-lg">{TOAST_ICONS[toast.type]}</span>
      <span className="flex-1">{toast.message}</span>
      <button onClick={() => onDismiss(toast.id)} className="opacity-70 hover:opacity-100" aria-label="Dismiss notification">×</button>
    </div>
  )
}

export default Toast
