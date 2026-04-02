/**
 * Modal for adding friends by email or username.
 * Uses native <dialog> for focus trap and accessibility.
 */

import { useState, useRef, useEffect } from 'react'
import { useSendInvite } from '../hooks/useFriends'
import './AddFriendModal.css'

interface AddFriendModalProps {
  open: boolean
  onClose: () => void
}

function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function AddFriendModal({ open, onClose }: AddFriendModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<Element | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const sendInvite = useSendInvite()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      triggerRef.current = document.activeElement
      setInput('')
      setError(null)
      setSuccess(null)
      dialog.showModal()
      inputRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus()
      }
    }
  }, [open])

  function handleClose() {
    setError(null)
    setSuccess(null)
    onClose()
  }

  function handleInputChange(value: string) {
    setInput(value)
    if (success) setSuccess(null)
    if (error) setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const value = input.trim()
    if (!value) {
      setError('Please enter an email address or username.')
      return
    }

    const payload = isEmailAddress(value)
      ? { to_email: value }
      : { to_username: value.replace(/^@/, '') }

    try {
      await sendInvite.mutateAsync(payload)
      setInput('')
      setSuccess('Invite sent!')
      inputRef.current?.focus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite.')
    }
  }

  return (
    <dialog
      id="add-friend-dialog"
      ref={dialogRef}
      className="add-friend-dialog"
      aria-labelledby="add-friend-title"
      onClose={handleClose}
    >
      <h2 id="add-friend-title" className="add-friend-title">
        Add Friend
      </h2>
      {success && (
        <p id="add-friend-success" className="add-friend-success" role="status">
          {success}
        </p>
      )}
      <form id="add-friend-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <p id="add-friend-error" className="add-friend-error" role="alert">
            {error}
          </p>
        )}
        <div id="add-friend-field" className="add-friend-field">
          <label id="add-friend-label" htmlFor="add-friend-input">Email or username</label>
          <input
            ref={inputRef}
            id="add-friend-input"
            type="text"
            placeholder="e.g. friend@email.com or @username"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            disabled={sendInvite.isPending}
          />
        </div>
        <div id="add-friend-actions" className="add-friend-actions">
          <button
            id="add-friend-cancel-btn"
            type="button"
            className="add-friend-cancel"
            onClick={handleClose}
            disabled={sendInvite.isPending}
          >
            Cancel
          </button>
          <button
            id="add-friend-submit-btn"
            type="submit"
            className="add-friend-submit"
            disabled={sendInvite.isPending || !input.trim()}
            aria-busy={sendInvite.isPending}
          >
            {sendInvite.isPending ? 'Sending...' : 'Send Invite'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
