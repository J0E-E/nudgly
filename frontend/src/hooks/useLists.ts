/**
 * TanStack Query hooks for list CRUD.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/useAuth'
import * as listApi from '../services/listApi'
import type { ListCreatePayload, ListUpdatePayload } from '../types/list'
import { taskKeys } from './useTasks'

export const listKeys = {
  all: ['lists'] as const,
  lists: () => [...listKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) =>
    [...listKeys.lists(), filters] as const,
  detail: (id: number) => [...listKeys.all, 'detail', id] as const,
}

export function useListList(search?: string, includeArchived?: boolean) {
  const { getApiDeps } = useAuth()
  return useQuery({
    queryKey: listKeys.list({ search, include_archived: includeArchived }),
    queryFn: () =>
      listApi.listLists(getApiDeps(), {
        search,
        include_archived: includeArchived,
      }),
  })
}

export function useListDetail(id: number) {
  const { getApiDeps } = useAuth()
  return useQuery({
    queryKey: listKeys.detail(id),
    queryFn: () => listApi.getList(getApiDeps(), id),
  })
}

export function useCreateList() {
  const { getApiDeps } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ListCreatePayload) =>
      listApi.createList(getApiDeps(), payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: listKeys.lists() }),
  })
}

export function useUpdateList() {
  const { getApiDeps } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ListUpdatePayload }) =>
      listApi.updateList(getApiDeps(), id, payload),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: listKeys.lists() })
      queryClient.invalidateQueries({ queryKey: listKeys.detail(id) })
    },
  })
}

export function useDeleteList() {
  const { getApiDeps } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => listApi.deleteList(getApiDeps(), id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKeys.lists() })
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
    },
  })
}
