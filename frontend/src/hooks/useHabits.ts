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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: habitKeys.lists() }),
  })
}
