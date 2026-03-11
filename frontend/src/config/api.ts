/**
 * API base URL for backend requests.
 * Injected at build time via VITE_API_BASE_URL; default for dev.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
