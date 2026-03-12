/**
 * Minimal app header: app name and logout when authenticated.
 */

import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import './AppHeader.css'

export function AppHeader() {
  const { isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header id="app-header" role="banner">
      <h1 id="app-header-title">Nudgly</h1>
      {isAuthenticated && (
        <button
          id="app-header-logout-btn"
          type="button"
          onClick={handleLogout}
          aria-label="Log out"
        >
          Log out
        </button>
      )}
    </header>
  )
}
