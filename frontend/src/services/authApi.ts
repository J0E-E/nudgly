/**
 * Auth API: register, login, logout, password reset, me, refresh.
 * Unauthenticated endpoints use fetch; me/logout use apiClient with token.
 */

import { API_BASE_URL } from '../config/api'
import type { ApiClientDeps } from './apiClient'
import { authGet } from './apiClient'
import type { AuthUser, LoginRegisterResponse } from '../types/auth'
import { callRefresh } from './apiClient'

const AUTH_BASE = `${API_BASE_URL.replace(/\/$/, '')}/api/auth`

/** OAuth authorize URLs: backend redirects to provider. */
export function getGoogleAuthorizeUrl(): string {
  return `${AUTH_BASE}/oauth/google/authorize/`
}

export function getAppleAuthorizeUrl(): string {
  return `${AUTH_BASE}/oauth/apple/authorize/`
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    let message = `Request failed: ${res.status}`
    try {
      const j = JSON.parse(text) as {
        detail?: string
        email?: string[]
        username?: string[]
        password?: string[]
      }
      const detail =
        j.detail ??
        [j.email, j.username, j.password].flat().filter(Boolean).join(' ')
      if (detail) message = detail
    } catch {
      if (text) message = text
    }
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

/**
 * Register: POST /api/auth/register/; returns user + access + refresh.
 */
export async function register(body: {
  email: string
  username: string
  password: string
}): Promise<LoginRegisterResponse> {
  const res = await fetch(`${AUTH_BASE}/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return parseOrThrow<LoginRegisterResponse>(res)
}

/**
 * Login: POST /api/auth/login/; returns user + access + refresh.
 */
export async function login(body: {
  email: string
  password: string
}): Promise<LoginRegisterResponse> {
  const res = await fetch(`${AUTH_BASE}/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return parseOrThrow<LoginRegisterResponse>(res)
}

/**
 * Logout: POST /api/auth/logout/ with refresh token in body (blacklist).
 */
export async function logout(refreshToken: string): Promise<void> {
  const res = await fetch(`${AUTH_BASE}/logout/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: refreshToken }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Logout failed: ${res.status} ${text}`)
  }
}

/**
 * Password reset request: POST /api/auth/password-reset/; no user enumeration.
 */
export async function passwordResetRequest(email: string): Promise<void> {
  const res = await fetch(`${AUTH_BASE}/password-reset/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) await parseOrThrow(res)
}

/**
 * Password reset confirm: POST /api/auth/password-reset/confirm/ with token and new_password.
 */
export async function passwordResetConfirm(
  token: string,
  newPassword: string
): Promise<void> {
  const res = await fetch(`${AUTH_BASE}/password-reset/confirm/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, new_password: newPassword }),
  })
  if (!res.ok) await parseOrThrow(res)
}

/**
 * Refresh access token: POST /api/auth/token/refresh/ with refresh token.
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<string | null> {
  return callRefresh(refreshToken)
}

/**
 * Get current user: GET /api/auth/me/ (requires auth client deps).
 */
export async function getMe(deps: ApiClientDeps): Promise<AuthUser> {
  return authGet<AuthUser>(`${AUTH_BASE}/me/`, deps)
}

/**
 * Get current user with a raw access token (e.g. after OAuth callback).
 */
export async function getMeWithToken(accessToken: string): Promise<AuthUser> {
  const res = await fetch(`${AUTH_BASE}/me/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return parseOrThrow<AuthUser>(res)
}
