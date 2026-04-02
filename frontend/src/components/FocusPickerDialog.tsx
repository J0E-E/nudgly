import { useRef, useEffect, useState } from 'react'
import { useTaskList, useUpdateTask } from '../hooks/useTasks'
import { TaskStatus } from '../types/task'
import './FocusPickerDialog.css'

const FOCUS_LIMIT = 5

interface FocusPickerDialogProps {
  open: boolean
  currentFocusIds: number[]
  onClose: () => void
}

export function FocusPickerDialog({
  open,
  currentFocusIds,
  onClose,
}: FocusPickerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<Element | null>(null)
  const [searchText, setSearchText] = useState('')

  const { data: taskData, isLoading } = useTaskList(TaskStatus.PENDING)
  const updateTask = useUpdateTask()

  const focusCount = currentFocusIds.length
  const atLimit = focusCount >= FOCUS_LIMIT

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      triggerRef.current = document.activeElement
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus()
      }
    }
  }, [open])

  useEffect(() => {
    if (!open) setSearchText('')
  }, [open])

  const focusIdSet = new Set(currentFocusIds)
  const allTasks = taskData?.results ?? []
  const filteredTasks = allTasks.filter((task) =>
    task.title.toLowerCase().includes(searchText.toLowerCase()),
  )

  function handleToggleFocus(taskId: number) {
    const isFocused = focusIdSet.has(taskId)
    if (!isFocused && atLimit) return
    const todayStr = new Date().toISOString().split('T')[0]
    updateTask.mutate({
      id: taskId,
      payload: { focus_date: isFocused ? null : todayStr },
    })
  }

  return (
    <dialog
      id="focus-picker-dialog"
      ref={dialogRef}
      className="focus-picker-dialog"
      aria-labelledby="focus-picker-title"
      onClose={onClose}
    >
      <header id="focus-picker-dialog-header" className="focus-picker-dialog__header">
        <h2 id="focus-picker-title" className="focus-picker-dialog__title">
          Add to Focus
        </h2>
        <span id="focus-picker-dialog-count" className="focus-picker-dialog__count">
          {focusCount}/{FOCUS_LIMIT}
        </span>
        <button
          id="focus-picker-dialog-close-btn"
          type="button"
          className="focus-picker-dialog__close-btn"
          onClick={onClose}
          aria-label="Close"
        >
          <svg
            id="focus-picker-dialog-close-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line id="focus-picker-dialog-close-line-1" x1="18" y1="6" x2="6" y2="18" />
            <line id="focus-picker-dialog-close-line-2" x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </header>

      {atLimit && (
        <p id="focus-picker-dialog-limit-msg" className="focus-picker-dialog__limit-message">
          Focus works best with 3–5 tasks. Remove one to add another.
        </p>
      )}

      <input
        id="focus-picker-dialog-search"
        type="search"
        className="focus-picker-dialog__search"
        placeholder="Search tasks..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
      />

      {isLoading ? (
        <p id="focus-picker-dialog-loading" className="focus-picker-dialog__empty">Loading tasks…</p>
      ) : filteredTasks.length === 0 ? (
        <p id="focus-picker-dialog-empty" className="focus-picker-dialog__empty">No matching tasks</p>
      ) : (
        <ul id="focus-picker-dialog-list" className="focus-picker-dialog__list">
          {filteredTasks.map((task) => {
            const isFocused = focusIdSet.has(task.id)
            return (
              <li key={task.id} id={`focus-picker-task-${task.id}`} className="focus-picker-dialog__item">
                <span id={`focus-picker-task-${task.id}-title`} className="focus-picker-dialog__item-title">
                  {task.title}
                </span>
                <button
                  id={`focus-picker-task-${task.id}-toggle-btn`}
                  type="button"
                  className={`focus-picker-dialog__toggle-btn ${isFocused ? 'focus-picker-dialog__toggle-btn--remove' : 'focus-picker-dialog__toggle-btn--add'}`}
                  onClick={() => handleToggleFocus(task.id)}
                  disabled={(!isFocused && atLimit) || updateTask.isPending}
                >
                  {isFocused ? 'Remove' : 'Add'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </dialog>
  )
}
