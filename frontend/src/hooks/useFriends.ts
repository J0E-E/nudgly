/**
 * TanStack Query hooks for Friends & Invitations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/useAuth'
import * as friendApi from '../services/friendApi'
import type { InvitePayload } from '../types/friend'

export const friendKeys = {
  all: ['friends'] as const,
  list: () => [...friendKeys.all, 'list'] as const,
  invitations: (params?: { direction?: string; status?: string }) =>
    [...friendKeys.all, 'invitations', params] as const,
}

export function useFriendList() {
  const { getApiDeps } = useAuth()
  return useQuery({
    queryKey: friendKeys.list(),
    queryFn: () => friendApi.listFriends(getApiDeps()),
  })
}

export function useInvitationList(
  direction?: 'sent' | 'received',
  status?: string
) {
  const { getApiDeps } = useAuth()
  return useQuery({
    queryKey: friendKeys.invitations({ direction, status }),
    queryFn: () =>
      friendApi.listInvitations(getApiDeps(), { direction, status }),
  })
}

export function useSendInvite() {
  const { getApiDeps } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: InvitePayload) =>
      friendApi.sendInvite(getApiDeps(), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.all })
    },
  })
}

export function useRespondToInvitation() {
  const { getApiDeps } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: number
      action: 'accept' | 'decline'
    }) => friendApi.respondToInvitation(getApiDeps(), id, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.all })
    },
  })
}

export function useRemoveFriend() {
  const { getApiDeps } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: number) =>
      friendApi.removeFriend(getApiDeps(), userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.all })
    },
  })
}
