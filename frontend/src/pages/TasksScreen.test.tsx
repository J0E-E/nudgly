import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TasksScreen } from './TasksScreen'
import { TaskCategory, TaskStatus } from '../types/task'
import type { Task, TaskListResponse } from '../types/task'
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

vi.mock('../services/taskApi', () => ({
  listTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}))

vi.mock('../services/friendApi', () => ({
  listFriends: vi.fn(() => Promise.resolve([])),
}))

const mockTasks: Task[] = [
  {
    id: 1,
    title: 'Buy groceries',
    description: 'Milk and bread',
    due_date: '2026-04-01',
    due_time: null,
    category: TaskCategory.WORK,
    tag: '',
    priority: 3,
    recurring: null,
    stack_count: 0,
    status: TaskStatus.PENDING,
    muted_until: null,
    created_at: '2026-03-20T10:00:00Z',
    completed_at: null,
    list_id: null,
    created_by: null,
    linked_friends: [],
  },
  {
    id: 2,
    title: 'Workout',
    description: '',
    due_date: null,
    due_time: null,
    category: TaskCategory.PERSONAL,
    tag: '',
    priority: 0,
    recurring: null,
    stack_count: 0,
    status: TaskStatus.PENDING,
    muted_until: null,
    created_at: '2026-03-20T11:00:00Z',
    completed_at: null,
    list_id: null,
    created_by: null,
    linked_friends: [],
  },
]

