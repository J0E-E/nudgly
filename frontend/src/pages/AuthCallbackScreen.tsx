/**
 * OAuth callback: reads access and refresh from URL fragment, applies auth state, redirects to app.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import './AuthScreens.css'

/**
 * Parse hash fragment into key-value map (e.g. #access=...&refresh=...).
 */
function parseFragment(fragment: string): Record<string, string> {
  const params: Record<string, string> = {}
  if (!fragment.startsWith('#')) return params
  const query = fragment.slice(1)
  for (const part of query.split('&')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = decodeURIComponent(part.slice(0, eq).trim())
    const value = decodeURIComponent(part.slice(eq + 1).trim())
    if (key && value) params[key] = value
  }
  return params
}

export function AuthCallbackScreen() {
  const { loginWithOAuthTokens, clearError } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    clearError()

    const params = parseFragment(location.hash)
    const access = params.access
    const refresh = params.refresh

    if (!access || !refresh) {
      setStatus('error')
      setMessage('Missing sign-in data. Please try again from the login page.')
      return
    }

    loginWithOAuthTokens(access, refresh)
      .then(() => {
        if (!cancelled) navigate('/', { replace: true })
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error')
          setMessage('Sign-in failed. Please try again or use email and password.')
        }
      })

    return () => {
      cancelled = true
    }
    // Run once on mount with current hash (OAuth redirect lands here with fragment).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (status === 'error') {
    return (
      <main
        id="auth-callback-screen"
        className="auth-screen"
        aria-label="Sign-in result"
      >
        <h1 id="auth-callback-title">Sign-in issue</h1>
        <p id="auth-callback-error" className="auth-error" role="alert">
          {message}
        </p>
        <p id="auth-callback-links">
          <Link id="auth-callback-login-link" to="/login">
            Back to log in
          </Link>
        </p>
      </main>
    )
  }

  return (
    <main
      id="auth-callback-screen"
      className="auth-screen"
      aria-label="Completing sign-in"
      aria-busy="true"
    >
      <p id="auth-callback-loading">Completing sign-in…</p>
    </main>
  )
}
