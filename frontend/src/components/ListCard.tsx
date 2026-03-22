/**
 * List card: single row in the lists screen, links to list detail.
 */

import { Link } from 'react-router-dom'
import type { List } from '../types/list'
import type { TaskCategory } from '../types/task'
import { TASK_CATEGORY_LABELS, TASK_PRIORITY_LABELS } from '../types/task'
import './ListCard.css'

interface ListCardProps {
  list: List
  onEdit: (list: List) => void
  onDelete: (list: List) => void
}

export function ListCard({ list, onEdit, onDelete }: ListCardProps) {
  return (
    <li className="list-card">
      <Link
        to={`/lists/${list.id}`}
        className="list-card-link"
        aria-label={`Open list ${list.name}`}
      >
        <div className="list-card-main">
          <span className="list-card-name">{list.name}</span>
          <span className="list-card-count">
            {list.task_count} {list.task_count === 1 ? 'task' : 'tasks'}
          </span>
        </div>
        <div className="list-card-meta">
          {list.category && (
            <span className="list-card-badge list-card-category">
              {TASK_CATEGORY_LABELS[list.category as TaskCategory] ??
                list.category}
            </span>
          )}
          {list.priority > 0 && (
            <span className="list-card-badge list-card-priority">
              {TASK_PRIORITY_LABELS[list.priority]}
            </span>
          )}
          {list.tag && (
            <span className="list-card-badge list-card-tag">{list.tag}</span>
          )}
        </div>
      </Link>
      <div className="list-card-actions">
        <button
          type="button"
          className="list-card-action-btn"
          aria-label={`Edit list ${list.name}`}
          onClick={(e) => {
            e.preventDefault()
            onEdit(list)
          }}
        >
          Edit
        </button>
        <button
          type="button"
          className="list-card-action-btn list-card-action-btn--danger"
          aria-label={`Delete list ${list.name}`}
          onClick={(e) => {
            e.preventDefault()
            onDelete(list)
          }}
        >
          Delete
        </button>
      </div>
    </li>
  )
}
