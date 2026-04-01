import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TaskList } from './TaskList'
import { TaskCategory, TaskStatus } from '../types/task'
import type { Task } from '../types/task'

vi.mock('../contexts/useAuth', () => ({
  useAuth: vi.fn(() => ({
    getApiDeps: vi.fn(() => ({
      getAccessToken: () => 'token',
      refreshTokens: vi.fn(),
      onUnauthorized: vi.fn(),
    })),
  })),
}))

const mockTask: Task = {
  id: 1,
  title: 'Test task',
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
  list_id: null,
  created_by: null,
  linked_friends: [],
  focus_date: null,
  focus_sort_order: 0,
}

describe('TaskList', () => {
  const handlers = {
    onToggleComplete: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onSnooze: vi.fn(),
  }

  it('renders empty state when no tasks', () => {
    render(<TaskList tasks={[]} {...handlers} />)
    expect(screen.getByText(/no tasks found/i)).toBeInTheDocument()
  })

  it('renders task items', () => {
    render(
      <TaskList
        tasks={[mockTask, { ...mockTask, id: 2, title: 'Second task' }]}
        {...handlers}
      />
    )
    expect(screen.getAllByText('Test task').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Second task').length).toBeGreaterThanOrEqual(1)
  })

  it('renders a list element', () => {
    render(<TaskList tasks={[mockTask]} {...handlers} />)
    expect(screen.getByRole('list')).toBeInTheDocument()
  })
})
