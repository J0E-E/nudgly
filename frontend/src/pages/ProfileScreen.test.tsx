import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProfileScreen } from './ProfileScreen'
import { useAuth } from '../contexts/useAuth'

vi.mock('../contexts/useAuth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../services/profileApi', () => ({
  updateProfile: vi.fn(),
}))

const mockUseAuth = vi.mocked(useAuth)

describe('ProfileScreen', () => {
  const mockGetApiDeps = vi.fn()
  const mockUpdateUser = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: {
        id: 1,
        email: 'u@ex.com',
        username: 'myuser',
        timezone: 'UTC',
        needs_profile_completion: false,
      },
      getApiDeps: mockGetApiDeps,
      updateUser: mockUpdateUser,
      error: null,
      clearError: vi.fn(),
      loading: false,
      isAuthenticated: true,
      login: vi.fn(),
      register: vi.fn(),
      loginWithOAuthTokens: vi.fn(),
      logout: vi.fn(),
      requestPasswordReset: vi.fn(),
      confirmPasswordReset: vi.fn(),
    })
  })

  it('renders profile view with email, username, timezone and Settings link when complete', () => {
    render(
      <MemoryRouter>
        <ProfileScreen />
      </MemoryRouter>
    )
    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(document.getElementById('profile-email-value')).toHaveTextContent(
      'u@ex.com'
    )
    expect(document.getElementById('profile-username-value')).toHaveTextContent(
      '@myuser'
    )
    expect(document.getElementById('profile-timezone-value')).toHaveTextContent(
      'UTC'
    )
    const settingsLink = document.getElementById('profile-settings-link')
    expect(settingsLink).toBeInTheDocument()
    expect(settingsLink).toHaveAttribute('href', '/settings')
  })

  it('renders Complete your profile form when needs_profile_completion', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 1,
        email: 'u@ex.com',
        username: 'user_abc123',
        timezone: 'UTC',
        needs_profile_completion: true,
      },
      getApiDeps: mockGetApiDeps,
      updateUser: mockUpdateUser,
      error: null,
      clearError: vi.fn(),
      loading: false,
      isAuthenticated: true,
      login: vi.fn(),
      register: vi.fn(),
      loginWithOAuthTokens: vi.fn(),
      logout: vi.fn(),
      requestPasswordReset: vi.fn(),
      confirmPasswordReset: vi.fn(),
    })
    render(
      <MemoryRouter>
        <ProfileScreen />
      </MemoryRouter>
    )
    expect(
      screen.getByRole('heading', { name: /complete your profile/i })
    ).toBeInTheDocument()
    expect(
      document.getElementById('profile-complete-username-input')
    ).toBeInTheDocument()
    expect(
      document.getElementById('profile-complete-password-input')
    ).toBeInTheDocument()
    expect(
      document.getElementById('profile-complete-confirm-input')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /complete profile/i })
    ).toBeInTheDocument()
  })
})
