/**
 * Health API: fetch backend health status (API, database, redis).
 * Injectable: callers can pass baseUrl or use default from config.
 */

export interface HealthResponse {
  status: 'ok' | 'error'
  database: 'ok' | 'error'
  redis: 'ok' | 'error'
}

/**
 * Fetches GET {baseUrl}/health/ and returns parsed JSON.
 * @param baseUrl - API base URL (e.g. from config or injected for tests)
 * @returns Health response or throws on network/parse error
 */
export async function fetchHealth(baseUrl: string): Promise<HealthResponse> {
  const url = `${baseUrl.replace(/\/$/, '')}/health/`
  const response = await fetch(url)
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Health check failed: ${response.status} ${text}`)
  }
  return response.json() as Promise<HealthResponse>
}
