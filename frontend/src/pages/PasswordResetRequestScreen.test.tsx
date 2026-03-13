import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PasswordResetRequestScreen } from './PasswordResetRequestScreen'
import { useAuth } from '../contexts/useAuth'

vi.mock('../contexts/useAuth', () => ({
  useAuth: vi.fn(),
}))

const mockUseAuth = vi.mocked(useAuth)

describe('PasswordResetRequestScreen', () => {
  const mockRequestPasswordReset = vi.fn()
  const mockClearError = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      requestPasswordReset: mockRequestPasswordReset,
      error: null,
      clearError: mockClearError,
      user: null,
      loading: false,
      isAuthenticated: false,
      login: vi.fn(),
      register: vi.fn(),
      loginWithOAuthTokens: vi.fn(),
      logout: vi.fn(),
      confirmPasswordReset: vi.fn(),
      getApiDeps: vi.fn(),
    })
  })

  it('renders form with email field and submit button', () => {
    render(
      <MemoryRouter>
        <PasswordResetRequestScreen />
      </MemoryRouter>
    )
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /send reset link/i })
    ).toBeInTheDocument()
  })

  it('has unique descriptive IDs for form elements', () => {
    render(
      <MemoryRouter>
        <PasswordResetRequestScreen />
      </MemoryRouter>
    )
    expect(
      document.getElementById('password-reset-request-form')
    ).toBeInTheDocument()
    expect(
      document.getElementById('password-reset-request-email-input')
    ).toBeInTheDocument()
    expect(
      document.getElementById('password-reset-request-submit-btn')
    ).toBeInTheDocument()
  })

  it('calls requestPasswordReset with email on submit', async () => {
    mockRequestPasswordReset.mockResolvedValue(undefined)
    render(
      <MemoryRouter>
        <PasswordResetRequestScreen />
      </MemoryRouter>
    )
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))
    expect(mockRequestPasswordReset).toHaveBeenCalledWith('user@example.com')
  })

  it('shows success message after successful submit', async () => {
    mockRequestPasswordReset.mockResolvedValue(undefined)
    render(
      <MemoryRouter>
        <PasswordResetRequestScreen />
      </MemoryRouter>
    )
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))
    expect(
      await screen.findByText(/if an account exists for that email/i)
    ).toBeInTheDocument()
  })

  it('displays error from auth context', () => {
    mockUseAuth.mockReturnValue({
      requestPasswordReset: mockRequestPasswordReset,
      error: 'Request failed.',
      clearError: mockClearError,
      user: null,
      loading: false,
      isAuthenticated: false,
      login: vi.fn(),
      register: vi.fn(),
      loginWithOAuthTokens: vi.fn(),
      logout: vi.fn(),
      confirmPasswordReset: vi.fn(),
      getApiDeps: vi.fn(),
    })
    render(
      <MemoryRouter>
        <PasswordResetRequestScreen />
      </MemoryRouter>
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Request failed.')
  })
})
