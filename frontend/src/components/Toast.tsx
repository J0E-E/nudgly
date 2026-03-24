import { useNavigate } from 'react-router-dom'
import type { Toast } from '../contexts/ToastContext'
import './Toast.css'

interface ToastContainerProps {
  toasts: Toast[]
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  const navigate = useNavigate()

  function handleClick(toast: Toast) {
    onDismiss(toast.id)
    navigate('/tasks')
  }

  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map(toast => (
        <div key={toast.id} className="toast" onClick={() => handleClick(toast)}>
          <div className="toast-content">
            <strong className="toast-title">{toast.title}</strong>
            <span className="toast-body">{toast.body}</span>
          </div>
          <button
            className="toast-dismiss"
            onClick={e => { e.stopPropagation(); onDismiss(toast.id) }}
            aria-label="Dismiss notification"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  )
}
