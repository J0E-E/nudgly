/**
 * Standalone Reminder API: CRUD, snooze, clear for /api/standalone-reminders/.
 */

import { API_BASE_URL } from '../config/api'
import type { ApiClientDeps } from './apiClient'
import { authGet, authPost, authPatch, authDelete } from './apiClient'
import type {
  StandaloneReminder,
  StandaloneReminderListResponse,
  StandaloneReminderCreatePayload,
  StandaloneReminderUpdatePayload,
  ReminderInstance,
  SnoozePayload,
} from '../types/standaloneReminder'

const BASE = `${API_BASE_URL.replace(/\/$/, '')}/api/standalone-reminders`

export async function listStandaloneReminders(
  deps: ApiClientDeps,
  params?: { limit?: number; offset?: number }
): Promise<StandaloneReminderListResponse> {
  const query = new URLSearchParams()
  if (params?.limit != null) query.set('limit', String(params.limit))
  if (params?.offset != null) query.set('offset', String(params.offset))
  const qs = query.toString()
  return authGet<StandaloneReminderListResponse>(`${BASE}/${qs ? `?${qs}` : ''}`, deps)
}

export async function createStandaloneReminder(
  deps: ApiClientDeps,
  payload: StandaloneReminderCreatePayload
): Promise<StandaloneReminder> {
  return authPost<StandaloneReminder>(`${BASE}/`, payload, deps)
}

export async function updateStandaloneReminder(
  deps: ApiClientDeps,
  id: number,
  payload: StandaloneReminderUpdatePayload
): Promise<StandaloneReminder> {
  return authPatch<StandaloneReminder>(`${BASE}/${id}/`, payload, deps)
}

export async function deleteStandaloneReminder(
  deps: ApiClientDeps,
  id: number
): Promise<void> {
  return authDelete(`${BASE}/${id}/`, deps)
}

export async function snoozeInstance(
  deps: ApiClientDeps,
  reminderId: number,
  instanceId: number,
  payload: SnoozePayload
): Promise<ReminderInstance> {
  return authPost<ReminderInstance>(
    `${BASE}/${reminderId}/instances/${instanceId}/snooze/`,
    payload,
    deps
  )
}

export async function clearInstance(
  deps: ApiClientDeps,
  reminderId: number,
  instanceId: number
): Promise<ReminderInstance> {
  return authPost<ReminderInstance>(
    `${BASE}/${reminderId}/instances/${instanceId}/clear/`,
    {},
    deps
  )
}
