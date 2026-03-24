/**
 * WebSocket hook for real-time notification delivery.
 *
 * Connects to ws://<host>/ws/notifications/?token=<accessToken> when
 * authenticated. Auto-reconnects with exponential backoff. Disconnects
 * on logout.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '../config/api'
import { useAuth } from './useAuth'
import type { Notification } from '../types/notification'

const MAX_BACKOFF_MS = 30_000
const INITIAL_BACKOFF_MS = 1_000

function wsUrl(token: string): string {
  const base = API_BASE_URL.replace(/\/$/, '')
    .replace(/^https:/, 'wss:')
    .replace(/^http:/, 'ws:')
  return `${base}/ws/notifications/?token=${token}`
}

export interface UseNotificationSocketOptions {
  onMessage?: (notification: Notification) => void
}

export function useNotificationSocket(
  options?: UseNotificationSocketOptions
) {
  const { getApiDeps, isAuthenticated } = useAuth()
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const backoffRef = useRef(INITIAL_BACKOFF_MS)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closingRef = useRef(false)
  const onMessageRef = useRef(options?.onMessage)
  onMessageRef.current = options?.onMessage

  const cleanup = useCallback(() => {
    closingRef.current = true
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsConnected(false)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      cleanup()
      return
    }

    const token = getApiDeps().getAccessToken()
    if (!token) {
      cleanup()
      return
    }

    closingRef.current = false

    function connect() {
      const currentToken = getApiDeps().getAccessToken()
      if (!currentToken) return

      const ws = new WebSocket(wsUrl(currentToken))
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        backoffRef.current = INITIAL_BACKOFF_MS
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as Notification
          onMessageRef.current?.(data)
        } catch {
          // Ignore malformed messages.
        }
      }

      ws.onclose = () => {
        setIsConnected(false)
        wsRef.current = null
        if (closingRef.current) return
        // Reconnect with exponential backoff.
        const delay = backoffRef.current
        backoffRef.current = Math.min(delay * 2, MAX_BACKOFF_MS)
        reconnectTimerRef.current = setTimeout(connect, delay)
      }

      ws.onerror = () => {
        // onclose will fire after onerror — reconnect handled there.
      }
    }

    connect()

    return cleanup
  }, [isAuthenticated, getApiDeps, cleanup])

  return { isConnected }
}
