import { useToasts } from './toast'

import './Toaster.css'

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
