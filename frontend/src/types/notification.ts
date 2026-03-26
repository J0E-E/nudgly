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

export interface FriendSocketMessage {
  msg_type: 'friend_event'
  title: string
  body: string
  event_type:
    | 'friend_request_received'
    | 'friend_request_accepted'
    | 'friend_request_declined'
}

export type SocketMessage = (Notification & { msg_type?: undefined }) | FriendSocketMessage
