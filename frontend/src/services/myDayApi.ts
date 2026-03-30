/**
 * My Day API: aggregation endpoint for the daily dashboard.
 */

import { API_BASE_URL } from '../config/api'
import type { ApiClientDeps } from './apiClient'
import { authGet } from './apiClient'
import type { MyDayResponse } from '../types/myDay'

const MY_DAY_BASE = `${API_BASE_URL.replace(/\/$/, '')}/api/my-day`

export async function getMyDay(deps: ApiClientDeps): Promise<MyDayResponse> {
  return authGet<MyDayResponse>(`${MY_DAY_BASE}/`, deps)
}
