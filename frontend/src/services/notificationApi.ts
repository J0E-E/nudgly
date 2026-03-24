/**
 * Notification API: list, unread count, mark read, mark all read.
 */

import { API_BASE_URL } from '../config/api'
import type { ApiClientDeps } from './apiClient'
import { authGet, authPost } from './apiClient'
import type { NotificationListResponse, UnreadCountResponse } from '../types/notification'

const NOTIFICATIONS_BASE = `${API_BASE_URL.replace(/\/$/, '')}/api/notifications`

/**
 * GET /api/notifications/ — list sent notifications for current user.
 */
export async function listNotifications(
  deps: ApiClientDeps,
  params?: {
    unread_only?: boolean
    limit?: number
    offset?: number
  }
): Promise<NotificationListResponse> {
  const query = new URLSearchParams()
  if (params?.unread_only) query.set('unread_only', 'true')
  if (params?.limit != null) query.set('limit', String(params.limit))
  if (params?.offset != null) query.set('offset', String(params.offset))
  const qs = query.toString()
  return authGet<NotificationListResponse>(
    `${NOTIFICATIONS_BASE}/${qs ? `?${qs}` : ''}`,
    deps
  )
}

/**
 * GET /api/notifications/unread-count/ — get unread notification count.
 */
export async function getUnreadCount(
  deps: ApiClientDeps
): Promise<UnreadCountResponse> {
  return authGet<UnreadCountResponse>(
    `${NOTIFICATIONS_BASE}/unread-count/`,
    deps
  )
}

/**
 * POST /api/notifications/{id}/read/ — mark a single notification as read.
 */
export async function markRead(
  deps: ApiClientDeps,
  id: number
): Promise<void> {
  await authPost<void>(`${NOTIFICATIONS_BASE}/${id}/read/`, {}, deps)
}

/**
 * POST /api/notifications/read-all/ — mark all notifications as read.
 */
export async function markAllRead(deps: ApiClientDeps): Promise<void> {
  await authPost<void>(`${NOTIFICATIONS_BASE}/read-all/`, {}, deps)
}
