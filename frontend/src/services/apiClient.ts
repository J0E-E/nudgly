/**
 * API client: attaches JWT and handles 401 with refresh.
 * Injected getAccessToken/refresh/onUnauthorized for testability and auth context integration.
 */

import { API_BASE_URL } from '../config/api'

const AUTH_BASE = `${API_BASE_URL.replace(/\/$/, '')}/api/auth`

export interface ApiClientDeps {
  getAccessToken: () => string | null
  refreshTokens: () => Promise<string | null>
  onUnauthorized: () => void
}

/**
 * Build headers for a request: optional Bearer token from getAccessToken.
 */
function buildHeaders(
  init: HeadersInit | undefined,
  getAccessToken: () => string | null
): Headers {
  const headers = new Headers(init)
  const token = getAccessToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return headers
}

/**
 * Call the token refresh endpoint; returns new access token or null.
 */
export async function callRefresh(
  refreshToken: string
): Promise<string | null> {
  const res = await fetch(`${AUTH_BASE}/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: refreshToken }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { access: string }
  return data.access ?? null
}

/**
 * Fetch with auth: adds Bearer token; on 401 tries refresh once then retries; on failure calls onUnauthorized.
 */
export async function authFetch(
  url: string,
  options: RequestInit,
  deps: ApiClientDeps
): Promise<Response> {
  const { getAccessToken, refreshTokens, onUnauthorized } = deps
  let res = await fetch(url, {
    ...options,
    headers: buildHeaders(options.headers, getAccessToken),
  })
  if (res.status === 401) {
    const newAccess = await refreshTokens()
    if (newAccess) {
      res = await fetch(url, {
        ...options,
        headers: buildHeaders(options.headers, () => newAccess),
      })
    }
    if (res.status === 401) {
      onUnauthorized()
    }
  }
  return res
}

/**
 * GET url with auth; returns parsed JSON or throws.
 */
export async function authGet<T>(url: string, deps: ApiClientDeps): Promise<T> {
  const res = await authFetch(url, { method: 'GET' }, deps)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Request failed: ${res.status} ${text}`)
  }
  return res.json() as Promise<T>
}

/**
 * POST url with auth and optional body; returns parsed JSON or throws.
 */
export async function authPost<T>(
  url: string,
  body: unknown,
  deps: ApiClientDeps
): Promise<T> {
  const res = await authFetch(
    url,
    { method: 'POST', body: JSON.stringify(body) },
    deps
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Request failed: ${res.status} ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
