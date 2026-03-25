/**
 * Friends & Invitations API: /api/friends/
 */

import { API_BASE_URL } from '../config/api'
import type { ApiClientDeps } from './apiClient'
import { authGet, authPost, authPatch, authDelete } from './apiClient'
import type { Friend, FriendInvitation, InvitePayload } from '../types/friend'

const FRIENDS_BASE = `${API_BASE_URL.replace(/\/$/, '')}/api/friends`

export async function listFriends(deps: ApiClientDeps): Promise<Friend[]> {
  return authGet<Friend[]>(`${FRIENDS_BASE}/`, deps)
}

export async function sendInvite(
  deps: ApiClientDeps,
  payload: InvitePayload
): Promise<FriendInvitation> {
  return authPost<FriendInvitation>(`${FRIENDS_BASE}/invite/`, payload, deps)
}

export async function listInvitations(
  deps: ApiClientDeps,
  params?: { direction?: 'sent' | 'received'; status?: string }
): Promise<FriendInvitation[]> {
  const query = new URLSearchParams()
  if (params?.direction) query.set('direction', params.direction)
  if (params?.status) query.set('status', params.status)
  const qs = query.toString()
  return authGet<FriendInvitation[]>(
    `${FRIENDS_BASE}/invitations/${qs ? `?${qs}` : ''}`,
    deps
  )
}

export async function respondToInvitation(
  deps: ApiClientDeps,
  id: number,
  action: 'accept' | 'decline'
): Promise<FriendInvitation> {
  return authPatch<FriendInvitation>(
    `${FRIENDS_BASE}/invitations/${id}/`,
    { action },
    deps
  )
}

export async function removeFriend(
  deps: ApiClientDeps,
  userId: number
): Promise<void> {
  return authDelete(`${FRIENDS_BASE}/${userId}/`, deps)
}
