/**
 * TanStack Query hooks for standalone reminder CRUD, snooze, and clear.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/useAuth'
import * as reminderApi from '../services/standaloneReminderApi'
import type {
  StandaloneReminderCreatePayload,
  StandaloneReminderUpdatePayload,
  StandaloneReminderListResponse,
  SnoozePayload,
} from '../types/standaloneReminder'

export const standaloneReminderKeys = {
  all: ['standaloneReminders'] as const,
  lists: () => [...standaloneReminderKeys.all, 'list'] as const,
  list: () => [...standaloneReminderKeys.lists()] as const,
}

export function useStandaloneReminderList() {
  const { getApiDeps } = useAuth()
  return useQuery({
    queryKey: standaloneReminderKeys.list(),
    queryFn: () => reminderApi.listStandaloneReminders(getApiDeps()),
  })
}

export function useCreateStandaloneReminder() {
  const { getApiDeps } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: StandaloneReminderCreatePayload) =>
      reminderApi.createStandaloneReminder(getApiDeps(), payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: standaloneReminderKeys.lists() }),
  })
}

export function useUpdateStandaloneReminder() {
  const { getApiDeps } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number
      payload: StandaloneReminderUpdatePayload
    }) => reminderApi.updateStandaloneReminder(getApiDeps(), id, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: standaloneReminderKeys.lists() }),
  })
}

export function useDeleteStandaloneReminder() {
  const { getApiDeps } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      reminderApi.deleteStandaloneReminder(getApiDeps(), id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: standaloneReminderKeys.lists() }),
  })
}

export function useSnoozeInstance() {
  const { getApiDeps } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      reminderId,
      instanceId,
      payload,
    }: {
      reminderId: number
      instanceId: number
      payload: SnoozePayload
    }) => reminderApi.snoozeInstance(getApiDeps(), reminderId, instanceId, payload),
    onMutate: async ({ reminderId, instanceId, payload }) => {
      await queryClient.cancelQueries({ queryKey: standaloneReminderKeys.list() })
      const previous = queryClient.getQueryData<StandaloneReminderListResponse>(
        standaloneReminderKeys.list()
      )
      if (previous) {
        const snoozedUntil = new Date(
          Date.now() + payload.snooze_minutes * 60_000
        ).toISOString()
        queryClient.setQueryData<StandaloneReminderListResponse>(
          standaloneReminderKeys.list(),
          {
            ...previous,
            results: previous.results.map((r) =>
              r.id === reminderId && r.latest_instance?.id === instanceId
                ? {
                    ...r,
                    latest_instance: {
                      ...r.latest_instance,
                      snoozed_until: snoozedUntil,
                    },
                  }
                : r
            ),
          }
        )
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(standaloneReminderKeys.list(), context.previous)
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: standaloneReminderKeys.lists() }),
  })
}

export function useClearInstance() {
  const { getApiDeps } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      reminderId,
      instanceId,
    }: {
      reminderId: number
      instanceId: number
    }) => reminderApi.clearInstance(getApiDeps(), reminderId, instanceId),
    onMutate: async ({ reminderId }) => {
      await queryClient.cancelQueries({ queryKey: standaloneReminderKeys.list() })
      const previous = queryClient.getQueryData<StandaloneReminderListResponse>(
        standaloneReminderKeys.list()
      )
      if (previous) {
        queryClient.setQueryData<StandaloneReminderListResponse>(
          standaloneReminderKeys.list(),
          {
            ...previous,
            results: previous.results.map((r) =>
              r.id === reminderId
                ? { ...r, latest_instance: null }
                : r
            ),
          }
        )
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(standaloneReminderKeys.list(), context.previous)
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: standaloneReminderKeys.lists() }),
  })
}
