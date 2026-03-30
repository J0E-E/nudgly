import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ListDetailScreen } from './ListDetailScreen'
import type { List } from '../types/list'
import type { Task, TaskListResponse } from '../types/task'
import { TaskCategory, TaskStatus } from '../types/task'
import * as listApi from '../services/listApi'
import * as taskApi from '../services/taskApi'

vi.mock('../contexts/useAuth', () => ({
  useAuth: vi.fn(() => ({
    getApiDeps: vi.fn(() => ({
      getAccessToken: () => 'token',
      refreshTokens: vi.fn(),
      onUnauthorized: vi.fn(),
    })),
  })),
}))

vi.mock('../services/listApi', () => ({
  listLists: vi.fn(),
  getList: vi.fn(),
  createList: vi.fn(),
  updateList: vi.fn(),
  deleteList: vi.fn(),
}))

vi.mock('../services/taskApi', () => ({
  listTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}))

vi.mock('../services/friendApi', () => ({
  listFriends: vi.fn(() => Promise.resolve([])),
}))

const mockList: List = {
  id: 1,
  name: 'Groceries',
  category: 'work',
  tag: 'shopping',
  priority: 2,
  sort_order: 0,
  muted_until: null,
  archived_at: null,
  created_at: '2026-03-20T10:00:00Z',
  task_count: 2,
}

const mockTasks: Task[] = [
  {
    id: 10,
    title: 'Buy milk',
    description: '',
    due_date: null,
    due_time: null,
    category: TaskCategory.WORK,
    tag: '',
    priority: 0,
    recurring: null,
    stack_count: 0,
    status: TaskStatus.PENDING,
    muted_until: null,
    created_at: '2026-03-20T10:00:00Z',
    completed_at: null,
    list_id: 1,
    created_by: null,
    linked_friends: [],
  },
  {
    id: 11,
    title: 'Buy bread',
    description: '',
    due_date: null,
    due_time: null,
    category: TaskCategory.WORK,
    tag: '',
    priority: 0,
    recurring: null,
    stack_count: 0,
    status: TaskStatus.PENDING,
    muted_until: null,
    created_at: '2026-03-20T11:00:00Z',
    completed_at: null,
    list_id: 1,
    created_by: null,
    linked_friends: [],
  },
]

const mockTasksResponse: TaskListResponse = {
  count: 2,
  limit: 50,
  offset: 0,
  results: mockTasks,
}

function renderWithProviders(listId: number = 1) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/lists/${listId}`]}>
        <Routes>
          <Route path="/lists/:id" element={<ListDetailScreen />} />
          <Route path="/lists" element={<div>Lists index</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ListDetailScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    HTMLDialogElement.prototype.showModal =
      HTMLDialogElement.prototype.showModal ||
      vi.fn(function (this: HTMLDialogElement) {
        this.setAttribute('open', '')
      })
    HTMLDialogElement.prototype.close =
      HTMLDialogElement.prototype.close ||
      vi.fn(function (this: HTMLDialogElement) {
        this.removeAttribute('open')
      })
  })

  it('shows loading state initially', () => {
    vi.mocked(listApi.getList).mockReturnValue(new Promise(() => {}))
    vi.mocked(taskApi.listTasks).mockReturnValue(new Promise(() => {}))
    renderWithProviders()
    expect(screen.getByText(/loading list/i)).toBeInTheDocument()
  })

  it('shows error when list not found', async () => {
    vi.mocked(listApi.getList).mockRejectedValue(new Error('Not found'))
    vi.mocked(taskApi.listTasks).mockResolvedValue(mockTasksResponse)
    renderWithProviders()
    await waitFor(() => {
      expect(screen.getByText(/list not found/i)).toBeInTheDocument()
    })
  })

  it('renders list name and tasks', async () => {
    vi.mocked(listApi.getList).mockResolvedValue(mockList)
    vi.mocked(taskApi.listTasks).mockResolvedValue(mockTasksResponse)
    renderWithProviders()
    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument()
      expect(screen.getAllByText('Buy milk')[0]).toBeInTheDocument()
      expect(screen.getAllByText('Buy bread')[0]).toBeInTheDocument()
    })
  })

  it('shows category and priority badges', async () => {
    vi.mocked(listApi.getList).mockResolvedValue(mockList)
    vi.mocked(taskApi.listTasks).mockResolvedValue(mockTasksResponse)
    renderWithProviders()
    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument()
    })
    const meta = document.querySelector('.list-detail-meta')!
    expect(meta.textContent).toContain('Work')
    expect(meta.textContent).toContain('Medium')
  })

  it('shows action buttons', async () => {
    vi.mocked(listApi.getList).mockResolvedValue(mockList)
    vi.mocked(taskApi.listTasks).mockResolvedValue(mockTasksResponse)
    renderWithProviders()
    await waitFor(() => {
      expect(
        document.getElementById('list-detail-edit-btn')
      ).toBeInTheDocument()
      expect(
        document.getElementById('list-detail-delete-btn')
      ).toBeInTheDocument()
      expect(
        document.getElementById('list-detail-mute-btn')
      ).toBeInTheDocument()
      expect(
        document.getElementById('list-detail-archive-btn')
      ).toBeInTheDocument()
    })
  })

  it('opens edit list modal when edit button clicked', async () => {
    vi.mocked(listApi.getList).mockResolvedValue(mockList)
    vi.mocked(taskApi.listTasks).mockResolvedValue(mockTasksResponse)
    renderWithProviders()
    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument()
    })

    fireEvent.click(document.getElementById('list-detail-edit-btn')!)
    expect(document.getElementById('list-form-title')?.textContent).toBe(
      'Edit list'
    )
  })

  it('opens delete confirm dialog when delete button clicked', async () => {
    vi.mocked(listApi.getList).mockResolvedValue(mockList)
    vi.mocked(taskApi.listTasks).mockResolvedValue(mockTasksResponse)
    renderWithProviders()
    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument()
    })

    fireEvent.click(document.getElementById('list-detail-delete-btn')!)
    expect(
      screen.getByText(/are you sure you want to delete/i)
    ).toBeInTheDocument()
  })

  it('opens add task form when add task button clicked', async () => {
    vi.mocked(listApi.getList).mockResolvedValue(mockList)
    vi.mocked(taskApi.listTasks).mockResolvedValue(mockTasksResponse)
    renderWithProviders()
    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument()
    })

    fireEvent.click(document.getElementById('task-add-btn')!)
    expect(document.getElementById('task-form-title')?.textContent).toBe(
      'Add task'
    )
  })

  it('shows back to lists button', async () => {
    vi.mocked(listApi.getList).mockResolvedValue(mockList)
    vi.mocked(taskApi.listTasks).mockResolvedValue(mockTasksResponse)
    renderWithProviders()
    await waitFor(() => {
      expect(screen.getByText(/back to lists/i)).toBeInTheDocument()
    })
  })
})
