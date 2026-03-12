/**
 * Auth types: user payload and token responses from the API.
 */

export interface AuthUser {
  id: number
  email: string
  username: string
  timezone: string
}

export interface LoginRegisterResponse {
  user: AuthUser
  access: string
  refresh: string
}

export interface TokenRefreshResponse {
  access: string
}
