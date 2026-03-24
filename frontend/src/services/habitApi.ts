/**
 * Habit API: CRUD operations and completion for /api/habits/.
 */

import { API_BASE_URL } from '../config/api'
import type { ApiClientDeps } from './apiClient'
import { authGet, authPost, authPatch, authDelete } from './apiClient'
import type {
  Habit,
  HabitListResponse,
  HabitCreatePayload,
  HabitUpdatePayload,
  HabitCompletion,
  HabitCompletePayload,
} from '../types/habit'

const HABITS_BASE = `${API_BASE_URL.replace(/\/$/, '')}/api/habits`

export async function listHabits(
  deps: ApiClientDeps,
  params?: { limit?: number; offset?: number }
): Promise<HabitListResponse> {
  const query = new URLSearchParams()
  if (params?.limit != null) query.set('limit', String(params.limit))
  if (params?.offset != null) query.set('offset', String(params.offset))
  const qs = query.toString()
  return authGet<HabitListResponse>(`${HABITS_BASE}/${qs ? `?${qs}` : ''}`, deps)
}

export async function createHabit(
  deps: ApiClientDeps,
  payload: HabitCreatePayload
): Promise<Habit> {
  return authPost<Habit>(`${HABITS_BASE}/`, payload, deps)
}

export async function updateHabit(
  deps: ApiClientDeps,
  id: number,
  payload: HabitUpdatePayload
): Promise<Habit> {
  return authPatch<Habit>(`${HABITS_BASE}/${id}/`, payload, deps)
}

export async function deleteHabit(
  deps: ApiClientDeps,
  id: number
): Promise<void> {
  return authDelete(`${HABITS_BASE}/${id}/`, deps)
}

export async function completeHabit(
  deps: ApiClientDeps,
  id: number,
  payload: HabitCompletePayload = {}
): Promise<HabitCompletion> {
  return authPost<HabitCompletion>(
    `${HABITS_BASE}/${id}/complete/`,
    payload,
    deps
  )
}
