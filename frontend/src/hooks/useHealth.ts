import { useState, useEffect, useCallback } from 'react'
import { fetchHealth, type HealthResponse } from '../services/healthApi'
import { API_BASE_URL } from '../config/api'

export type HealthState = {
  data: HealthResponse | null
  error: string | null
  loading: boolean
}

/**
 * Fetches health status from the API. Injects baseUrl so tests can override.
 * @param baseUrl - Optional override; defaults to API_BASE_URL from config
 */
export function useHealth(
  baseUrl: string = API_BASE_URL
): HealthState & { refetch: () => void } {
  const [data, setData] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Refetch: runs on user action, so synchronous setState is allowed.
  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchHealth(baseUrl)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [baseUrl])

  // Effect: only setState in async callbacks to satisfy react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false
    fetchHealth(baseUrl)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [baseUrl])

  return { data, error, loading, refetch }
}
