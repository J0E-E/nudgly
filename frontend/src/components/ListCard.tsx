/**
 * List card: single-line row in the lists screen, links to list detail.
 * Mirrors the TaskListItem layout: name + inline meta + chevron.
 */

import { useState, useRef, useEffect } from 'react'
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
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  return (
    <li className="list-card">
      <Link
        to={`/lists/${list.id}`}
        className="list-card-link"
        aria-label={`Open list ${list.name}`}
      >
        <div className="list-card-content">
          <span className="list-card-name">{list.name}</span>
          <div className="list-card-meta">
            <span className="list-card-count">
              {list.task_count} {list.task_count === 1 ? 'task' : 'tasks'}
            </span>
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
        </div>
      </Link>
      <div className="list-card-menu-wrap" ref={menuRef}>
        <button
          type="button"
          className="list-card-ellipsis"
          aria-label={`Actions for list ${list.name}`}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          &#x22EE;
        </button>
        {menuOpen && (
          <div className="list-card-dropdown" role="menu">
            <button
              type="button"
              className="list-card-dropdown-item"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                onEdit(list)
              }}
            >
              Edit
            </button>
            <button
              type="button"
              className="list-card-dropdown-item list-card-dropdown-item--danger"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                onDelete(list)
              }}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </li>
  )
}
