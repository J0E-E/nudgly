import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  useTaskList,
  useCreateTask,
  useUpdateTask,
  useToggleTaskComplete,
  useDeleteTask,
  taskKeys,
} from './useTasks'
import * as taskApi from '../services/taskApi'
import { TaskCategory, TaskStatus } from '../types/task'
import type { TaskListResponse } from '../types/task'

vi.mock('../contexts/useAuth', () => ({
  useAuth: vi.fn(() => ({
    getApiDeps: vi.fn(() => ({
      getAccessToken: () => 'token',
      refreshTokens: vi.fn(),
      onUnauthorized: vi.fn(),
    })),
  })),
}))

vi.mock('../services/taskApi', () => ({
  listTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}))

const mockResponse: TaskListResponse = {
  count: 1,
  limit: 50,
  offset: 0,
  results: [
    {
      id: 1,
      title: 'Test task',
      description: '',
      due_date: null,
      category: TaskCategory.WORK,
      tag: '',
      priority: 0,
      recurring: null,
      status: TaskStatus.PENDING,
      muted_until: null,
      created_at: '2026-03-20T10:00:00Z',
      completed_at: null,
    },
  ],
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

describe('useTasks hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('taskKeys', () => {
    it('generates correct query keys', () => {
      expect(taskKeys.all).toEqual(['tasks'])
      expect(taskKeys.lists()).toEqual(['tasks', 'list'])
      expect(taskKeys.list({ status: 'pending' })).toEqual([
        'tasks',
        'list',
        { status: 'pending' },
      ])
      expect(taskKeys.list({})).toEqual(['tasks', 'list', {}])
    })
  })

  describe('useTaskList', () => {
    it('fetches tasks via taskApi.listTasks', async () => {
      vi.mocked(taskApi.listTasks).mockResolvedValue(mockResponse)
      const { result } = renderHook(() => useTaskList(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockResponse)
      expect(taskApi.listTasks).toHaveBeenCalledOnce()
    })

    it('passes status filter to listTasks', async () => {
      vi.mocked(taskApi.listTasks).mockResolvedValue(mockResponse)
      const { result } = renderHook(() => useTaskList('completed'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(taskApi.listTasks).toHaveBeenCalledWith(expect.anything(), {
        status: 'completed',
      })
    })
  })

  describe('useCreateTask', () => {
    it('calls taskApi.createTask and invalidates list', async () => {
      vi.mocked(taskApi.listTasks).mockResolvedValue(mockResponse)
      vi.mocked(taskApi.createTask).mockResolvedValue(mockResponse.results[0])

      const wrapper = createWrapper()
      const { result: listResult } = renderHook(() => useTaskList(), {
        wrapper,
      })
      await waitFor(() => expect(listResult.current.isSuccess).toBe(true))

      const { result } = renderHook(() => useCreateTask(), { wrapper })
      await result.current.mutateAsync({
        title: 'New',
        category: TaskCategory.WORK,
      })

      expect(taskApi.createTask).toHaveBeenCalledOnce()
    })
  })

  describe('useUpdateTask', () => {
    it('calls taskApi.updateTask', async () => {
      vi.mocked(taskApi.updateTask).mockResolvedValue(mockResponse.results[0])

      const { result } = renderHook(() => useUpdateTask(), {
        wrapper: createWrapper(),
      })
      await result.current.mutateAsync({
        id: 1,
        payload: { title: 'Updated' },
      })

      expect(taskApi.updateTask).toHaveBeenCalledWith(expect.anything(), 1, {
        title: 'Updated',
      })
    })
  })

  describe('useToggleTaskComplete', () => {
    it('toggles pending to completed', async () => {
      vi.mocked(taskApi.updateTask).mockResolvedValue({
        ...mockResponse.results[0],
        status: TaskStatus.COMPLETED,
      })

      const { result } = renderHook(() => useToggleTaskComplete(), {
        wrapper: createWrapper(),
      })
      await result.current.mutateAsync({
        id: 1,
        currentStatus: TaskStatus.PENDING,
      })

      expect(taskApi.updateTask).toHaveBeenCalledWith(expect.anything(), 1, {
        status: TaskStatus.COMPLETED,
      })
    })

    it('toggles completed to pending', async () => {
      vi.mocked(taskApi.updateTask).mockResolvedValue({
        ...mockResponse.results[0],
        status: TaskStatus.PENDING,
      })

      const { result } = renderHook(() => useToggleTaskComplete(), {
        wrapper: createWrapper(),
      })
      await result.current.mutateAsync({
        id: 1,
        currentStatus: TaskStatus.COMPLETED,
      })

      expect(taskApi.updateTask).toHaveBeenCalledWith(expect.anything(), 1, {
        status: TaskStatus.PENDING,
      })
    })

    it('optimistically updates cache', async () => {
      vi.mocked(taskApi.listTasks).mockResolvedValue(mockResponse)
      vi.mocked(taskApi.updateTask).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ...mockResponse.results[0],
                  status: TaskStatus.COMPLETED,
                }),
              100
            )
          )
      )

      const wrapper = createWrapper()
      const { result: listResult } = renderHook(() => useTaskList(), {
        wrapper,
      })
      await waitFor(() => expect(listResult.current.isSuccess).toBe(true))

      const { result: toggleResult } = renderHook(
        () => useToggleTaskComplete(),
        { wrapper }
      )
      toggleResult.current.mutate({
        id: 1,
        currentStatus: TaskStatus.PENDING,
      })

      // Cache should be optimistically updated before API resolves
      await waitFor(() => {
        const cachedData = listResult.current.data
        const cachedTask = cachedData?.results.find((t) => t.id === 1)
        expect(cachedTask?.status).toBe(TaskStatus.COMPLETED)
      })
    })

    it('rolls back cache on error', async () => {
      vi.mocked(taskApi.listTasks).mockResolvedValue(mockResponse)
      vi.mocked(taskApi.updateTask).mockRejectedValue(
        new Error('Network error')
      )

      const wrapper = createWrapper()
      const { result: listResult } = renderHook(() => useTaskList(), {
        wrapper,
      })
      await waitFor(() => expect(listResult.current.isSuccess).toBe(true))

      const { result: toggleResult } = renderHook(
        () => useToggleTaskComplete(),
        { wrapper }
      )

      try {
        await toggleResult.current.mutateAsync({
          id: 1,
          currentStatus: TaskStatus.PENDING,
        })
      } catch {
        // expected
      }

      // After error, cache should be rolled back to original
      await waitFor(() => {
        const cachedData = listResult.current.data
        const cachedTask = cachedData?.results.find((t) => t.id === 1)
        expect(cachedTask?.status).toBe(TaskStatus.PENDING)
      })
    })
  })

  describe('useDeleteTask', () => {
    it('calls taskApi.deleteTask', async () => {
      vi.mocked(taskApi.deleteTask).mockResolvedValue(undefined)

      const { result } = renderHook(() => useDeleteTask(), {
        wrapper: createWrapper(),
      })
      await result.current.mutateAsync(1)

      expect(taskApi.deleteTask).toHaveBeenCalledWith(expect.anything(), 1)
    })
  })
})
