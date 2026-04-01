import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FocusPickerDialog } from './FocusPickerDialog'
import * as taskApi from '../services/taskApi'
import { TaskStatus, TaskCategory } from '../types/task'
import type { Task, TaskListResponse } from '../types/task'

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({
    getApiDeps: () => ({ apiBase: '', token: 'tok' }),
  }),
}))

vi.mock('../services/taskApi', () => ({
  listTasks: vi.fn(),
  updateTask: vi.fn(),
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  reorderFocusTasks: vi.fn(),
}))

const baseTask = (overrides: Partial<Task> = {}): Task => ({
  id: 1,
  title: 'Task A',
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
  created_at: '2026-03-30T10:00:00Z',
  completed_at: null,
  list_id: null,
  focus_date: null,
  focus_sort_order: 0,
  created_by: null,
  linked_friends: [],
  ...overrides,
})

const mockTasks: TaskListResponse = {
  count: 3,
  limit: 50,
  offset: 0,
  results: [
    baseTask({ id: 1, title: 'Task A' }),
    baseTask({ id: 2, title: 'Task B' }),
    baseTask({ id: 3, title: 'Buy groceries' }),
  ],
}

function renderDialog(
  overrides: Partial<{
    open: boolean
    currentFocusIds: number[]
    onClose: () => void
  }> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  vi.mocked(taskApi.listTasks).mockResolvedValue(mockTasks)
  vi.mocked(taskApi.updateTask).mockResolvedValue(baseTask())

  const props = {
    open: true,
    currentFocusIds: [1],
    onClose: vi.fn(),
    ...overrides,
  }

  render(
    <QueryClientProvider client={queryClient}>
      <FocusPickerDialog {...props} />
    </QueryClientProvider>,
  )

  return props
}

// Stub showModal / close for jsdom
beforeEach(() => {
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

describe('FocusPickerDialog', () => {
  it('renders dialog title', async () => {
    renderDialog()
    expect(screen.getByText('Add to Focus')).toBeInTheDocument()
  })

  it('shows focus count badge', () => {
    renderDialog({ currentFocusIds: [1, 2] })
    expect(screen.getByText('2/5')).toBeInTheDocument()
  })

  it('renders pending tasks from API', async () => {
    renderDialog()
    expect(await screen.findByText('Task A')).toBeInTheDocument()
    expect(screen.getByText('Task B')).toBeInTheDocument()
    expect(screen.getByText('Buy groceries')).toBeInTheDocument()
  })

  it('filters tasks by search text', async () => {
    renderDialog()
    await screen.findByText('Task A')
    fireEvent.change(screen.getByPlaceholderText('Search tasks...'), {
      target: { value: 'buy' },
    })
    expect(screen.queryByText('Task A')).not.toBeInTheDocument()
    expect(screen.getByText('Buy groceries')).toBeInTheDocument()
  })

  it('shows "Remove" for tasks already in focus', async () => {
    renderDialog({ currentFocusIds: [1] })
    await screen.findByText('Task A')
    // Task A (id=1) is in focus → Remove
    const taskARow = screen.getByText('Task A').closest('li')!
    expect(taskARow.querySelector('button')).toHaveTextContent('Remove')
  })

  it('shows "Add" for tasks not in focus', async () => {
    renderDialog({ currentFocusIds: [1] })
    await screen.findByText('Task B')
    const taskBRow = screen.getByText('Task B').closest('li')!
    expect(taskBRow.querySelector('button')).toHaveTextContent('Add')
  })

  it('calls updateTask when Add button clicked', async () => {
    renderDialog({ currentFocusIds: [] })
    await screen.findByText('Task A')
    const addBtn = screen.getAllByRole('button', { name: 'Add' })[0]
    fireEvent.click(addBtn)
    await waitFor(() => {
      expect(taskApi.updateTask).toHaveBeenCalledWith(
        expect.anything(),
        1,
        expect.objectContaining({ focus_date: expect.any(String) }),
      )
    })
  })

  it('calls updateTask with null focus_date when Remove clicked', async () => {
    renderDialog({ currentFocusIds: [1] })
    await screen.findByText('Task A')
    const removeBtn = screen.getByRole('button', { name: 'Remove' })
    fireEvent.click(removeBtn)
    await waitFor(() => {
      expect(taskApi.updateTask).toHaveBeenCalledWith(
        expect.anything(),
        1,
        { focus_date: null },
      )
    })
  })

  it('disables Add buttons when at 5-task limit', async () => {
    renderDialog({ currentFocusIds: [10, 11, 12, 13, 14] })
    await screen.findByText('Task A')
    const taskARow = screen.getByText('Task A').closest('li')!
    const btn = taskARow.querySelector('button')!
    expect(btn).toBeDisabled()
  })

  it('shows limit message when at 5 tasks', () => {
    renderDialog({ currentFocusIds: [10, 11, 12, 13, 14] })
    expect(
      screen.getByText(/Remove one to add another/),
    ).toBeInTheDocument()
  })

  it('shows "No matching tasks" when search yields no results', async () => {
    renderDialog()
    await screen.findByText('Task A')
    fireEvent.change(screen.getByPlaceholderText('Search tasks...'), {
      target: { value: 'zzzzz' },
    })
    expect(screen.getByText('No matching tasks')).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', () => {
    const props = renderDialog()
    fireEvent.click(screen.getByLabelText('Close'))
    expect(props.onClose).toHaveBeenCalled()
  })
})
