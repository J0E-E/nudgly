/**
 * TanStack Query hooks for task CRUD with optimistic completion toggle.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/useAuth'
import * as taskApi from '../services/taskApi'
import { myDayKeys } from './useMyDay'
import type {
  TaskCreatePayload,
  TaskUpdatePayload,
  TaskListResponse,
} from '../types/task'
import { TaskStatus } from '../types/task'

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters: {
    status?: string
    list_id?: number | 'none'
    created_for_me?: boolean
  }) => [...taskKeys.lists(), filters] as const,
}

export function useTaskList(
  status?: string,
  listId?: number | 'none',
  createdForMe?: boolean
) {
  const { getApiDeps } = useAuth()
  return useQuery({
    queryKey: taskKeys.list({ status, list_id: listId, created_for_me: createdForMe }),
    queryFn: () =>
      taskApi.listTasks(getApiDeps(), {
        status,
        list_id: listId,
        created_for_me: createdForMe,
      }),
  })
}

export function useCreateTask() {
  const { getApiDeps } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: TaskCreatePayload) =>
      taskApi.createTask(getApiDeps(), payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() }),
  })
}

export function useUpdateTask() {
  const { getApiDeps } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TaskUpdatePayload }) =>
      taskApi.updateTask(getApiDeps(), id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
      queryClient.invalidateQueries({ queryKey: myDayKeys.all })
    },
  })
}

export function useToggleTaskComplete() {
  const { getApiDeps } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      currentStatus,
    }: {
      id: number
      currentStatus: TaskStatus
    }) => {
      const newStatus =
        currentStatus === TaskStatus.COMPLETED
          ? TaskStatus.PENDING
          : TaskStatus.COMPLETED
      return taskApi.updateTask(getApiDeps(), id, { status: newStatus })
    },
    onMutate: async ({ id, currentStatus }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() })
      const previousData = queryClient.getQueriesData<TaskListResponse>({
        queryKey: taskKeys.lists(),
      })
      const newStatus =
        currentStatus === TaskStatus.COMPLETED
          ? TaskStatus.PENDING
          : TaskStatus.COMPLETED
      queryClient.setQueriesData<TaskListResponse>(
        { queryKey: taskKeys.lists() },
        (old) => {
          if (!old) return old
          return {
            ...old,
            results: old.results.map((t) =>
              t.id === id ? { ...t, status: newStatus } : t
            ),
          }
        }
      )
      return { previousData }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        for (const [key, data] of context.previousData) {
          queryClient.setQueryData(key, data)
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
      queryClient.invalidateQueries({ queryKey: myDayKeys.all })
    },
  })
}

export function useReorderFocusTasks() {
  const { getApiDeps } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (orderedIds: number[]) =>
      taskApi.reorderFocusTasks(getApiDeps(), orderedIds),
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() })
      const previousData = queryClient.getQueriesData<TaskListResponse>({
        queryKey: taskKeys.lists(),
      })
      const orderMap = new Map(orderedIds.map((id, i) => [id, i]))
      queryClient.setQueriesData<TaskListResponse>(
        { queryKey: taskKeys.lists() },
        (old) => {
          if (!old) return old
          return {
            ...old,
            results: old.results.map((t) => {
              const newOrder = orderMap.get(t.id)
              return newOrder !== undefined
                ? { ...t, focus_sort_order: newOrder }
                : t
            }),
          }
        }
      )
      return { previousData }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        for (const [key, data] of context.previousData) {
          queryClient.setQueryData(key, data)
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
      queryClient.invalidateQueries({ queryKey: myDayKeys.all })
    },
  })
}

export function useDeleteTask() {
  const { getApiDeps } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => taskApi.deleteTask(getApiDeps(), id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() }),
  })
}
