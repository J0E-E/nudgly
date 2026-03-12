import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { PasswordResetConfirmScreen } from './PasswordResetConfirmScreen'
import { useAuth } from '../contexts/useAuth'

vi.mock('../contexts/useAuth', () => ({
  useAuth: vi.fn(),
}))

const mockUseAuth = vi.mocked(useAuth)

/** Renders screen with token in URL query; use initialPath to set ?token=... */
function renderWithToken(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/reset-password/confirm"
          element={<PasswordResetConfirmScreen />}
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('PasswordResetConfirmScreen', () => {
  const mockConfirmPasswordReset = vi.fn()
  const mockClearError = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      confirmPasswordReset: mockConfirmPasswordReset,
      error: null,
      clearError: mockClearError,
      user: null,
      loading: false,
      isAuthenticated: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      requestPasswordReset: vi.fn(),
      getApiDeps: vi.fn(),
    })
  })

  it('shows missing-token message when token is absent', () => {
    renderWithToken('/reset-password/confirm')
    expect(
      screen.getByText(/missing or invalid reset link/i)
    ).toBeInTheDocument()
  })

  it('renders form with new password and confirm when token is present', () => {
    renderWithToken('/reset-password/confirm?token=valid-reset-token')
    expect(screen.getByLabelText('New password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /update password/i })
    ).toBeInTheDocument()
  })

  it('has unique descriptive IDs for form elements', () => {
    renderWithToken('/reset-password/confirm?token=valid-reset-token')
    expect(
      document.getElementById('password-reset-confirm-form')
    ).toBeInTheDocument()
    expect(
      document.getElementById('password-reset-confirm-password-input')
    ).toBeInTheDocument()
    expect(
      document.getElementById('password-reset-confirm-confirm-input')
    ).toBeInTheDocument()
    expect(
      document.getElementById('password-reset-confirm-submit-btn')
    ).toBeInTheDocument()
  })

  it('calls confirmPasswordReset with token and new password on submit', async () => {
    mockConfirmPasswordReset.mockResolvedValue(undefined)
    renderWithToken('/reset-password/confirm?token=valid-reset-token')
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'NewPass123' },
    })
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'NewPass123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))
    expect(mockConfirmPasswordReset).toHaveBeenCalledWith(
      'valid-reset-token',
      'NewPass123'
    )
  })

  it('shows success message after successful submit', async () => {
    mockConfirmPasswordReset.mockResolvedValue(undefined)
    renderWithToken('/reset-password/confirm?token=valid-reset-token')
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'NewPass123' },
    })
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'NewPass123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))
    expect(
      await screen.findByText(/your password has been reset/i)
    ).toBeInTheDocument()
  })

  it('disables submit when passwords do not match', () => {
    renderWithToken('/reset-password/confirm?token=valid-reset-token')
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'NewPass123' },
    })
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'OtherPass456' },
    })
    const submitBtn = screen.getByRole('button', { name: /update password/i })
    expect(submitBtn).toBeDisabled()
  })

  it('displays error from auth context', () => {
    mockUseAuth.mockReturnValue({
      confirmPasswordReset: mockConfirmPasswordReset,
      error: 'Invalid or expired reset token.',
      clearError: mockClearError,
      user: null,
      loading: false,
      isAuthenticated: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      requestPasswordReset: vi.fn(),
      getApiDeps: vi.fn(),
    })
    renderWithToken('/reset-password/confirm?token=valid-reset-token')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Invalid or expired reset token.'
    )
  })
})
