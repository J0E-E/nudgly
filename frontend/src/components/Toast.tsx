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
    <div id="toast-container" className="toast-container" role="status" aria-live="polite">
      {toasts.map(toast => (
        <div key={toast.id} id={`toast-${toast.id}`} className="toast" onClick={() => handleClick(toast)}>
          <div id={`toast-${toast.id}-content`} className="toast-content">
            <strong id={`toast-${toast.id}-title`} className="toast-title">{toast.title}</strong>
            <span id={`toast-${toast.id}-body`} className="toast-body">{toast.body}</span>
          </div>
          <button
            id={`toast-${toast.id}-dismiss-btn`}
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
