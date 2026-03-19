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
  /** Apply tokens from OAuth callback and fetch user; returns user for redirect logic (e.g. needs_profile_completion). */
  loginWithOAuthTokens: (access: string, refresh: string) => Promise<AuthUser | null>
  logout: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  confirmPasswordReset: (token: string, newPassword: string) => Promise<void>
  clearError: () => void
  /** Update stored user (e.g. after profile completion PATCH). */
  updateUser: (user: AuthUser) => void
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
