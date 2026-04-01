import { TaskStatus } from '../types/task'
import type { Task } from '../types/task'
import type { DragSourceProps, DropTargetProps } from '../hooks/useDragReorder'
import './MyDayFocusItem.css'

interface MyDayFocusItemProps {
  task: Task
  onToggleComplete: (task: Task) => void
  onRemoveFromFocus: (taskId: number) => void
  dragSourceProps?: DragSourceProps
  dropTargetProps?: DropTargetProps
  isDragOver?: boolean
  'data-index'?: number
}

function formatDueTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${m.toString().padStart(2, '0')} ${suffix}`
}

export function MyDayFocusItem({
  task,
  onToggleComplete,
  onRemoveFromFocus,
  dragSourceProps,
  dropTargetProps,
  isDragOver,
  ...rest
}: MyDayFocusItemProps) {
  const completed = task.status === TaskStatus.COMPLETED

  let className = 'my-day-focus-item'
  if (completed) className += ' my-day-focus-item--completed'
  if (isDragOver) className += ' my-day-focus-item--drag-over'

  return (
    <li className={className} data-index={rest['data-index']} {...dropTargetProps}>
      <span
        className="my-day-focus-item__drag-handle"
        aria-hidden="true"
        {...dragSourceProps}
      >
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </span>
      <span className="my-day-focus-item__checkbox-wrap">
        <input
          type="checkbox"
          className="my-day-focus-item__checkbox"
          checked={completed}
          onChange={() => onToggleComplete(task)}
          aria-label={`Mark "${task.title}" as ${completed ? 'pending' : 'complete'}`}
        />
      </span>
      <span
        className={`my-day-focus-item__title${completed ? ' my-day-focus-item__title--completed' : ''}`}
      >
        {task.title}
      </span>
      {task.due_time && (
        <span className="my-day-focus-item__time">
          {formatDueTime(task.due_time)}
        </span>
      )}
      <button
        type="button"
        className="my-day-focus-item__remove-btn"
        onClick={() => onRemoveFromFocus(task.id)}
        aria-label={`Remove "${task.title}" from focus`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </li>
  )
}
