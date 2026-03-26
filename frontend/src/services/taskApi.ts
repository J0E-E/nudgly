/**
 * Task API: CRUD operations for /api/tasks/.
 */

import { API_BASE_URL } from '../config/api'
import type { ApiClientDeps } from './apiClient'
import { authGet, authPost, authPatch, authDelete } from './apiClient'
import type {
  Task,
  TaskListResponse,
  TaskCreatePayload,
  TaskUpdatePayload,
  TaskSchedule,
} from '../types/task'

const TASKS_BASE = `${API_BASE_URL.replace(/\/$/, '')}/api/tasks`

/**
 * GET /api/tasks/ — list tasks with optional status filter and pagination.
 */
export async function listTasks(
  deps: ApiClientDeps,
  params?: {
    status?: string
    list_id?: number | 'none'
    limit?: number
    offset?: number
    created_for_me?: boolean
    created_by?: number
  }
): Promise<TaskListResponse> {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.list_id != null) query.set('list_id', String(params.list_id))
  if (params?.limit != null) query.set('limit', String(params.limit))
  if (params?.offset != null) query.set('offset', String(params.offset))
  if (params?.created_for_me) query.set('created_for_me', 'true')
  if (params?.created_by != null) query.set('created_by', String(params.created_by))
  const qs = query.toString()
  return authGet<TaskListResponse>(`${TASKS_BASE}/${qs ? `?${qs}` : ''}`, deps)
}

/**
 * POST /api/tasks/ — create a new task.
 */
export async function createTask(
  deps: ApiClientDeps,
  payload: TaskCreatePayload
): Promise<Task> {
  return authPost<Task>(`${TASKS_BASE}/`, payload, deps)
}

/**
 * PATCH /api/tasks/{id}/ — partially update a task.
 */
export async function updateTask(
  deps: ApiClientDeps,
  id: number,
  payload: TaskUpdatePayload
): Promise<Task> {
  return authPatch<Task>(`${TASKS_BASE}/${id}/`, payload, deps)
}

/**
 * DELETE /api/tasks/{id}/ — delete a task.
 */
export async function deleteTask(
  deps: ApiClientDeps,
  id: number
): Promise<void> {
  return authDelete(`${TASKS_BASE}/${id}/`, deps)
}

/**
 * GET /api/tasks/{id}/schedule/ — active reminder schedule for a task.
 * Returns null if no active schedule (404).
 */
export async function getTaskSchedule(
  deps: ApiClientDeps,
  id: number
): Promise<TaskSchedule | null> {
  try {
    return await authGet<TaskSchedule>(`${TASKS_BASE}/${id}/schedule/`, deps)
  } catch {
    return null
  }
}
