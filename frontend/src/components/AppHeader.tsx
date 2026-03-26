/**
 * Minimal app header: app name, @username (link to profile), and logout when authenticated.
 */

import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import { NotificationBell } from './NotificationBell'
import logoSvg from '../assets/logo.svg'
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
      <Link to="/" id="app-header-brand">
        <img src={logoSvg} alt="" id="app-header-logo" />
        <span id="app-header-title">udgly</span>
      </Link>
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
          <Link
            to="/habits"
            className={`app-header-nav-link${isActive('/habits') ? ' app-header-nav-link--active' : ''}`}
          >
            <svg {...iconProps}>
              <path d="M17 1l4 4-4 4" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <path d="M7 23l-4-4 4-4" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            <span className="app-header-nav-label">Habits</span>
          </Link>
          <Link
            to="/reminders"
            className={`app-header-nav-link${isActive('/reminders') ? ' app-header-nav-link--active' : ''}`}
          >
            <svg {...iconProps}>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span className="app-header-nav-label">Reminders</span>
          </Link>
        </nav>
      )}
      {isAuthenticated && (
        <div id="app-header-actions">
          <NotificationBell />
          <div className="app-header-hamburger">
            <button
              type="button"
              className="app-header-nav-link app-header-hamburger-btn"
              aria-label="Menu"
              aria-haspopup="true"
            >
              <svg {...iconProps}>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              <span className="app-header-nav-label">Menu</span>
            </button>
            <div className="app-header-dropdown" role="menu">
              <Link
                to="/friends"
                className={`app-header-dropdown-item${isActive('/friends') ? ' app-header-dropdown-item--active' : ''}`}
                role="menuitem"
              >
                <svg {...iconProps}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Friends
              </Link>
              <Link
                to="/profile"
                className={`app-header-dropdown-item${isActive('/profile') ? ' app-header-dropdown-item--active' : ''}`}
                role="menuitem"
                aria-label={`Profile for ${user?.username ?? 'user'}`}
              >
                <svg {...iconProps}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Profile
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="app-header-dropdown-item"
                role="menuitem"
              >
                <svg {...iconProps}>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
