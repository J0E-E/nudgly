export interface Friend {
  id: number
  username: string
  display_name: string
  email: string
}

export interface FriendInvitation {
  id: number
  from_user: Friend
  to_user: Friend | null
  to_email: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  responded_at: string | null
}

export interface InvitePayload {
  to_email?: string
  to_username?: string
}
