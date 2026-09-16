import { create } from 'zustand'

import './Toaster.css'

type Kind = 'success' | 'error' | 'info'

interface Toast {
  id: number
  kind: Kind
  message: string
}

interface ToastState {
  toasts: Toast[]
  push: (kind: Kind, message: string) => void
  dismiss: (id: number) => void
}

let nextId = 1

const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push(kind, message) {
    const id = nextId++
    set({ toasts: [...get().toasts, { id, kind, message }] })
    setTimeout(() => get().dismiss(id), 5000)
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) })
  }
}))

export const toast = {
  success: (message: string) => useToasts.getState().push('success', message),
  error: (message: string) => useToasts.getState().push('error', message),
  info: (message: string) => useToasts.getState().push('info', message)
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)

  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} className={`toast toast--${t.kind}`} onClick={() => dismiss(t.id)}>
          <span className="toast__icon" aria-hidden>
            {t.kind === 'success' ? '✓' : t.kind === 'error' ? '!' : 'i'}
          </span>
          <span className="toast__message">{t.message}</span>
          <span className="toast__bar" />
        </button>
      ))}
    </div>
  )
}
