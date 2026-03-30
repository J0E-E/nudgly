import { Capacitor } from '@capacitor/core'

/**
 * API base URL for backend requests.
 * - Web: empty string (relative URLs go through nginx on same origin)
 * - Android emulator: 10.0.2.2 is the alias for the host machine
 * - VITE_API_BASE_URL overrides everything (e.g. for Vite dev server)
 */
function resolveApiBaseUrl(): string {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }
  if (Capacitor.getPlatform() === 'android') {
    return 'http://10.0.2.2:9000'
  }
  return ''
}

export const API_BASE_URL = resolveApiBaseUrl()
