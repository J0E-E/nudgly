import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TaskFormModal } from './TaskFormModal'
import { TaskCategory, TaskStatus } from '../types/task'
import type { Task } from '../types/task'
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
  createTask: vi.fn(() => Promise.resolve({ id: 1, title: 'New' })),
  updateTask: vi.fn(() => Promise.resolve({ id: 1, title: 'Updated' })),
  listTasks: vi.fn(),
  deleteTask: vi.fn(),
}))

const editTask: Task = {
  id: 1,
  title: 'Existing task',
  description: 'desc',
  due_date: '2026-04-01',
  category: TaskCategory.GLOW_UP,
  tag: 'tag1',
  priority: 2,
  recurring: null,
  status: TaskStatus.PENDING,
  muted_until: null,
  created_at: '2026-03-20T10:00:00Z',
  completed_at: null,
}

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe('TaskFormModal', () => {
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

  it('renders create mode title', () => {
    renderWithQuery(
      <TaskFormModal open={true} mode="create" onClose={vi.fn()} />
    )
    expect(document.getElementById('task-form-title')?.textContent).toBe(
      'Add task'
    )
  })

  it('renders edit mode title', () => {
    renderWithQuery(
      <TaskFormModal
        open={true}
        mode="edit"
        task={editTask}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('Edit task')).toBeInTheDocument()
  })

  it('pre-fills fields in edit mode', () => {
    renderWithQuery(
      <TaskFormModal
        open={true}
        mode="edit"
        task={editTask}
        onClose={vi.fn()}
      />
    )
    const titleInput = document.getElementById(
      'task-form-title-input'
    ) as HTMLInputElement
    expect(titleInput.value).toBe('Existing task')
  })

  it('shows validation error when title is empty', async () => {
    renderWithQuery(
      <TaskFormModal open={true} mode="create" onClose={vi.fn()} />
    )
    fireEvent.click(document.getElementById('task-form-submit-btn')!)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/title is required/i)).toBeInTheDocument()
    })
  })

  it('shows validation error when category not selected', async () => {
    renderWithQuery(
      <TaskFormModal open={true} mode="create" onClose={vi.fn()} />
    )
    const titleInput = document.getElementById(
      'task-form-title-input'
    ) as HTMLInputElement
    fireEvent.change(titleInput, { target: { value: 'Test task' } })
    fireEvent.click(document.getElementById('task-form-submit-btn')!)
    await waitFor(() => {
      expect(screen.getByText(/category is required/i)).toBeInTheDocument()
    })
  })

  it('calls createTask on valid create submission', async () => {
    const onClose = vi.fn()
    renderWithQuery(
      <TaskFormModal open={true} mode="create" onClose={onClose} />
    )
    fireEvent.change(document.getElementById('task-form-title-input')!, {
      target: { value: 'New task' },
    })
    fireEvent.change(document.getElementById('task-form-category-input')!, {
      target: { value: 'adulting' },
    })
    fireEvent.click(document.getElementById('task-form-submit-btn')!)

    await waitFor(() => {
      expect(taskApi.createTask).toHaveBeenCalledOnce()
      expect(onClose).toHaveBeenCalledOnce()
    })
  })

  it('calls updateTask on valid edit submission', async () => {
    const onClose = vi.fn()
    renderWithQuery(
      <TaskFormModal
        open={true}
        mode="edit"
        task={editTask}
        onClose={onClose}
      />
    )
    fireEvent.change(document.getElementById('task-form-title-input')!, {
      target: { value: 'Updated title' },
    })
    fireEvent.click(document.getElementById('task-form-submit-btn')!)

    await waitFor(() => {
      expect(taskApi.updateTask).toHaveBeenCalledOnce()
      expect(onClose).toHaveBeenCalledOnce()
    })
  })

  it('shows error message on mutation failure', async () => {
    vi.mocked(taskApi.createTask).mockRejectedValue(new Error('Server error'))
    renderWithQuery(
      <TaskFormModal open={true} mode="create" onClose={vi.fn()} />
    )
    fireEvent.change(document.getElementById('task-form-title-input')!, {
      target: { value: 'New task' },
    })
    fireEvent.change(document.getElementById('task-form-category-input')!, {
      target: { value: 'adulting' },
    })
    fireEvent.click(document.getElementById('task-form-submit-btn')!)

    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument()
    })
  })

  it('disables submit button while submitting', async () => {
    vi.mocked(taskApi.createTask).mockImplementation(
      () => new Promise(() => {}) // never resolves
    )
    renderWithQuery(
      <TaskFormModal open={true} mode="create" onClose={vi.fn()} />
    )
    fireEvent.change(document.getElementById('task-form-title-input')!, {
      target: { value: 'New task' },
    })
    fireEvent.change(document.getElementById('task-form-category-input')!, {
      target: { value: 'adulting' },
    })
    fireEvent.click(document.getElementById('task-form-submit-btn')!)

    await waitFor(() => {
      const btn = document.getElementById(
        'task-form-submit-btn'
      ) as HTMLButtonElement
      expect(btn.disabled).toBe(true)
      expect(btn.textContent).toBe('Saving...')
    })
  })

  it('calls onClose when cancel button clicked', () => {
    const onClose = vi.fn()
    renderWithQuery(
      <TaskFormModal open={true} mode="create" onClose={onClose} />
    )
    fireEvent.click(document.getElementById('task-form-cancel-btn')!)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
