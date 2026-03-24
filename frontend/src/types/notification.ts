export interface Notification {
  id: number
  schedule_id: number
  title: string
  body: string
  triggered_at: string
  read_at: string | null
  created_at: string
}

export interface NotificationListResponse {
  count: number
  limit: number
  offset: number
  results: Notification[]
}

export interface UnreadCountResponse {
  count: number
}
