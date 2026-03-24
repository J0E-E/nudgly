/**
 * Minimal app header: app name, @username (link to profile), and logout when authenticated.
 */

import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import { NotificationBell } from './NotificationBell'
import './AppHeader.css'

const iconProps = {
  className: 'app-header-nav-icon',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
}

export function AppHeader() {
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (path: string) => location.pathname.startsWith(path)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header id="app-header" role="banner">
      <h1 id="app-header-title">Nudgly</h1>
      {isAuthenticated && (
        <nav id="app-header-nav" aria-label="Main navigation">
          <Link
            to="/tasks"
            className={`app-header-nav-link${isActive('/tasks') ? ' app-header-nav-link--active' : ''}`}
          >
            <svg {...iconProps}>
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            <span className="app-header-nav-label">Tasks</span>
          </Link>
          <Link
            to="/lists"
            className={`app-header-nav-link${isActive('/lists') ? ' app-header-nav-link--active' : ''}`}
          >
            <svg {...iconProps}>
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            <span className="app-header-nav-label">Lists</span>
          </Link>
        </nav>
      )}
      {isAuthenticated && (
        <div id="app-header-actions">
          <NotificationBell />
          <Link
            to="/profile"
            className={`app-header-nav-link${isActive('/profile') ? ' app-header-nav-link--active' : ''}`}
            aria-label={`Profile for ${user?.username ?? 'user'}`}
          >
            <svg {...iconProps}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="app-header-nav-label">Profile</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="app-header-nav-link"
            aria-label="Log out"
          >
            <svg {...iconProps}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="app-header-nav-label">Log out</span>
          </button>
        </div>
      )}
    </header>
  )
}
