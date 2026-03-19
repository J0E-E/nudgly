import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RegisterScreen } from './RegisterScreen'
import { useAuth } from '../contexts/useAuth'

vi.mock('../contexts/useAuth', () => ({
  useAuth: vi.fn(),
}))

const mockUseAuth = vi.mocked(useAuth)

describe('RegisterScreen', () => {
  const mockRegister = vi.fn()
  const mockClearError = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      register: mockRegister,
      error: null,
      clearError: mockClearError,
      updateUser: vi.fn(),
      user: null,
      loading: false,
      isAuthenticated: false,
      login: vi.fn(),
      loginWithOAuthTokens: vi.fn(),
      logout: vi.fn(),
      requestPasswordReset: vi.fn(),
      confirmPasswordReset: vi.fn(),
      getApiDeps: vi.fn(),
    })
  })

  it('renders register form with email, username, password, and confirm password fields', () => {
    render(
      <MemoryRouter>
        <RegisterScreen />
      </MemoryRouter>
    )
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /create account/i })
    ).toBeInTheDocument()
  })

  it('has unique descriptive IDs for form elements', () => {
    render(
      <MemoryRouter>
        <RegisterScreen />
      </MemoryRouter>
    )
    expect(document.getElementById('register-form')).toBeInTheDocument()
    expect(document.getElementById('register-email-input')).toBeInTheDocument()
    expect(
      document.getElementById('register-username-input')
    ).toBeInTheDocument()
    expect(
      document.getElementById('register-password-input')
    ).toBeInTheDocument()
    expect(
      document.getElementById('register-password-confirm-input')
    ).toBeInTheDocument()
    expect(document.getElementById('register-submit-btn')).toBeInTheDocument()
  })

  it('calls register with email, username, and password on submit when passwords match', async () => {
    mockRegister.mockResolvedValue(undefined)
    render(
      <MemoryRouter>
        <RegisterScreen />
      </MemoryRouter>
    )
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'testuser' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Pass1234' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'Pass1234' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(mockRegister).toHaveBeenCalledWith(
      'test@example.com',
      'testuser',
      'Pass1234'
    )
  })

  it('shows error and does not call register when passwords do not match', () => {
    render(
      <MemoryRouter>
        <RegisterScreen />
      </MemoryRouter>
    )
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'testuser' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Pass1234' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'Different1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(mockRegister).not.toHaveBeenCalled()
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
  })

  it('renders OAuth sign-in buttons; Google has authorize URL, Apple is disabled', () => {
    render(
      <MemoryRouter>
        <RegisterScreen />
      </MemoryRouter>
    )
    const googleBtn = document.getElementById('register-oauth-google-btn')
    const appleBtn = document.getElementById('register-oauth-apple-btn')
    expect(googleBtn).toBeInTheDocument()
    expect(appleBtn).toBeInTheDocument()
    expect(googleBtn).toHaveAttribute('href', expect.stringContaining('/api/auth/oauth/google/authorize/'))
    expect(appleBtn).toHaveAttribute('aria-disabled', 'true')
  })

  it('displays error from auth context', () => {
    mockUseAuth.mockReturnValue({
      register: mockRegister,
      error: 'This username is already taken.',
      clearError: mockClearError,
      updateUser: vi.fn(),
      user: null,
      loading: false,
      isAuthenticated: false,
      login: vi.fn(),
      loginWithOAuthTokens: vi.fn(),
      logout: vi.fn(),
      requestPasswordReset: vi.fn(),
      confirmPasswordReset: vi.fn(),
      getApiDeps: vi.fn(),
    })
    render(
      <MemoryRouter>
        <RegisterScreen />
      </MemoryRouter>
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This username is already taken.'
    )
  })
})
