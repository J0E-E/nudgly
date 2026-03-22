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
  }
): Promise<TaskListResponse> {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.list_id != null) query.set('list_id', String(params.list_id))
  if (params?.limit != null) query.set('limit', String(params.limit))
  if (params?.offset != null) query.set('offset', String(params.offset))
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
