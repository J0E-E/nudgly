/**
 * Password reset confirm: token from query; new password + confirm; submit calls confirm API.
 */

import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import './AuthScreens.css'

export function PasswordResetConfirmScreen() {
  const { confirmPasswordReset, error, clearError } = useAuth()
  const [searchParams] = useSearchParams()
  const tokenFromUrl = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    if (password !== confirm) {
      return
    }
    setSubmitting(true)
    try {
      await confirmPasswordReset(tokenFromUrl, password)
      setSuccess(true)
    } catch {
      // error set in context
    } finally {
      setSubmitting(false)
    }
  }

  const tokenMissing = !tokenFromUrl

  if (tokenMissing) {
    return (
      <main
        id="password-reset-confirm-screen"
        className="auth-screen"
        aria-label="Set new password"
      >
        <h1 id="password-reset-confirm-title">Set new password</h1>
        <p id="password-reset-confirm-missing-token" className="auth-error">
          Missing or invalid reset link. Request a new one from the login page.
        </p>
        <p id="password-reset-confirm-links">
          <Link id="password-reset-confirm-login-link" to="/login">
            Back to log in
          </Link>
        </p>
      </main>
    )
  }

  if (success) {
    return (
      <main
        id="password-reset-confirm-screen"
        className="auth-screen"
        aria-label="Set new password"
      >
        <h1 id="password-reset-confirm-title">Password updated</h1>
        <p id="password-reset-confirm-success" className="auth-message">
          Your password has been reset. You can now log in.
        </p>
        <p id="password-reset-confirm-links">
          <Link id="password-reset-confirm-login-link" to="/login">
            Log in
          </Link>
        </p>
      </main>
    )
  }

  return (
    <main
      id="password-reset-confirm-screen"
      className="auth-screen"
      aria-label="Set new password"
    >
      <h1 id="password-reset-confirm-title">Set new password</h1>
      <form id="password-reset-confirm-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <p
            id="password-reset-confirm-error"
            className="auth-error"
            role="alert"
          >
            {error}
          </p>
        )}
        <div id="password-reset-confirm-password-group" className="auth-field">
          <label
            id="password-reset-confirm-password-label"
            htmlFor="password-reset-confirm-password-input"
          >
            New password
          </label>
          <input
            id="password-reset-confirm-password-input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={submitting}
            minLength={8}
            aria-describedby={
              error ? 'password-reset-confirm-error' : undefined
            }
          />
        </div>
        <div id="password-reset-confirm-confirm-group" className="auth-field">
          <label
            id="password-reset-confirm-confirm-label"
            htmlFor="password-reset-confirm-confirm-input"
          >
            Confirm new password
          </label>
          <input
            id="password-reset-confirm-confirm-input"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            disabled={submitting}
            minLength={8}
          />
        </div>
        {password && confirm && password !== confirm && (
          <p id="password-reset-confirm-mismatch" className="auth-error">
            Passwords do not match.
          </p>
        )}
        <button
          id="password-reset-confirm-submit-btn"
          type="submit"
          disabled={submitting || password !== confirm}
          aria-busy={submitting}
        >
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </form>
      <p id="password-reset-confirm-links">
        <Link id="password-reset-confirm-back-link" to="/login">
          Back to log in
        </Link>
      </p>
    </main>
  )
}
