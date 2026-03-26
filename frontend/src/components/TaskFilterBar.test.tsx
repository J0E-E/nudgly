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

  function openFilterPopover() {
    fireEvent.click(screen.getByLabelText('Toggle filters'))
  }

  it('renders search input', () => {
    render(<TaskFilterBar {...defaultProps} />)
    expect(screen.getByPlaceholderText(/search tasks/i)).toBeInTheDocument()
  })

  it('renders category select inside popover', () => {
    render(<TaskFilterBar {...defaultProps} />)
    openFilterPopover()
    const select = document.getElementById(
      'task-filter-category'
    ) as HTMLSelectElement
    expect(select).toBeInTheDocument()
    expect(select.options[0].text).toBe('All categories')
  })

  it('renders priority select inside popover', () => {
    render(<TaskFilterBar {...defaultProps} />)
    openFilterPopover()
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
    openFilterPopover()
    fireEvent.change(document.getElementById('task-filter-category')!, {
      target: { value: 'work' },
    })
    expect(defaultProps.onCategoryChange).toHaveBeenCalledWith('work')
  })

  it('calls onPriorityChange when selecting priority', () => {
    render(<TaskFilterBar {...defaultProps} />)
    openFilterPopover()
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

  it('shows active filter indicator when filters are set', () => {
    render(<TaskFilterBar {...defaultProps} categoryFilter="work" />)
    expect(screen.getByLabelText('Filters active')).toBeInTheDocument()
  })

  it('does not show indicator when no filters active', () => {
    render(<TaskFilterBar {...defaultProps} />)
    expect(screen.queryByLabelText('Filters active')).not.toBeInTheDocument()
  })
})
