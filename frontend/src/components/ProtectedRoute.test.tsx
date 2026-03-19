import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import { ProtectedRoute } from './ProtectedRoute'

vi.mock('../contexts/useAuth', () => ({
  useAuth: vi.fn(),
}))

const mockUseAuth = vi.mocked(useAuth)

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading when auth is loading', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      loading: true,
      user: null,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      loginWithOAuthTokens: vi.fn(),
      logout: vi.fn(),
      requestPasswordReset: vi.fn(),
      confirmPasswordReset: vi.fn(),
      clearError: vi.fn(),
      updateUser: vi.fn(),
      getApiDeps: vi.fn(),
    })
    render(
      <MemoryRouter>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <span id="protected-child">Protected content</span>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<span id="login-page">Login</span>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('redirects to /login when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      loading: false,
      user: null,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      loginWithOAuthTokens: vi.fn(),
      logout: vi.fn(),
      requestPasswordReset: vi.fn(),
      confirmPasswordReset: vi.fn(),
      clearError: vi.fn(),
      updateUser: vi.fn(),
      getApiDeps: vi.fn(),
    })
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <span id="protected-child">Protected content</span>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<span id="login-page">Login</span>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Login')).toBeInTheDocument()
    expect(document.getElementById('protected-child')).not.toBeInTheDocument()
  })

  it('renders children when authenticated and profile complete', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: {
        id: 1,
        email: 'u@ex.com',
        username: 'u',
        timezone: 'UTC',
        needs_profile_completion: false,
      },
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      loginWithOAuthTokens: vi.fn(),
      logout: vi.fn(),
      requestPasswordReset: vi.fn(),
      confirmPasswordReset: vi.fn(),
      clearError: vi.fn(),
      updateUser: vi.fn(),
      getApiDeps: vi.fn(),
    })
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <span id="protected-child">Protected content</span>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<span id="login-page">Login</span>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })

  it('redirects to /profile when authenticated but needs_profile_completion', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: {
        id: 1,
        email: 'u@ex.com',
        username: 'user_abc',
        timezone: 'UTC',
        needs_profile_completion: true,
      },
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      loginWithOAuthTokens: vi.fn(),
      logout: vi.fn(),
      requestPasswordReset: vi.fn(),
      confirmPasswordReset: vi.fn(),
      clearError: vi.fn(),
      updateUser: vi.fn(),
      getApiDeps: vi.fn(),
    })
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <span id="protected-child">Protected content</span>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={<span id="profile-page">Profile</span>}
          />
          <Route path="/login" element={<span id="login-page">Login</span>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(document.getElementById('protected-child')).not.toBeInTheDocument()
  })
})
