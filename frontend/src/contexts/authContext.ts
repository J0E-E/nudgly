/**
 * Auth context and types. No components—use AuthProvider and useAuth for UI.
 */
import { createContext } from 'react'
import type { AuthUser } from '../types/auth'

export interface AuthState {
  user: AuthUser | null
  loading: boolean
  error: string | null
  isAuthenticated: boolean
}

export interface AuthActions {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  /** Apply tokens from OAuth callback and fetch user; used by AuthCallbackScreen. */
  loginWithOAuthTokens: (access: string, refresh: string) => Promise<void>
  logout: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  confirmPasswordReset: (token: string, newPassword: string) => Promise<void>
  clearError: () => void
}

export interface AuthContextValue extends AuthState, AuthActions {
  /** For use by apiClient: get access token, refresh, or handle unauth. */
  getApiDeps: () => {
    getAccessToken: () => string | null
    refreshTokens: () => Promise<string | null>
    onUnauthorized: () => void
  }
}

export const AuthContext = createContext<AuthContextValue | null>(null)
