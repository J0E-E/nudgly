import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { ToastContainer } from '../components/Toast'

export interface Toast {
  id: string
  title: string
  body: string
  taskId?: number
}

interface ToastContextValue {
  addToast: (toast: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const MAX_VISIBLE = 3
const AUTO_DISMISS_MS = 6_000

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = String(nextId.current++)
    const newToast: Toast = { ...toast, id }
    setToasts(prev => [...prev.slice(-(MAX_VISIBLE - 1)), newToast])
    setTimeout(() => removeToast(id), AUTO_DISMISS_MS)
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  )
}
