/**
 * Profile API: GET and PATCH /api/users/me/.
 * Used for profile view and OAuth profile completion (password + username).
 */

import { API_BASE_URL } from '../config/api'
import type { ApiClientDeps } from './apiClient'
import { authGet, authPatch } from './apiClient'
import type { AuthUser } from '../types/auth'

const USERS_ME = `${API_BASE_URL.replace(/\/$/, '')}/api/users/me/`

/**
 * GET /api/users/me/ — current user (same shape as auth/me).
 */
export async function getProfile(deps: ApiClientDeps): Promise<AuthUser> {
  return authGet<AuthUser>(USERS_ME, deps)
}

/**
 * PATCH /api/users/me/ — update timezone, display_name; or complete profile (password + username).
 */
export async function updateProfile(
  deps: ApiClientDeps,
  body: {
    timezone?: string
    display_name?: string
    password?: string
    username?: string
  }
): Promise<AuthUser> {
  return authPatch<AuthUser>(USERS_ME, body, deps)
}
