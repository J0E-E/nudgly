import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import './BottomNav.css'

export function BottomNav() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) return null

  const isActive = (path: string) => location.pathname.startsWith(path)

  return (
    <nav id="bottom-nav" aria-label="Mobile navigation">
      <Link
        to="/tasks"
        className={`bottom-nav-item${isActive('/tasks') ? ' bottom-nav-item--active' : ''}`}
      >
        <svg
          className="bottom-nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
        <span className="bottom-nav-label">Tasks</span>
      </Link>
      <Link
        to="/lists"
        className={`bottom-nav-item${isActive('/lists') ? ' bottom-nav-item--active' : ''}`}
      >
        <svg
          className="bottom-nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
        <span className="bottom-nav-label">Lists</span>
      </Link>
      <Link
        to="/habits"
        className={`bottom-nav-item${isActive('/habits') ? ' bottom-nav-item--active' : ''}`}
      >
        <svg
          className="bottom-nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M17 1l4 4-4 4" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <path d="M7 23l-4-4 4-4" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
        <span className="bottom-nav-label">Habits</span>
      </Link>
      <Link
        to="/friends"
        className={`bottom-nav-item${isActive('/friends') ? ' bottom-nav-item--active' : ''}`}
      >
        <svg
          className="bottom-nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span className="bottom-nav-label">Friends</span>
      </Link>
    </nav>
  )
}
