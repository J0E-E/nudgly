/**
 * Search and filter bar for the lists screen.
 */

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
