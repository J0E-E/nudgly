/**
 * Device token API: register and deactivate push notification tokens.
 */

import { API_BASE_URL } from '../config/api'
import type { ApiClientDeps } from './apiClient'
import { authPost, authDelete } from './apiClient'

const DEVICES_BASE = `${API_BASE_URL.replace(/\/$/, '')}/api/devices`

export async function registerDevice(
  deps: ApiClientDeps,
  token: string,
  platform: 'ios' | 'android' | 'web'
): Promise<void> {
  await authPost(`${DEVICES_BASE}/register/`, { token, platform }, deps)
}

export async function deactivateDevice(
  deps: ApiClientDeps,
  token: string
): Promise<void> {
  await authDelete(`${DEVICES_BASE}/${encodeURIComponent(token)}/`, deps)
}
