/**
 * Password reset request: email only; submit sends reset email; same message whether or not user exists.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import './AuthScreens.css'

export function PasswordResetRequestScreen() {
  const { requestPasswordReset, error, clearError } = useAuth()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    setSubmitting(true)
    setSubmitted(false)
    try {
      await requestPasswordReset(email.trim())
      setSubmitted(true)
    } catch {
      // error set in context
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main
      id="password-reset-request-screen"
      className="auth-screen"
      aria-label="Reset password"
    >
      <h1 id="password-reset-request-title">Reset password</h1>
      {submitted ? (
        <p id="password-reset-request-success" className="auth-message">
          If an account exists for that email, we sent instructions to reset
          your password.
        </p>
      ) : (
        <form
          id="password-reset-request-form"
          onSubmit={handleSubmit}
          noValidate
        >
          {error && (
            <p
              id="password-reset-request-error"
              className="auth-error"
              role="alert"
            >
              {error}
            </p>
          )}
          <div id="password-reset-request-email-group" className="auth-field">
            <label
              id="password-reset-request-email-label"
              htmlFor="password-reset-request-email-input"
            >
              Email
            </label>
            <input
              id="password-reset-request-email-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={submitting}
              aria-describedby={
                error ? 'password-reset-request-error' : undefined
              }
            />
          </div>
          <button
            id="password-reset-request-submit-btn"
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
      <p id="password-reset-request-links">
        <Link id="password-reset-request-login-link" to="/login">
          Back to log in
        </Link>
      </p>
    </main>
  )
}
