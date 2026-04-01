import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TaskListItem } from './TaskListItem'
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

const baseTask: Task = {
  id: 1,
  title: 'Buy groceries',
  description: 'Milk, eggs, bread',
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
  focus_date: null,
  focus_sort_order: 0,
}

function renderItem(taskOverrides: Partial<Task> = {}) {
  const props = {
    task: { ...baseTask, ...taskOverrides },
    onToggleComplete: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onSnooze: vi.fn(),
  }
  render(<TaskListItem {...props} />)
  return props
}

function getToggleButton() {
  return document.querySelector(
    '[aria-controls="task-1-details"]'
  ) as HTMLElement
}

function expand() {
  fireEvent.click(getToggleButton())
}

describe('TaskListItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --- Existing rendering tests ---

  it('renders task title', () => {
    renderItem()
    const titles = screen.getAllByText('Buy groceries')
    expect(titles.length).toBeGreaterThanOrEqual(1)
  })

  it('renders due date', () => {
    renderItem()
    const matches = screen.getAllByText('Apr 1')
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('renders category label', () => {
    renderItem()
    const matches = screen.getAllByText('Work')
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('renders priority label when priority > 0', () => {
    renderItem()
    const matches = screen.getAllByText('High')
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('does not render priority label when priority is 0', () => {
    renderItem({ priority: 0 })
    expect(screen.queryByText('None')).not.toBeInTheDocument()
  })

  it('checkbox is unchecked for pending task', () => {
    renderItem()
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('checkbox is checked for completed task', () => {
    renderItem({ status: TaskStatus.COMPLETED })
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('calls onToggleComplete when checkbox changed', () => {
    const { onToggleComplete } = renderItem()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onToggleComplete).toHaveBeenCalledWith(baseTask)
  })

  it('calls onEdit when edit button clicked (after expanding)', () => {
    const { onEdit } = renderItem()
    expand()
    fireEvent.click(screen.getByText('Edit'))
    expect(onEdit).toHaveBeenCalledWith(baseTask)
  })

  it('calls onDelete when delete button clicked (after expanding)', () => {
    const { onDelete } = renderItem()
    expand()
    fireEvent.click(screen.getByText('Delete'))
    expect(onDelete).toHaveBeenCalledWith(baseTask)
  })

  it('applies completed styling class', () => {
    renderItem({ status: TaskStatus.COMPLETED })
    const item = document.getElementById('task-1')
    expect(item?.className).toContain('task-list-item--completed')
  })

  it('applies strikethrough class on completed title', () => {
    renderItem({ status: TaskStatus.COMPLETED })
    const title = document.getElementById('task-1-title')
    expect(title?.className).toContain('task-list-item-title--completed')
  })

  // --- Expand/collapse behavior ---

  it('is collapsed by default', () => {
    renderItem()
    expect(getToggleButton()).toHaveAttribute('aria-expanded', 'false')
    const details = document.getElementById('task-1-details')
    expect(details).toHaveAttribute('aria-hidden', 'true')
  })

  it('expands on content click', () => {
    renderItem()
    expand()
    expect(getToggleButton()).toHaveAttribute('aria-expanded', 'true')
    const details = document.getElementById('task-1-details')
    expect(details).toHaveAttribute('aria-hidden', 'false')
  })

  it('collapses on second click', () => {
    renderItem()
    expand()
    expand()
    expect(getToggleButton()).toHaveAttribute('aria-expanded', 'false')
    const details = document.getElementById('task-1-details')
    expect(details).toHaveAttribute('aria-hidden', 'true')
  })

  it('applies expanded class on li', () => {
    renderItem()
    expand()
    const item = document.getElementById('task-1')
    expect(item?.className).toContain('task-list-item--expanded')
  })

  it('checkbox click does not toggle expand', () => {
    renderItem()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(getToggleButton()).toHaveAttribute('aria-expanded', 'false')
  })

  // --- Detail fields when expanded ---

  it('shows description when expanded and non-empty', () => {
    renderItem({ description: 'Milk, eggs, bread' })
    expand()
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByText('Milk, eggs, bread')).toBeInTheDocument()
  })

  it('hides description when empty', () => {
    renderItem({ description: '' })
    expand()
    expect(screen.queryByText('Description')).not.toBeInTheDocument()
  })

  it('shows tag when expanded and non-empty', () => {
    renderItem({ tag: 'groceries' })
    expand()
    expect(screen.getByText('Tag')).toBeInTheDocument()
    expect(screen.getByText('groceries')).toBeInTheDocument()
  })

  it('hides tag when empty', () => {
    renderItem({ tag: '' })
    expand()
    expect(screen.queryByText('Tag')).not.toBeInTheDocument()
  })

  it('shows created date when expanded', () => {
    renderItem()
    expand()
    expect(screen.getByText('Created')).toBeInTheDocument()
  })

  it('shows status when expanded', () => {
    renderItem()
    expand()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('shows completed date for completed task', () => {
    renderItem({
      status: TaskStatus.COMPLETED,
      completed_at: '2026-03-21T14:00:00Z',
    })
    expand()
    expect(screen.getByText(/Completed on/)).toBeInTheDocument()
  })

  it('shows muted until when set', () => {
    renderItem({ muted_until: '2026-04-01T00:00:00Z' })
    expand()
    expect(screen.getByText('Muted until')).toBeInTheDocument()
  })

  it('hides muted until when null', () => {
    renderItem({ muted_until: null })
    expand()
    expect(screen.queryByText('Muted until')).not.toBeInTheDocument()
  })

  // --- Actions accessibility ---

  it('details panel is aria-hidden when collapsed', () => {
    renderItem()
    const details = document.getElementById('task-1-details')
    expect(details).toHaveAttribute('aria-hidden', 'true')
  })

  it('details panel is not aria-hidden when expanded', () => {
    renderItem()
    expand()
    const details = document.getElementById('task-1-details')
    expect(details).toHaveAttribute('aria-hidden', 'false')
  })

  // --- Muted info in expanded view ---

  it('shows muted until row when muted_until is in the future', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString()
    renderItem({ muted_until: futureDate })
    expand()
    expect(screen.getByText('Muted until')).toBeInTheDocument()
  })

  it('hides muted until row when muted_until is null', () => {
    renderItem({ muted_until: null })
    expand()
    expect(screen.queryByText('Muted until')).not.toBeInTheDocument()
  })

  it('hides muted until row when muted_until is in the past', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString()
    renderItem({ muted_until: pastDate })
    expand()
    expect(screen.queryByText('Muted until')).not.toBeInTheDocument()
  })

  // --- Snooze button ---

  it('calls onSnooze when snooze button clicked (after expanding)', () => {
    const { onSnooze } = renderItem()
    expand()
    fireEvent.click(screen.getByText('Snooze'))
    expect(onSnooze).toHaveBeenCalledWith(baseTask)
  })
})
