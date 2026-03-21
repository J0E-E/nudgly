import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TaskFilterBar } from './TaskFilterBar'

describe('TaskFilterBar', () => {
  const defaultProps = {
    searchText: '',
    onSearchChange: vi.fn(),
    categoryFilter: '',
    onCategoryChange: vi.fn(),
    priorityFilter: '',
    onPriorityChange: vi.fn(),
    onAddTask: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders search input', () => {
    render(<TaskFilterBar {...defaultProps} />)
    expect(screen.getByPlaceholderText(/search tasks/i)).toBeInTheDocument()
  })

  it('renders category select with all categories option', () => {
    render(<TaskFilterBar {...defaultProps} />)
    const select = document.getElementById(
      'task-filter-category'
    ) as HTMLSelectElement
    expect(select).toBeInTheDocument()
    expect(select.options[0].text).toBe('All categories')
  })

  it('renders priority select with all priorities option', () => {
    render(<TaskFilterBar {...defaultProps} />)
    const select = document.getElementById(
      'task-filter-priority'
    ) as HTMLSelectElement
    expect(select).toBeInTheDocument()
    expect(select.options[0].text).toBe('All priorities')
  })

  it('calls onSearchChange when typing', () => {
    render(<TaskFilterBar {...defaultProps} />)
    fireEvent.change(screen.getByPlaceholderText(/search tasks/i), {
      target: { value: 'test' },
    })
    expect(defaultProps.onSearchChange).toHaveBeenCalledWith('test')
  })

  it('calls onCategoryChange when selecting category', () => {
    render(<TaskFilterBar {...defaultProps} />)
    fireEvent.change(document.getElementById('task-filter-category')!, {
      target: { value: 'adulting' },
    })
    expect(defaultProps.onCategoryChange).toHaveBeenCalledWith('adulting')
  })

  it('calls onPriorityChange when selecting priority', () => {
    render(<TaskFilterBar {...defaultProps} />)
    fireEvent.change(document.getElementById('task-filter-priority')!, {
      target: { value: '3' },
    })
    expect(defaultProps.onPriorityChange).toHaveBeenCalledWith('3')
  })

  it('calls onAddTask when add button clicked', () => {
    render(<TaskFilterBar {...defaultProps} />)
    fireEvent.click(screen.getByText('Add task'))
    expect(defaultProps.onAddTask).toHaveBeenCalledOnce()
  })
})
