import { useHealth } from '../hooks/useHealth'

/**
 * Health screen: displays API, database, and Redis status from GET /health/.
 * Uses injectable useHealth (defaults to config API_BASE_URL).
 */
export function HealthScreen() {
  const { data, error, loading, refetch } = useHealth()

  return (
    <section id="health-screen-container" aria-label="API health status">
      <h1 id="health-screen-title">Nudgly</h1>
      <p id="health-screen-subtitle">API health check</p>

      {loading && (
        <p id="health-loading" data-testid="health-loading">
          Loading…
        </p>
      )}

      {error && (
        <div id="health-error-container">
          <p id="health-error-message" data-testid="health-error">
            {error}
          </p>
        </div>
      )}

      {!loading && data && (
        <ul id="health-status-list" aria-label="Service status">
          <li id="health-api-status" data-testid="health-api-status">
            API: {data.status}
          </li>
          <li id="health-database-status" data-testid="health-database-status">
            Database: {data.database}
          </li>
          <li id="health-redis-status" data-testid="health-redis-status">
            Redis: {data.redis}
          </li>
        </ul>
      )}

      {!loading && (
        <button
          id="health-refresh-btn"
          type="button"
          onClick={refetch}
          aria-label="Refresh health status"
        >
          Refresh
        </button>
      )}
    </section>
  )
}
