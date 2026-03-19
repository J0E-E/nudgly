/**
 * Auth types: user payload and token responses from the API.
 */

export interface AuthUser {
  id: number
  email: string
  username: string
  timezone: string
  display_name?: string
  /** True when user has no usable password (OAuth users who have not completed profile). */
  needs_profile_completion?: boolean
}

export interface LoginRegisterResponse {
  user: AuthUser
  access: string
  refresh: string
}

export interface TokenRefreshResponse {
  access: string
}
