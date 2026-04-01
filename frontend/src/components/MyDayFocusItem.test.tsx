import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MyDayFocusItem } from './MyDayFocusItem'
import { TaskStatus, TaskCategory } from '../types/task'
import type { Task } from '../types/task'

const baseTask: Task = {
  id: 1,
  title: 'Write report',
  description: '',
  due_date: '2026-03-31',
  due_time: '14:30:00',
  category: TaskCategory.WORK,
  tag: '',
  priority: 2,
  recurring: null,
  stack_count: 0,
  status: TaskStatus.PENDING,
  muted_until: null,
  created_at: '2026-03-30T10:00:00Z',
  completed_at: null,
  list_id: null,
  focus_date: '2026-03-31',
  focus_sort_order: 0,
  created_by: null,
  linked_friends: [],
}

describe('MyDayFocusItem', () => {
  it('renders task title', () => {
    render(
      <MyDayFocusItem
        task={baseTask}
        onToggleComplete={vi.fn()}
        onRemoveFromFocus={vi.fn()}
      />,
    )
    expect(screen.getByText('Write report')).toBeInTheDocument()
  })

  it('renders due time when present', () => {
    render(
      <MyDayFocusItem
        task={baseTask}
        onToggleComplete={vi.fn()}
        onRemoveFromFocus={vi.fn()}
      />,
    )
    expect(screen.getByText('2:30 PM')).toBeInTheDocument()
  })

  it('hides due time when null', () => {
    const task = { ...baseTask, due_time: null }
    render(
      <MyDayFocusItem
        task={task}
        onToggleComplete={vi.fn()}
        onRemoveFromFocus={vi.fn()}
      />,
    )
    expect(screen.queryByText(/AM|PM/)).not.toBeInTheDocument()
  })

  it('renders checkbox unchecked for pending task', () => {
    render(
      <MyDayFocusItem
        task={baseTask}
        onToggleComplete={vi.fn()}
        onRemoveFromFocus={vi.fn()}
      />,
    )
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).not.toBeChecked()
  })

  it('renders checkbox checked for completed task', () => {
    const task = { ...baseTask, status: TaskStatus.COMPLETED }
    render(
      <MyDayFocusItem
        task={task}
        onToggleComplete={vi.fn()}
        onRemoveFromFocus={vi.fn()}
      />,
    )
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('applies completed modifier class when completed', () => {
    const task = { ...baseTask, status: TaskStatus.COMPLETED }
    const { container } = render(
      <MyDayFocusItem
        task={task}
        onToggleComplete={vi.fn()}
        onRemoveFromFocus={vi.fn()}
      />,
    )
    expect(container.querySelector('.my-day-focus-item--completed')).toBeInTheDocument()
  })

  it('calls onToggleComplete when checkbox clicked', () => {
    const onToggle = vi.fn()
    render(
      <MyDayFocusItem
        task={baseTask}
        onToggleComplete={onToggle}
        onRemoveFromFocus={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onToggle).toHaveBeenCalledWith(baseTask)
  })

  it('renders remove button with correct aria-label', () => {
    render(
      <MyDayFocusItem
        task={baseTask}
        onToggleComplete={vi.fn()}
        onRemoveFromFocus={vi.fn()}
      />,
    )
    expect(
      screen.getByLabelText('Remove "Write report" from focus'),
    ).toBeInTheDocument()
  })

  it('calls onRemoveFromFocus with task id when remove button clicked', () => {
    const onRemove = vi.fn()
    render(
      <MyDayFocusItem
        task={baseTask}
        onToggleComplete={vi.fn()}
        onRemoveFromFocus={onRemove}
      />,
    )
    fireEvent.click(screen.getByLabelText('Remove "Write report" from focus'))
    expect(onRemove).toHaveBeenCalledWith(1)
  })

  it('renders drag handle', () => {
    const { container } = render(
      <MyDayFocusItem
        task={baseTask}
        onToggleComplete={vi.fn()}
        onRemoveFromFocus={vi.fn()}
      />,
    )
    expect(container.querySelector('.my-day-focus-item__drag-handle')).toBeInTheDocument()
  })

  it('applies drag-over class when isDragOver is true', () => {
    const { container } = render(
      <MyDayFocusItem
        task={baseTask}
        onToggleComplete={vi.fn()}
        onRemoveFromFocus={vi.fn()}
        isDragOver
      />,
    )
    expect(container.querySelector('.my-day-focus-item--drag-over')).toBeInTheDocument()
  })

  it('does not apply drag-over class when isDragOver is false', () => {
    const { container } = render(
      <MyDayFocusItem
        task={baseTask}
        onToggleComplete={vi.fn()}
        onRemoveFromFocus={vi.fn()}
        isDragOver={false}
      />,
    )
    expect(container.querySelector('.my-day-focus-item--drag-over')).not.toBeInTheDocument()
  })
})
