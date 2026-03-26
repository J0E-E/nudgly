/**
 * Task form modal: add or edit a task via native <dialog>.
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import type { Task, TaskCreatePayload, TaskUpdatePayload } from '../types/task'
import {
  TaskCategory,
  TASK_CATEGORY_LABELS,
  TASK_PRIORITY_LABELS,
  RecurringOptions,
  RECURRING_LABELS,
} from '../types/task'
import { useCreateTask, useUpdateTask } from '../hooks/useTasks'
import { useFriendList } from '../hooks/useFriends'
import './TaskFormModal.css'

interface TaskFormModalProps {
  open: boolean
  mode: 'create' | 'edit'
  task?: Task
  onClose: () => void
  listId?: number
  defaultCategory?: string
  defaultTag?: string
  defaultPriority?: number
}

interface FormValues {
  title: string
  description: string
  dueDate: string
  dueTime: string
  category: string
  priority: string
  tag: string
  recurring: string
  linkedFriendIds: number[]
  createdForUserId: number | null
}

const EMPTY_FORM: FormValues = {
  title: '',
  description: '',
  dueDate: '',
  dueTime: '',
  category: '',
  priority: '0',
  tag: '',
  recurring: '',
  linkedFriendIds: [],
  createdForUserId: null,
}

interface ListDefaults {
  defaultCategory?: string
  defaultTag?: string
  defaultPriority?: number
}

function getInitialValues(
  mode: 'create' | 'edit',
  task?: Task,
  listDefaults?: ListDefaults
): FormValues {
  if (mode === 'edit' && task) {
    return {
      title: task.title,
      description: task.description,
      dueDate: task.due_date ?? '',
      dueTime: task.due_time ?? '',
      category: task.category as string,
      priority: String(task.priority),
      tag: task.tag,
      recurring: task.recurring ?? '',
      linkedFriendIds: task.linked_friends.map((f) => f.id),
      createdForUserId: null,
    }
  }
  if (listDefaults) {
    return {
      ...EMPTY_FORM,
      category: listDefaults.defaultCategory ?? '',
      tag: listDefaults.defaultTag ?? '',
      priority: String(listDefaults.defaultPriority ?? 0),
    }
  }
  return EMPTY_FORM
}

const VALID_CATEGORIES = new Set<string>(Object.values(TaskCategory))

export function TaskFormModal({
  open,
  mode,
  task,
  onClose,
  listId,
  defaultCategory,
  defaultTag,
  defaultPriority,
}: TaskFormModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<Element | null>(null)

  const createMutation = useCreateTask()
  const updateMutation = useUpdateTask()
  const { data: friends = [] } = useFriendList()

  const initialValues = useMemo(
    () =>
      open
        ? getInitialValues(mode, task, {
            defaultCategory,
            defaultTag,
            defaultPriority,
          })
        : null,
    [open, mode, task, defaultCategory, defaultTag, defaultPriority]
  )

  const [form, setForm] = useState<FormValues>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [appliedInit, setAppliedInit] = useState<typeof initialValues>(null)

  if (initialValues && initialValues !== appliedInit) {
    setForm(initialValues)
    setFormError(null)
    setAppliedInit(initialValues)
  }

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

  function handleClose() {
    setFormError(null)
    onClose()
  }

  function updateField<K extends keyof FormValues>(
    key: K,
    value: FormValues[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!form.title.trim()) {
      setFormError('Title is required.')
      return
    }
    if (!form.category || !VALID_CATEGORIES.has(form.category)) {
      setFormError('Category is required.')
      return
    }

    try {
      const common = {
        title: form.title.trim(),
        category: form.category as TaskCategory,
        description: form.description.trim(),
        due_date: form.dueDate || null,
        due_time: form.dueTime || null,
        priority: Number(form.priority),
        tag: form.tag.trim(),
        recurring: form.recurring || null,
      }
      if (mode === 'create') {
        const createPayload: TaskCreatePayload = {
          ...common,
          ...(listId != null ? { list_id: listId } : {}),
          ...(form.linkedFriendIds.length > 0
            ? { linked_friend_ids: form.linkedFriendIds }
            : {}),
          ...(form.createdForUserId
            ? { created_for_user_id: form.createdForUserId }
            : {}),
        }
        await createMutation.mutateAsync(createPayload)
      } else if (task) {
        await updateMutation.mutateAsync({
          id: task.id,
          payload: {
            ...common,
            linked_friend_ids: form.linkedFriendIds,
          } as TaskUpdatePayload,
        })
      }
      handleClose()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  const submitting = createMutation.isPending || updateMutation.isPending

  return (
    <dialog
      id="task-form-dialog"
      ref={dialogRef}
      className="task-form-dialog"
      aria-labelledby="task-form-title"
      onClose={handleClose}
    >
      <h2 id="task-form-title" className="task-form-title">
        {mode === 'create' ? 'Add task' : 'Edit task'}
      </h2>
      <form id="task-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <p id="task-form-error" className="task-form-error" role="alert">
            {formError}
          </p>
        )}
        <div className="task-form-field">
          <label htmlFor="task-form-title-input">Title</label>
          <input
            id="task-form-title-input"
            type="text"
            value={form.title}
            onChange={(e) => updateField('title', e.target.value)}
            required
            maxLength={500}
            disabled={submitting}
          />
        </div>
        <div className="task-form-field">
          <label htmlFor="task-form-description-input">Description</label>
          <textarea
            id="task-form-description-input"
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            maxLength={5000}
            rows={3}
            disabled={submitting}
          />
        </div>
        {mode === 'create' && friends.length > 0 && (
          <div className="task-form-field">
            <label htmlFor="task-form-assign-friend-input">
              Assign to friend (optional)
            </label>
            <select
              id="task-form-assign-friend-input"
              value={form.createdForUserId ?? ''}
              onChange={(e) =>
                updateField(
                  'createdForUserId',
                  e.target.value ? Number(e.target.value) : null
                )
              }
              disabled={submitting}
            >
              <option value="">None</option>
              {friends.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.display_name || f.username}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="task-form-field">
          <label htmlFor="task-form-due-date-input">Due date</label>
          <input
            id="task-form-due-date-input"
            type="date"
            value={form.dueDate}
            onChange={(e) => {
              const val = e.target.value
              updateField('dueDate', val)
              if (!val) {
                updateField('dueTime', '')
                updateField('recurring', '')
              }
            }}
            disabled={submitting}
          />
        </div>
        <div className="task-form-field">
          <label htmlFor="task-form-due-time-input">Due time (optional)</label>
          <input
            id="task-form-due-time-input"
            type="time"
            value={form.dueTime}
            onChange={(e) => updateField('dueTime', e.target.value)}
            disabled={submitting || !form.dueDate}
          />
        </div>
        <div className="task-form-field">
          <label htmlFor="task-form-recurring-input">Repeat (optional)</label>
          <select
            id="task-form-recurring-input"
            value={form.recurring}
            onChange={(e) => updateField('recurring', e.target.value)}
            disabled={submitting || !form.dueDate}
          >
            <option value="">None</option>
            {Object.values(RecurringOptions).map((val) => (
              <option key={val} value={val}>
                {RECURRING_LABELS[val]}
              </option>
            ))}
          </select>
        </div>
        <div className="task-form-field">
          <label htmlFor="task-form-category-input">Category</label>
          <select
            id="task-form-category-input"
            value={form.category}
            onChange={(e) => updateField('category', e.target.value)}
            required
            disabled={submitting}
          >
            <option value="" disabled>
              Select category
            </option>
            {Object.values(TaskCategory).map((cat) => (
              <option key={cat} value={cat}>
                {TASK_CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </div>
        <div className="task-form-field">
          <label htmlFor="task-form-priority-input">Priority</label>
          <select
            id="task-form-priority-input"
            value={form.priority}
            onChange={(e) => updateField('priority', e.target.value)}
            disabled={submitting}
          >
            {Object.entries(TASK_PRIORITY_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="task-form-field">
          <label htmlFor="task-form-tag-input">Tag (optional)</label>
          <input
            id="task-form-tag-input"
            type="text"
            value={form.tag}
            onChange={(e) => updateField('tag', e.target.value)}
            maxLength={255}
            disabled={submitting}
          />
        </div>
        {friends.length > 0 && (
          <div className="task-form-field">
            <label>Link friends (optional)</label>
            <div className="task-form-friend-checkboxes">
              {friends.map((f) => (
                <label key={f.id}>
                  <input
                    type="checkbox"
                    checked={form.linkedFriendIds.includes(f.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        updateField('linkedFriendIds', [
                          ...form.linkedFriendIds,
                          f.id,
                        ])
                      } else {
                        updateField(
                          'linkedFriendIds',
                          form.linkedFriendIds.filter((id) => id !== f.id)
                        )
                      }
                    }}
                    disabled={submitting}
                  />{' '}
                  {f.display_name || f.username}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="task-form-actions">
          <button
            id="task-form-cancel-btn"
            type="button"
            className="task-form-cancel"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            id="task-form-submit-btn"
            type="submit"
            className="task-form-submit"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting
              ? 'Saving...'
              : mode === 'create'
                ? 'Add task'
                : 'Save changes'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
