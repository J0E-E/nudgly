import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listTasks, createTask, updateTask, deleteTask } from './taskApi'
import * as apiClient from './apiClient'
import { TaskCategory } from '../types/task'
import type { ApiClientDeps } from './apiClient'

vi.mock('./apiClient', () => ({
  authGet: vi.fn(),
  authPost: vi.fn(),
  authPatch: vi.fn(),
  authDelete: vi.fn(),
}))

const mockDeps: ApiClientDeps = {
  getAccessToken: vi.fn(() => 'token'),
  refreshTokens: vi.fn(),
  onUnauthorized: vi.fn(),
}

describe('taskApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listTasks', () => {
    it('calls authGet with correct URL and no params', async () => {
      const mockResponse = { count: 0, limit: 50, offset: 0, results: [] }
      vi.mocked(apiClient.authGet).mockResolvedValue(mockResponse)

      const result = await listTasks(mockDeps)
      expect(apiClient.authGet).toHaveBeenCalledWith(
        expect.stringContaining('/api/tasks/'),
        mockDeps
      )
      expect(result).toEqual(mockResponse)
    })

    it('appends status query param', async () => {
      vi.mocked(apiClient.authGet).mockResolvedValue({
        count: 0,
        limit: 50,
        offset: 0,
        results: [],
      })

      await listTasks(mockDeps, { status: 'pending' })
      expect(apiClient.authGet).toHaveBeenCalledWith(
        expect.stringContaining('status=pending'),
        mockDeps
      )
    })

    it('appends limit and offset query params', async () => {
      vi.mocked(apiClient.authGet).mockResolvedValue({
        count: 0,
        limit: 20,
        offset: 10,
        results: [],
      })

      await listTasks(mockDeps, { limit: 20, offset: 10 })
      const url = vi.mocked(apiClient.authGet).mock.calls[0][0]
      expect(url).toContain('limit=20')
      expect(url).toContain('offset=10')
    })
  })

  describe('createTask', () => {
    it('calls authPost with correct URL and payload', async () => {
      const payload = { title: 'Test', category: TaskCategory.WORK }
      const mockTask = { id: 1, ...payload, status: 'pending' }
      vi.mocked(apiClient.authPost).mockResolvedValue(mockTask)

      const result = await createTask(mockDeps, payload)
      expect(apiClient.authPost).toHaveBeenCalledWith(
        expect.stringContaining('/api/tasks/'),
        payload,
        mockDeps
      )
      expect(result).toEqual(mockTask)
    })
  })

  describe('updateTask', () => {
    it('calls authPatch with correct URL and payload', async () => {
      const payload = { title: 'Updated' }
      const mockTask = { id: 1, title: 'Updated', status: 'pending' }
      vi.mocked(apiClient.authPatch).mockResolvedValue(mockTask)

      const result = await updateTask(mockDeps, 1, payload)
      expect(apiClient.authPatch).toHaveBeenCalledWith(
        expect.stringContaining('/api/tasks/1/'),
        payload,
        mockDeps
      )
      expect(result).toEqual(mockTask)
    })
  })

  describe('deleteTask', () => {
    it('calls authDelete with correct URL', async () => {
      vi.mocked(apiClient.authDelete).mockResolvedValue(undefined)

      await deleteTask(mockDeps, 1)
      expect(apiClient.authDelete).toHaveBeenCalledWith(
        expect.stringContaining('/api/tasks/1/'),
        mockDeps
      )
    })
  })
})
