import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LandingScreen } from './LandingScreen'

vi.mock('../contexts/useAuth', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: false,
    loading: false,
  })),
}))

import { useAuth } from '../contexts/useAuth'

describe('LandingScreen', () => {
  it('redirects to /my-day when authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true, loading: false } as ReturnType<typeof useAuth>)
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<LandingScreen />} />
          <Route path="/my-day" element={<div>My Day Screen</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('My Day Screen')).toBeInTheDocument()
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: false, loading: false } as ReturnType<typeof useAuth>)
  })

  it('shows landing page when not authenticated', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingScreen />
      </MemoryRouter>
    )
    expect(screen.getByText('Log in')).toBeInTheDocument()
    expect(screen.getByText('Create an account')).toBeInTheDocument()
  })

  it('returns null while loading', () => {
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: false, loading: true } as ReturnType<typeof useAuth>)
    const { container } = render(
      <MemoryRouter>
        <LandingScreen />
      </MemoryRouter>
    )
    expect(container.firstChild).toBeNull()
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: false, loading: false } as ReturnType<typeof useAuth>)
  })
})
