/**
 * Single task row with tap-to-expand detail view.
 * Tapping the content area (not checkbox) toggles an expanded section
 * showing full task details and action buttons.
 */

import { useState } from 'react'
import type { Task } from '../types/task'
import {
  TaskStatus,
  TASK_CATEGORY_LABELS,
  TASK_PRIORITY_LABELS,
} from '../types/task'
import './TaskListItem.css'

interface TaskListItemProps {
  task: Task
  onToggleComplete: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

function isOverdue(task: Task): boolean {
  if (!task.due_date || task.status === TaskStatus.COMPLETED) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(task.due_date) < today
}

function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function TaskListItem({
  task,
  onToggleComplete,
  onEdit,
  onDelete,
}: TaskListItemProps) {
  const [expanded, setExpanded] = useState(false)
  const completed = task.status === TaskStatus.COMPLETED
  const overdue = isOverdue(task)

  return (
    <li
      id={`task-${task.id}`}
      className={`task-list-item${completed ? ' task-list-item--completed' : ''}${expanded ? ' task-list-item--expanded' : ''}`}
    >
      <div className="task-list-item-checkbox-wrap">
        <input
          id={`task-${task.id}-checkbox`}
          type="checkbox"
          className="task-list-item-checkbox"
          checked={completed}
          onChange={() => onToggleComplete(task)}
          aria-label={`Mark "${task.title}" as ${completed ? 'pending' : 'complete'}`}
        />
      </div>
      <button
        type="button"
        className="task-list-item-content"
        aria-expanded={expanded}
        aria-controls={`task-${task.id}-details`}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="task-list-item-content-text">
          <span
            id={`task-${task.id}-title`}
            className={`task-list-item-title${completed ? ' task-list-item-title--completed' : ''}`}
          >
            {task.title}
          </span>
          <div className="task-list-item-meta">
            {task.due_date && (
              <span
                id={`task-${task.id}-due`}
                className={`task-list-item-due${overdue ? ' task-list-item-due--overdue' : ''}`}
              >
                {formatDueDate(task.due_date)}
              </span>
            )}
            <span
              id={`task-${task.id}-category`}
              className="task-list-item-category"
            >
              {TASK_CATEGORY_LABELS[task.category]}
            </span>
            {task.priority > 0 && (
              <span
                id={`task-${task.id}-priority`}
                className="task-list-item-priority"
              >
                {TASK_PRIORITY_LABELS[task.priority]}
              </span>
            )}
          </div>
        </div>
        <svg className="task-list-item-chevron" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <div
        id={`task-${task.id}-details`}
        className="task-list-item-details"
        role="region"
        aria-labelledby={`task-${task.id}-title`}
        aria-hidden={!expanded}
      >
        <div className="task-list-item-details-inner">
          {task.description && (
            <p className="task-list-item-detail-row">
              <span className="task-list-item-detail-label">Description</span>
              <span>{task.description}</span>
            </p>
          )}
          {task.tag && (
            <p className="task-list-item-detail-row">
              <span className="task-list-item-detail-label">Tag</span>
              <span>{task.tag}</span>
            </p>
          )}
          <p className="task-list-item-detail-row">
            <span className="task-list-item-detail-label">Created</span>
            <span>{formatDateTime(task.created_at)}</span>
          </p>
          <p className="task-list-item-detail-row">
            <span className="task-list-item-detail-label">Status</span>
            <span>
              {capitalize(task.status)}
              {completed && task.completed_at
                ? ` on ${formatDateTime(task.completed_at)}`
                : ''}
            </span>
          </p>
          {task.muted_until && (
            <p className="task-list-item-detail-row">
              <span className="task-list-item-detail-label">Muted until</span>
              <span>{formatDateTime(task.muted_until)}</span>
            </p>
          )}
          <div className="task-list-item-actions">
            <button
              id={`task-${task.id}-edit-btn`}
              type="button"
              className="task-list-item-edit"
              onClick={() => onEdit(task)}
              aria-label={`Edit "${task.title}"`}
            >
              Edit
            </button>
            <button
              id={`task-${task.id}-delete-btn`}
              type="button"
              className="task-list-item-delete"
              onClick={() => onDelete(task)}
              aria-label={`Delete "${task.title}"`}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}
