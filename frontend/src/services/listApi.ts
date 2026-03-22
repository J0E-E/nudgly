/**
 * List API: CRUD operations for /api/lists/.
 */

import { API_BASE_URL } from '../config/api'
import type { ApiClientDeps } from './apiClient'
import { authGet, authPost, authPatch, authDelete } from './apiClient'
import type {
  List,
  ListResponse,
  ListCreatePayload,
  ListUpdatePayload,
} from '../types/list'

const LISTS_BASE = `${API_BASE_URL.replace(/\/$/, '')}/api/lists`

/**
 * GET /api/lists/ — list all lists with optional search and pagination.
 */
export async function listLists(
  deps: ApiClientDeps,
  params?: {
    search?: string
    include_archived?: boolean
    limit?: number
    offset?: number
  }
): Promise<ListResponse> {
  const query = new URLSearchParams()
  if (params?.search) query.set('search', params.search)
  if (params?.include_archived) query.set('include_archived', 'true')
  if (params?.limit != null) query.set('limit', String(params.limit))
  if (params?.offset != null) query.set('offset', String(params.offset))
  const qs = query.toString()
  return authGet<ListResponse>(`${LISTS_BASE}/${qs ? `?${qs}` : ''}`, deps)
}

/**
 * GET /api/lists/{id}/ — get a single list.
 */
export async function getList(deps: ApiClientDeps, id: number): Promise<List> {
  return authGet<List>(`${LISTS_BASE}/${id}/`, deps)
}

/**
 * POST /api/lists/ — create a new list.
 */
export async function createList(
  deps: ApiClientDeps,
  payload: ListCreatePayload
): Promise<List> {
  return authPost<List>(`${LISTS_BASE}/`, payload, deps)
}

/**
 * PATCH /api/lists/{id}/ — partially update a list.
 */
export async function updateList(
  deps: ApiClientDeps,
  id: number,
  payload: ListUpdatePayload
): Promise<List> {
  return authPatch<List>(`${LISTS_BASE}/${id}/`, payload, deps)
}

/**
 * DELETE /api/lists/{id}/ — delete a list.
 */
export async function deleteList(
  deps: ApiClientDeps,
  id: number
): Promise<void> {
  return authDelete(`${LISTS_BASE}/${id}/`, deps)
}
