/**
 * Reusable confirmation dialog for destructive actions.
 * Uses native <dialog> for focus trap and accessibility.
 */

import { useRef, useEffect } from 'react'
import './ConfirmDialog.css'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<Element | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      triggerRef.current = document.activeElement
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus()
      }
    }
  }, [open])

  return (
    <dialog
      id="confirm-dialog"
      ref={dialogRef}
      className="confirm-dialog"
      role="alertdialog"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      onClose={onCancel}
    >
      <h2 id="confirm-dialog-title" className="confirm-dialog-title">
        {title}
      </h2>
      <p id="confirm-dialog-message" className="confirm-dialog-message">
        {message}
      </p>
      <div className="confirm-dialog-actions">
        <button
          id="confirm-dialog-cancel-btn"
          type="button"
          className="confirm-dialog-cancel"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          id="confirm-dialog-confirm-btn"
          type="button"
          className="confirm-dialog-confirm"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
