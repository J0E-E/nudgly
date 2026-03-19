/**
 * Minimal app header: app name, @username (link to profile), and logout when authenticated.
 */

import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import './AppHeader.css'

export function AppHeader() {
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header id="app-header" role="banner">
      <h1 id="app-header-title">Nudgly</h1>
      {isAuthenticated && (
        <div id="app-header-actions">
          <Link
            id="app-header-username"
            to="/profile"
            aria-label={`Profile for ${user?.username ?? 'user'}`}
          >
            @{user?.username ?? '…'}
          </Link>
          <button
            id="app-header-logout-btn"
            type="button"
            onClick={handleLogout}
            aria-label="Log out"
          >
            Log out
          </button>
        </div>
      )}
    </header>
  )
}
