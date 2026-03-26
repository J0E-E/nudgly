/**
 * Search and filter bar for the tasks screen.
 * Compact layout: search input + filter popover button.
 */

import { useState, useRef, useEffect } from 'react'
import {
  TaskCategory,
  TASK_CATEGORY_LABELS,
  TASK_PRIORITY_LABELS,
} from '../types/task'
import './TaskFilterBar.css'

interface TaskFilterBarProps {
  searchText: string
  onSearchChange: (value: string) => void
  categoryFilter: string
  onCategoryChange: (value: string) => void
  priorityFilter: string
  onPriorityChange: (value: string) => void
  onAddTask: () => void
  listFilter?: string
  onListFilterChange?: (value: string) => void
  createdForMe?: boolean
  onCreatedForMeChange?: (value: boolean) => void
}

export function TaskFilterBar({
  searchText,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  priorityFilter,
  onPriorityChange,
  onAddTask,
  listFilter,
  onListFilterChange,
  createdForMe,
  onCreatedForMeChange,
}: TaskFilterBarProps) {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  const hasActiveFilters =
    !!categoryFilter || !!priorityFilter || !!(listFilter) || !!createdForMe

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  function clearFilters() {
    onCategoryChange('')
    onPriorityChange('')
    onListFilterChange?.('')
    onCreatedForMeChange?.(false)
    setOpen(false)
  }

  return (
    <div id="task-filter-bar" className="task-filter-bar">
      <input
        id="task-filter-search"
        type="search"
        className="task-filter-search"
        placeholder="Search tasks..."
        value={searchText}
        onChange={(e) => onSearchChange(e.target.value)}
        aria-label="Search tasks by title or description"
      />
      <div className="task-filter-popover-anchor" ref={popoverRef}>
        <button
          id="task-filter-toggle"
          type="button"
          className="task-filter-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle filters"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 .8 1.6L14 13.28V19a1 1 0 0 1-.55.9l-3 1.5A1 1 0 0 1 9 20.5v-7.22L2.2 4.6A1 1 0 0 1 3 4Z" />
          </svg>
          {hasActiveFilters && (
            <span className="task-filter-indicator" aria-label="Filters active" />
          )}
        </button>
        {open && (
          <div className="task-filter-popover" role="dialog" aria-label="Filter options">
            <select
              id="task-filter-category"
              className="task-filter-select"
              value={categoryFilter}
              onChange={(e) => onCategoryChange(e.target.value)}
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {Object.values(TaskCategory).map((cat) => (
                <option key={cat} value={cat}>
                  {TASK_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
            <select
              id="task-filter-priority"
              className="task-filter-select"
              value={priorityFilter}
              onChange={(e) => onPriorityChange(e.target.value)}
              aria-label="Filter by priority"
            >
              <option value="">All priorities</option>
              {Object.entries(TASK_PRIORITY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
            {onListFilterChange && (
              <select
                id="task-filter-list"
                className="task-filter-select"
                value={listFilter ?? ''}
                onChange={(e) => onListFilterChange(e.target.value)}
                aria-label="Filter by list assignment"
              >
                <option value="">All tasks</option>
                <option value="none">Unassigned only</option>
              </select>
            )}
            {onCreatedForMeChange && (
              <label className="task-filter-checkbox">
                <input
                  id="task-filter-created-for-me"
                  type="checkbox"
                  checked={createdForMe ?? false}
                  onChange={(e) => onCreatedForMeChange(e.target.checked)}
                />{' '}
                Created for me
              </label>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                className="task-filter-clear"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
      <button
        id="task-add-btn"
        type="button"
        className="task-add-btn"
        onClick={onAddTask}
      >
        Add task
      </button>
    </div>
  )
}
