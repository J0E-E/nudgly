/**
 * Login screen: email, password; submit calls login API; links to register and forgot password.
 */

import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import './AuthScreens.css'

export function LoginScreen() {
  const { login, error, clearError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      navigate(from, { replace: true })
    } catch {
      // error set in context
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main id="login-screen" className="auth-screen" aria-label="Log in">
      <h1 id="login-screen-title">Log in</h1>
      <form id="login-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <p id="login-error" className="auth-error" role="alert">
            {error}
          </p>
        )}
        <div id="login-email-group" className="auth-field">
          <label id="login-email-label" htmlFor="login-email-input">
            Email
          </label>
          <input
            id="login-email-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
            aria-describedby={error ? 'login-error' : undefined}
          />
        </div>
        <div id="login-password-group" className="auth-field">
          <label id="login-password-label" htmlFor="login-password-input">
            Password
          </label>
          <input
            id="login-password-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={submitting}
          />
        </div>
        <button
          id="login-submit-btn"
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p id="login-links">
        <Link id="login-register-link" to="/register">
          Create an account
        </Link>
        {' · '}
        <Link id="login-forgot-link" to="/reset-password">
          Forgot password?
        </Link>
      </p>
    </main>
  )
}
