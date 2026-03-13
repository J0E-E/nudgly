import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthCallbackScreen } from './AuthCallbackScreen'
import { useAuth } from '../contexts/useAuth'

vi.mock('../contexts/useAuth', () => ({
  useAuth: vi.fn(),
}))

const mockUseAuth = vi.mocked(useAuth)

describe('AuthCallbackScreen', () => {
  const mockLoginWithOAuthTokens = vi.fn()
  const mockClearError = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      loginWithOAuthTokens: mockLoginWithOAuthTokens,
      clearError: mockClearError,
      user: null,
      loading: false,
      error: null,
      isAuthenticated: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      requestPasswordReset: vi.fn(),
      confirmPasswordReset: vi.fn(),
      getApiDeps: vi.fn(),
    })
  })

  it('shows error when fragment has no access or refresh', async () => {
    render(
      <MemoryRouter initialEntries={['/auth/callback']}>
        <AuthCallbackScreen />
      </MemoryRouter>
    )
    await vi.waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(screen.getByText(/missing sign-in data/i)).toBeInTheDocument()
    expect(document.getElementById('auth-callback-login-link')).toHaveAttribute(
      'href',
      '/login'
    )
    expect(mockLoginWithOAuthTokens).not.toHaveBeenCalled()
  })

  it('calls loginWithOAuthTokens when fragment has access and refresh', async () => {
    mockLoginWithOAuthTokens.mockResolvedValue(undefined)
    render(
      <MemoryRouter initialEntries={['/auth/callback#access=at&refresh=rt']}>
        <AuthCallbackScreen />
      </MemoryRouter>
    )
    await vi.waitFor(() => {
      expect(mockLoginWithOAuthTokens).toHaveBeenCalledWith('at', 'rt')
    })
  })

  it('shows error state when loginWithOAuthTokens rejects', async () => {
    mockLoginWithOAuthTokens.mockRejectedValue(new Error('Network error'))
    render(
      <MemoryRouter initialEntries={['/auth/callback#access=at&refresh=rt']}>
        <AuthCallbackScreen />
      </MemoryRouter>
    )
    await vi.waitFor(() => {
      expect(screen.getByText(/sign-in failed/i)).toBeInTheDocument()
    })
    expect(document.getElementById('auth-callback-login-link')).toBeInTheDocument()
  })

  it('has unique descriptive IDs for callback UI', async () => {
    render(
      <MemoryRouter initialEntries={['/auth/callback']}>
        <AuthCallbackScreen />
      </MemoryRouter>
    )
    await vi.waitFor(() => {
      expect(document.getElementById('auth-callback-screen')).toBeInTheDocument()
    })
    expect(document.getElementById('auth-callback-title')).toBeInTheDocument()
    expect(document.getElementById('auth-callback-login-link')).toBeInTheDocument()
  })
})