const mockResponse: TaskListResponse = {
  count: 2,
  limit: 50,
  offset: 0,
  results: mockTasks,
}

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe('TasksScreen', () => {
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
    vi.mocked(taskApi.listTasks).mockReturnValue(new Promise(() => {}))
    renderWithQuery(<TasksScreen />)
    expect(screen.getByText(/loading tasks/i)).toBeInTheDocument()
  })

  it('shows error state on fetch failure', async () => {
    vi.mocked(taskApi.listTasks).mockRejectedValue(new Error('Network error'))
    renderWithQuery(<TasksScreen />)
    await waitFor(() => {
      expect(screen.getByText(/failed to load tasks/i)).toBeInTheDocument()
    })
  })

  it('renders tasks after loading', async () => {
    vi.mocked(taskApi.listTasks).mockResolvedValue(mockResponse)
    renderWithQuery(<TasksScreen />)
    await waitFor(() => {
      expect(screen.getAllByText('Buy groceries')[0]).toBeInTheDocument()
      expect(screen.getAllByText('Workout')[0]).toBeInTheDocument()
    })
  })

  it('filters tasks by search text', async () => {
    vi.mocked(taskApi.listTasks).mockResolvedValue(mockResponse)
    renderWithQuery(<TasksScreen />)
    await waitFor(() => {
      expect(screen.getAllByText('Buy groceries')[0]).toBeInTheDocument()
    })
    fireEvent.change(screen.getByPlaceholderText(/search tasks/i), {
      target: { value: 'workout' },
    })
    expect(screen.queryAllByText('Buy groceries')).toHaveLength(0)
    expect(screen.getAllByText('Workout')[0]).toBeInTheDocument()
  })

  it('filters tasks by category', async () => {
    vi.mocked(taskApi.listTasks).mockResolvedValue(mockResponse)
    renderWithQuery(<TasksScreen />)
    await waitFor(() => {
      expect(screen.getAllByText('Buy groceries')[0]).toBeInTheDocument()
    })
    fireEvent.click(screen.getByLabelText('Toggle filters'))
    fireEvent.change(document.getElementById('task-filter-category')!, {
      target: { value: 'personal' },
    })
    expect(screen.queryAllByText('Buy groceries')).toHaveLength(0)
    expect(screen.getAllByText('Workout')[0]).toBeInTheDocument()
  })

  it('shows empty state when no tasks match filters', async () => {
    vi.mocked(taskApi.listTasks).mockResolvedValue(mockResponse)
    renderWithQuery(<TasksScreen />)
    await waitFor(() => {
      expect(screen.getAllByText('Buy groceries')[0]).toBeInTheDocument()
    })
    fireEvent.change(screen.getByPlaceholderText(/search tasks/i), {
      target: { value: 'nonexistent' },
    })
    expect(screen.getByText(/no tasks found/i)).toBeInTheDocument()
  })

  it('renders page title', () => {
    vi.mocked(taskApi.listTasks).mockReturnValue(new Promise(() => {}))
    renderWithQuery(<TasksScreen />)
    expect(screen.getByText('Tasks')).toBeInTheDocument()
  })

  it('calls updateTask when checkbox is toggled', async () => {
    vi.mocked(taskApi.listTasks).mockResolvedValue(mockResponse)
    vi.mocked(taskApi.updateTask).mockResolvedValue({
      ...mockTasks[0],
      status: TaskStatus.COMPLETED,
    })
    renderWithQuery(<TasksScreen />)
    await waitFor(() => {
      expect(screen.getAllByText('Buy groceries')[0]).toBeInTheDocument()
    })

    fireEvent.click(document.getElementById('task-1-checkbox')!)
    await waitFor(() => {
      expect(taskApi.updateTask).toHaveBeenCalledWith(expect.anything(), 1, {
        status: 'completed',
      })
    })
  })

  it('opens add task form when add button clicked', async () => {
    vi.mocked(taskApi.listTasks).mockResolvedValue(mockResponse)
    renderWithQuery(<TasksScreen />)
    await waitFor(() => {
      expect(screen.getAllByText('Buy groceries')[0]).toBeInTheDocument()
    })

    fireEvent.click(document.getElementById('task-add-btn')!)
    expect(document.getElementById('task-form-title')?.textContent).toBe(
      'Add task'
    )
  })

  it('opens edit form when edit button clicked', async () => {
    vi.mocked(taskApi.listTasks).mockResolvedValue(mockResponse)
    renderWithQuery(<TasksScreen />)
    await waitFor(() => {
      expect(screen.getAllByText('Buy groceries')[0]).toBeInTheDocument()
    })

    fireEvent.click(document.getElementById('task-1-edit-btn')!)
    expect(document.getElementById('task-form-title')?.textContent).toBe(
      'Edit task'
    )
  })

  it('opens confirm dialog when delete button clicked', async () => {
    vi.mocked(taskApi.listTasks).mockResolvedValue(mockResponse)
    renderWithQuery(<TasksScreen />)
    await waitFor(() => {
      expect(screen.getAllByText('Buy groceries')[0]).toBeInTheDocument()
    })

    fireEvent.click(document.getElementById('task-1-delete-btn')!)
    expect(
      screen.getByText(/are you sure you want to delete/i)
    ).toBeInTheDocument()
  })

  it('calls deleteTask when delete is confirmed', async () => {
    vi.mocked(taskApi.listTasks).mockResolvedValue(mockResponse)
    vi.mocked(taskApi.deleteTask).mockResolvedValue(undefined)
    renderWithQuery(<TasksScreen />)
    await waitFor(() => {
      expect(screen.getAllByText('Buy groceries')[0]).toBeInTheDocument()
    })

    fireEvent.click(document.getElementById('task-1-delete-btn')!)
    fireEvent.click(document.getElementById('confirm-dialog-confirm-btn')!)

    await waitFor(() => {
      expect(taskApi.deleteTask).toHaveBeenCalledWith(expect.anything(), 1)
    })
  })

  it('shows mutation error when toggle fails', async () => {
    vi.mocked(taskApi.listTasks).mockResolvedValue(mockResponse)
    vi.mocked(taskApi.updateTask).mockRejectedValue(new Error('Network error'))
    renderWithQuery(<TasksScreen />)
    await waitFor(() => {
      expect(screen.getAllByText('Buy groceries')[0]).toBeInTheDocument()
    })

    fireEvent.click(document.getElementById('task-1-checkbox')!)
    await waitFor(() => {
      expect(screen.getByText(/failed to update task/i)).toBeInTheDocument()
    })
  })
})
