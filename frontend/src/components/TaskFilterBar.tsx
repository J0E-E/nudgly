/**
 * Search and filter bar for the tasks screen.
 */

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
}

export function TaskFilterBar({
  searchText,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  priorityFilter,
  onPriorityChange,
  onAddTask,
}: TaskFilterBarProps) {
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
