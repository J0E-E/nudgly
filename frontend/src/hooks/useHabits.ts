/**
 * TanStack Query hooks for habit CRUD and completion.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/useAuth'
import * as habitApi from '../services/habitApi'
import type {
  HabitCreatePayload,
  HabitUpdatePayload,
  HabitCompletePayload,
  HabitListResponse,
} from '../types/habit'

export const habitKeys = {
  all: ['habits'] as const,
  lists: () => [...habitKeys.all, 'list'] as const,
  list: () => [...habitKeys.lists()] as const,
}

export function useHabitList() {
  const { getApiDeps } = useAuth()
  return useQuery({
    queryKey: habitKeys.list(),
    queryFn: () => habitApi.listHabits(getApiDeps()),
  })
}

export function useCreateHabit() {
  const { getApiDeps } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: HabitCreatePayload) =>
      habitApi.createHabit(getApiDeps(), payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: habitKeys.lists() }),
  })
}

export function useUpdateHabit() {
  const { getApiDeps } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number
      payload: HabitUpdatePayload
    }) => habitApi.updateHabit(getApiDeps(), id, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: habitKeys.lists() }),
  })
}

export function useDeleteHabit() {
  const { getApiDeps } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => habitApi.deleteHabit(getApiDeps(), id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: habitKeys.lists() }),
  })
}

export function useCompleteHabit() {
  const { getApiDeps } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number
      payload?: HabitCompletePayload
    }) => habitApi.completeHabit(getApiDeps(), id, payload),
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: habitKeys.list() })
      const previous = queryClient.getQueryData<HabitListResponse>(habitKeys.list())
      if (previous && !payload?.skipped) {
        queryClient.setQueryData<HabitListResponse>(habitKeys.list(), {
          ...previous,
          results: previous.results.map((h) =>
            h.id === id
              ? { ...h, period_completions: h.period_completions + 1 }
              : h
          ),
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(habitKeys.list(), context.previous)
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: habitKeys.lists() }),
  })
}
