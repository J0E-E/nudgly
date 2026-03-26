/**
 * Search and filter bar for the lists screen.
 * Compact layout: search input + filter popover button.
 */

import { useState, useRef, useEffect } from 'react'
import {
  TaskCategory,
  TASK_CATEGORY_LABELS,
  TASK_PRIORITY_LABELS,
} from '../types/task'
import './ListFilterBar.css'

interface ListFilterBarProps {
  searchText: string
  onSearchChange: (value: string) => void
  categoryFilter: string
  onCategoryChange: (value: string) => void
  priorityFilter: string
  onPriorityChange: (value: string) => void
  onAddList: () => void
}

export function ListFilterBar({
  searchText,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  priorityFilter,
  onPriorityChange,
  onAddList,
}: ListFilterBarProps) {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  const hasActiveFilters = !!categoryFilter || !!priorityFilter

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
    setOpen(false)
  }

  return (
    <div id="list-filter-bar" className="list-filter-bar">
      <input
        id="list-filter-search"
        type="search"
        className="list-filter-search"
        placeholder="Search lists..."
        value={searchText}
        onChange={(e) => onSearchChange(e.target.value)}
        aria-label="Search lists by name"
      />
      <div className="list-filter-popover-anchor" ref={popoverRef}>
        <button
          id="list-filter-toggle"
          type="button"
          className="list-filter-toggle"
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
            <span className="list-filter-indicator" aria-label="Filters active" />
          )}
        </button>
        {open && (
          <div className="list-filter-popover" role="dialog" aria-label="Filter options">
            <select
              id="list-filter-category"
              className="list-filter-select"
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
              id="list-filter-priority"
              className="list-filter-select"
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
            {hasActiveFilters && (
              <button
                type="button"
                className="list-filter-clear"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
      <button
        id="list-add-btn"
        type="button"
        className="list-add-btn"
        onClick={onAddList}
      >
        Add list
      </button>
    </div>
  )
}
