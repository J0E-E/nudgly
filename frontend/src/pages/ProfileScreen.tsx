/**
 * Profile screen: when needs_profile_completion shows required completion form
 * (username accept/change + password); otherwise shows email, username, timezone and link to settings.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import * as profileApi from '../services/profileApi'
import './AuthScreens.css'
import './ProfileScreen.css'

export function ProfileScreen() {
  const { user, getApiDeps, updateUser, error, clearError } = useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [completionUsername, setCompletionUsername] = useState('')
  const [completionPassword, setCompletionPassword] = useState('')
  const [completionConfirmPassword, setCompletionConfirmPassword] = useState('')

  useEffect(() => {
    if (user?.username) setCompletionUsername(user.username)
  }, [user?.username])

  const needsCompletion = user?.needs_profile_completion === true

  async function handleCompleteSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    setConfirmError(null)
    if (completionPassword !== completionConfirmPassword) {
      setConfirmError('Passwords do not match.')
      return
    }
    if (!user) return
    setSubmitting(true)
    try {
      const deps = getApiDeps()
      const updated = await profileApi.updateProfile(deps, {
        password: completionPassword,
        username: completionUsername.trim(),
      })
      updateUser(updated)
      navigate('/', { replace: true })
    } catch {
      // error set in context or from API
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) {
    return (
      <main id="profile-screen" className="auth-screen" aria-label="Profile">
        <p id="profile-loading">Loading…</p>
      </main>
    )
  }

  if (needsCompletion) {
    return (
      <main
        id="profile-screen"
        className="auth-screen"
        aria-label="Complete your profile"
      >
        <h1 id="profile-complete-title">Complete your profile</h1>
        <p id="profile-complete-intro" className="auth-message">
          Set a username and password to finish setting up your account.
        </p>
        <form
          id="profile-complete-form"
          onSubmit={handleCompleteSubmit}
          noValidate
        >
          {error && (
            <p id="profile-complete-error" className="auth-error" role="alert">
              {error}
            </p>
          )}
          <div id="profile-complete-username-group" className="auth-field">
            <label
              id="profile-complete-username-label"
              htmlFor="profile-complete-username-input"
            >
              Username
            </label>
            <input
              id="profile-complete-username-input"
              type="text"
              autoComplete="username"
              value={completionUsername}
              onChange={(e) => setCompletionUsername(e.target.value)}
              required
              disabled={submitting}
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_]+"
              title="Letters, numbers, and underscores only (3–30 characters)"
            />
          </div>
          <div id="profile-complete-password-group" className="auth-field">
            <label
              id="profile-complete-password-label"
              htmlFor="profile-complete-password-input"
            >
              Password
            </label>
            <input
              id="profile-complete-password-input"
              type="password"
              autoComplete="new-password"
              value={completionPassword}
              onChange={(e) => setCompletionPassword(e.target.value)}
              required
              disabled={submitting}
              minLength={8}
              title="At least 8 characters, one letter and one number"
            />
          </div>
          <div id="profile-complete-confirm-group" className="auth-field">
            <label
              id="profile-complete-confirm-label"
              htmlFor="profile-complete-confirm-input"
            >
              Confirm password
            </label>
            <input
              id="profile-complete-confirm-input"
              type="password"
              autoComplete="new-password"
              value={completionConfirmPassword}
              onChange={(e) => {
                setCompletionConfirmPassword(e.target.value)
                if (confirmError) setConfirmError(null)
              }}
              required
              disabled={submitting}
              minLength={8}
              aria-describedby={
                confirmError ? 'profile-complete-confirm-error' : undefined
              }
            />
            {confirmError && (
              <p
                id="profile-complete-confirm-error"
                className="auth-error"
                role="alert"
              >
                {confirmError}
              </p>
            )}
          </div>
          <button
            id="profile-complete-submit-btn"
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? 'Saving…' : 'Complete profile'}
          </button>
        </form>
      </main>
    )
  }

  return (
    <main id="profile-screen" className="profile-view" aria-label="Profile">
      <h1 id="profile-screen-title">Profile</h1>
      <dl id="profile-details-list">
        <div id="profile-email-row">
          <dt id="profile-email-label">Email</dt>
          <dd id="profile-email-value">{user.email}</dd>
        </div>
        <div id="profile-username-row">
          <dt id="profile-username-label">Username</dt>
          <dd id="profile-username-value">@{user.username}</dd>
        </div>
        <div id="profile-timezone-row">
          <dt id="profile-timezone-label">Timezone</dt>
          <dd id="profile-timezone-value">{user.timezone}</dd>
        </div>
      </dl>
      <p id="profile-settings-link-wrap">
        <Link id="profile-settings-link" to="/settings">
          Settings
        </Link>
      </p>
    </main>
  )
}
