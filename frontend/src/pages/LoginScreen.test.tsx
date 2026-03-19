import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LoginScreen } from './LoginScreen'
import { useAuth } from '../contexts/useAuth'

vi.mock('../contexts/useAuth', () => ({
  useAuth: vi.fn(),
}))

const mockUseAuth = vi.mocked(useAuth)

describe('LoginScreen', () => {
  const mockLogin = vi.fn()
  const mockClearError = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      login: mockLogin,
      error: null,
      clearError: mockClearError,
      user: null,
      loading: false,
      isAuthenticated: false,
      register: vi.fn(),
      loginWithOAuthTokens: vi.fn(),
      logout: vi.fn(),
      requestPasswordReset: vi.fn(),
      confirmPasswordReset: vi.fn(),
      updateUser: vi.fn(),
      getApiDeps: vi.fn(),
    })
  })

  it('renders login form with email and password fields', () => {
    render(
      <MemoryRouter>
        <LoginScreen />
      </MemoryRouter>
    )
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(document.getElementById('login-submit-btn')).toBeInTheDocument()
  })

  it('has unique descriptive IDs for form elements', () => {
    render(
      <MemoryRouter>
        <LoginScreen />
      </MemoryRouter>
    )
    expect(document.getElementById('login-form')).toBeInTheDocument()
    expect(document.getElementById('login-email-input')).toBeInTheDocument()
    expect(document.getElementById('login-password-input')).toBeInTheDocument()
    expect(document.getElementById('login-submit-btn')).toBeInTheDocument()
  })

  it('calls login with email and password on submit', async () => {
    mockLogin.mockResolvedValue(undefined)
    render(
      <MemoryRouter>
        <LoginScreen />
      </MemoryRouter>
    )
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Pass1234' },
    })
    fireEvent.click(document.getElementById('login-submit-btn')!)
    expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'Pass1234')
  })

  it('renders OAuth sign-in buttons with correct authorize URLs', () => {
    render(
      <MemoryRouter>
        <LoginScreen />
      </MemoryRouter>
    )
    const googleBtn = document.getElementById('login-oauth-google-btn')
    const appleBtn = document.getElementById('login-oauth-apple-btn')
    expect(googleBtn).toBeInTheDocument()
    expect(appleBtn).toBeInTheDocument()
    expect(googleBtn).toHaveAttribute('href', expect.stringContaining('/api/auth/oauth/google/authorize/'))
    expect(googleBtn).toHaveAttribute('aria-label', 'Sign in with Google')
    expect(appleBtn).toHaveAttribute('aria-disabled', 'true')
    expect(appleBtn).toHaveAttribute('aria-label', 'Sign in with Apple (coming soon)')
  })

  it('displays error from auth context', () => {
    mockUseAuth.mockReturnValue({
      error: 'Invalid email or password.',
      clearError: mockClearError,
      login: mockLogin,
      user: null,
      loading: false,
      isAuthenticated: false,
      register: vi.fn(),
      loginWithOAuthTokens: vi.fn(),
      updateUser: vi.fn(),
      logout: vi.fn(),
      requestPasswordReset: vi.fn(),
      confirmPasswordReset: vi.fn(),
      getApiDeps: vi.fn(),
    })
    render(
      <MemoryRouter>
        <LoginScreen />
      </MemoryRouter>
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Invalid email or password.'
    )
  })

  it('shows OAuth error message when redirected with oauth_error=not_authenticated', () => {
    render(
      <MemoryRouter initialEntries={['/login?oauth_error=not_authenticated']}>
        <LoginScreen />
      </MemoryRouter>
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Sign-in was cancelled or failed. Please try again or use email and password.'
    )
  })
})
