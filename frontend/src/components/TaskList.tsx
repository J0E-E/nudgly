/**
 * Task list: renders TaskListItem rows or empty state.
 */

import type { Task } from '../types/task'
import { TaskListItem } from './TaskListItem'
import './TaskList.css'

interface TaskListProps {
  tasks: Task[]
  onToggleComplete: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onSnooze: (task: Task) => void
}

export function TaskList({
  tasks,
  onToggleComplete,
  onEdit,
  onDelete,
  onSnooze,
}: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div id="task-list-empty" className="task-list-empty">
        <p id="task-list-empty-message">
          No tasks found. Add one to get started!
        </p>
      </div>
    )
  }

  return (
    <ul id="task-list" className="task-list" role="list">
      {tasks.map((task) => (
        <TaskListItem
          key={task.id}
          task={task}
          onToggleComplete={onToggleComplete}
          onEdit={onEdit}
          onDelete={onDelete}
          onSnooze={onSnooze}
        />
      ))}
    </ul>
  )
}
