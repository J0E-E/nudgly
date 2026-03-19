/**
 * Register screen: email, username, password, confirm password; submit calls register API; link to login.
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import { OAuthButtons } from '../components/OAuthButtons'
import './AuthScreens.css'

export function RegisterScreen() {
  const { register, error, clearError } = useAuth()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    setConfirmError(null)
    if (password !== confirmPassword) {
      setConfirmError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await register(email.trim(), username.trim(), password)
      navigate('/', { replace: true })
    } catch {
      // error set in context
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main
      id="register-screen"
      className="auth-screen"
      aria-label="Create account"
    >
      <h1 id="register-screen-title">Create account</h1>
      <form id="register-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <p id="register-error" className="auth-error" role="alert">
            {error}
          </p>
        )}
        <div id="register-email-group" className="auth-field">
          <label id="register-email-label" htmlFor="register-email-input">
            Email
          </label>
          <input
            id="register-email-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
            aria-describedby={error ? 'register-error' : undefined}
          />
        </div>
        <div id="register-username-group" className="auth-field">
          <label id="register-username-label" htmlFor="register-username-input">
            Username
          </label>
          <input
            id="register-username-input"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={submitting}
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z0-9_]+"
            title="Letters, numbers, and underscores only (3–30 characters)"
          />
        </div>
        <div id="register-password-group" className="auth-field">
          <label id="register-password-label" htmlFor="register-password-input">
            Password
          </label>
          <input
            id="register-password-input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={submitting}
            minLength={8}
            title="At least 8 characters, one letter and one number"
          />
        </div>
        <div id="register-password-confirm-group" className="auth-field">
          <label id="register-password-confirm-label" htmlFor="register-password-confirm-input">
            Confirm password
          </label>
          <input
            id="register-password-confirm-input"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              if (confirmError) setConfirmError(null)
            }}
            required
            disabled={submitting}
            minLength={8}
            aria-describedby={confirmError ? 'register-confirm-error' : undefined}
          />
          {confirmError && (
            <p id="register-confirm-error" className="auth-error" role="alert">
              {confirmError}
            </p>
          )}
        </div>
        <button
          id="register-submit-btn"
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <OAuthButtons idPrefix="register" />
      <p id="register-links">
        <Link id="register-login-link" to="/login">
          Already have an account? Log in
        </Link>
      </p>
    </main>
  )
}
