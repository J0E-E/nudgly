import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BottomNav } from './BottomNav'

vi.mock('../contexts/useAuth', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
  })),
}))

import { useAuth } from '../contexts/useAuth'

function renderNav(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <BottomNav />
    </MemoryRouter>
  )
}

describe('BottomNav', () => {
  it('renders My Day as the first nav item', () => {
    renderNav()
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveTextContent('My Day')
    expect(links[0]).toHaveAttribute('href', '/my-day')
  })

  it('renders all 5 nav items', () => {
    renderNav()
    expect(screen.getByText('My Day')).toBeInTheDocument()
    expect(screen.getByText('Tasks')).toBeInTheDocument()
    expect(screen.getByText('Lists')).toBeInTheDocument()
    expect(screen.getByText('Habits')).toBeInTheDocument()
    expect(screen.getByText('Reminders')).toBeInTheDocument()
  })

  it('marks My Day as active when on /my-day', () => {
    renderNav(['/my-day'])
    const link = screen.getByText('My Day').closest('a')
    expect(link?.className).toContain('bottom-nav-item--active')
  })

  it('does not mark My Day as active on other routes', () => {
    renderNav(['/tasks'])
    const link = screen.getByText('My Day').closest('a')
    expect(link?.className).not.toContain('bottom-nav-item--active')
  })

  it('returns null when not authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: false } as ReturnType<typeof useAuth>)
    const { container } = renderNav()
    expect(container.firstChild).toBeNull()
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true } as ReturnType<typeof useAuth>)
  })
})
