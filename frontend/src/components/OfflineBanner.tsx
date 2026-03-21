/**
 * Offline detection banner: shown when the browser is offline.
 */

import { useOnlineStatus } from '../hooks/useOnlineStatus'
import './OfflineBanner.css'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div
      id="offline-banner"
      className="offline-banner"
      role="alert"
      aria-live="assertive"
    >
      You are offline. Changes will sync when you reconnect.
    </div>
  )
}
