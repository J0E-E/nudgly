import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppHeader } from './AppHeader'

vi.mock('../contexts/useAuth', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    user: { username: 'testuser' },
    logout: vi.fn(),
  })),
}))

vi.mock('./NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}))

function renderHeader(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AppHeader />
    </MemoryRouter>
  )
}

describe('AppHeader', () => {
  it('renders My Day nav link when authenticated', () => {
    renderHeader()
    expect(screen.getByText('My Day')).toBeInTheDocument()
  })

  it('renders My Day as the first nav item', () => {
    renderHeader()
    const navLinks = screen.getAllByRole('link').filter(
      (link) => link.className.includes('app-header-nav-link')
    )
    expect(navLinks[0]).toHaveTextContent('My Day')
    expect(navLinks[0]).toHaveAttribute('href', '/my-day')
  })

  it('marks My Day as active on /my-day route', () => {
    renderHeader(['/my-day'])
    const link = screen.getByText('My Day').closest('a')
    expect(link?.className).toContain('app-header-nav-link--active')
  })

  it('renders all 5 nav items', () => {
    renderHeader()
    expect(screen.getByText('My Day')).toBeInTheDocument()
    expect(screen.getByText('Tasks')).toBeInTheDocument()
    expect(screen.getByText('Lists')).toBeInTheDocument()
    expect(screen.getByText('Habits')).toBeInTheDocument()
    expect(screen.getByText('Reminders')).toBeInTheDocument()
  })
})
