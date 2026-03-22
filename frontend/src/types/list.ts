export interface List {
  id: number
  name: string
  category: string
  tag: string
  priority: number
  sort_order: number
  muted_until: string | null
  archived_at: string | null
  created_at: string
  task_count: number
}

export interface ListResponse {
  count: number
  limit: number
  offset: number
  results: List[]
}

export interface ListCreatePayload {
  name: string
  category?: string
  tag?: string
  priority?: number
}

export interface ListUpdatePayload {
  name?: string
  category?: string
  tag?: string
  priority?: number
  muted_until?: string | null
  archived_at?: string | null
}
