/**
 * Auth provider: user, tokens, login, register, logout, password reset.
 * Restores session on load via refresh token; access token kept in memory.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import * as authApi from '../services/authApi'
import type { AuthUser, LoginRegisterResponse } from '../types/auth'
import { AuthContext } from './authContext'
import type { AuthContextValue } from './authContext'

const REFRESH_STORAGE_KEY = 'nudgly_refresh_token'

function loadStoredRefresh(): string | null {
  try {
    return localStorage.getItem(REFRESH_STORAGE_KEY)
  } catch {
    return null
  }
}

function saveRefresh(token: string | null): void {
  try {
    if (token) localStorage.setItem(REFRESH_STORAGE_KEY, token)
    else localStorage.removeItem(REFRESH_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState<string | null>(
    loadStoredRefresh
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const clearAuth = useCallback(() => {
    setUser(null)
    setAccessToken(null)
    setRefreshToken(null)
    saveRefresh(null)
  }, [])

  const refreshTokens = useCallback(async (): Promise<string | null> => {
    const stored = refreshToken ?? loadStoredRefresh()
    if (!stored) return null
    const access = await authApi.refreshAccessToken(stored)
    if (access) {
      setAccessToken(access)
      return access
    }
    clearAuth()
    return null
  }, [refreshToken, clearAuth])

  const onUnauthorized = useCallback(() => {
    clearAuth()
  }, [clearAuth])

  const getAccessToken = useCallback(() => accessToken, [accessToken])

  const getApiDeps = useCallback(
    () => ({
      getAccessToken,
      refreshTokens,
      onUnauthorized,
    }),
    [getAccessToken, refreshTokens, onUnauthorized]
  )

  /** Restore session on mount: if we have refresh, get new access and fetch me. */
  useEffect(() => {
    let cancelled = false
    const stored = loadStoredRefresh()
    if (!stored) {
      // Defer so setState isn't synchronous in effect (avoids cascading renders / lint)
      queueMicrotask(() => setLoading(false))
      return
    }
    authApi
      .refreshAccessToken(stored)
      .then((access) => {
        if (cancelled || !access) {
          if (!access) clearAuth()
          setLoading(false)
          return null
        }
        setAccessToken(access)
        setRefreshToken(stored)
        const deps = {
          getAccessToken: () => access,
          refreshTokens: async () => null,
          onUnauthorized: clearAuth,
        }
        return authApi.getMe(deps)
      })
      .then((u) => {
        if (cancelled) return
        if (u) setUser(u)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          clearAuth()
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [clearAuth])

  const login = useCallback(async (email: string, password: string) => {
    setError(null)
    try {
      const data: LoginRegisterResponse = await authApi.login({
        email,
        password,
      })
      setUser(data.user)
      setAccessToken(data.access)
      setRefreshToken(data.refresh)
      saveRefresh(data.refresh)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed')
      throw e
    }
  }, [])

  const register = useCallback(
    async (email: string, username: string, password: string) => {
      setError(null)
      try {
        const data: LoginRegisterResponse = await authApi.register({
          email,
          username,
          password,
        })
        setUser(data.user)
        setAccessToken(data.access)
        setRefreshToken(data.refresh)
        saveRefresh(data.refresh)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Registration failed')
        throw e
      }
    },
    []
  )

  const logout = useCallback(async () => {
    const stored = refreshToken ?? loadStoredRefresh()
    if (stored) {
      try {
        await authApi.logout(stored)
      } catch {
        // still clear local state
      }
    }
    clearAuth()
  }, [refreshToken, clearAuth])

  const requestPasswordReset = useCallback(async (email: string) => {
    setError(null)
    try {
      await authApi.passwordResetRequest(email)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
      throw e
    }
  }, [])

  const confirmPasswordReset = useCallback(
    async (token: string, newPassword: string) => {
      setError(null)
      try {
        await authApi.passwordResetConfirm(token, newPassword)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Reset failed')
        throw e
      }
    },
    []
  )

  const clearError = useCallback(() => setError(null), [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      requestPasswordReset,
      confirmPasswordReset,
      clearError,
      getApiDeps,
    }),
    [
      user,
      loading,
      error,
      login,
      register,
      logout,
      requestPasswordReset,
      confirmPasswordReset,
      clearError,
      getApiDeps,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
