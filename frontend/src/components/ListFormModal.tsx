/**
 * List form modal: add or edit a list via native <dialog>.
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import type { List } from '../types/list'
import type { ListCreatePayload, ListUpdatePayload } from '../types/list'
import {
  TaskCategory,
  TASK_CATEGORY_LABELS,
  TASK_PRIORITY_LABELS,
} from '../types/task'
import { useCreateList, useUpdateList } from '../hooks/useLists'
import './ListFormModal.css'

interface ListFormModalProps {
  open: boolean
  mode: 'create' | 'edit'
  list?: List
  onClose: () => void
}

interface FormValues {
  name: string
  category: string
  priority: string
  tag: string
}

const EMPTY_FORM: FormValues = {
  name: '',
  category: '',
  priority: '0',
  tag: '',
}

function getInitialValues(mode: 'create' | 'edit', list?: List): FormValues {
  if (mode === 'edit' && list) {
    return {
      name: list.name,
      category: list.category,
      priority: String(list.priority),
      tag: list.tag,
    }
  }
  return EMPTY_FORM
}

export function ListFormModal({
  open,
  mode,
  list,
  onClose,
}: ListFormModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<Element | null>(null)

  const createMutation = useCreateList()
  const updateMutation = useUpdateList()

  const initialValues = useMemo(
    () => (open ? getInitialValues(mode, list) : null),
    [open, mode, list]
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

    if (!form.name.trim()) {
      setFormError('Name is required.')
      return
    }

    try {
      const common = {
        name: form.name.trim(),
        category: form.category || undefined,
        priority: Number(form.priority),
        tag: form.tag.trim(),
      }
      if (mode === 'create') {
        await createMutation.mutateAsync(common as ListCreatePayload)
      } else if (list) {
        await updateMutation.mutateAsync({
          id: list.id,
          payload: common as ListUpdatePayload,
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
      id="list-form-dialog"
      ref={dialogRef}
      className="list-form-dialog"
      aria-labelledby="list-form-title"
      onClose={handleClose}
    >
      <h2 id="list-form-title" className="list-form-title">
        {mode === 'create' ? 'Add list' : 'Edit list'}
      </h2>
      <form id="list-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <p id="list-form-error" className="list-form-error" role="alert">
            {formError}
          </p>
        )}
        <div className="list-form-field">
          <label htmlFor="list-form-name-input">Name</label>
          <input
            id="list-form-name-input"
            type="text"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            required
            maxLength={200}
            disabled={submitting}
          />
        </div>
        <div className="list-form-field">
          <label htmlFor="list-form-category-input">Category (optional)</label>
          <select
            id="list-form-category-input"
            value={form.category}
            onChange={(e) => updateField('category', e.target.value)}
            disabled={submitting}
          >
            <option value="">No category</option>
            {Object.values(TaskCategory).map((cat) => (
              <option key={cat} value={cat}>
                {TASK_CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </div>
        <div className="list-form-field">
          <label htmlFor="list-form-priority-input">Priority</label>
          <select
            id="list-form-priority-input"
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
        <div className="list-form-field">
          <label htmlFor="list-form-tag-input">Tag (optional)</label>
          <input
            id="list-form-tag-input"
            type="text"
            value={form.tag}
            onChange={(e) => updateField('tag', e.target.value)}
            maxLength={255}
            disabled={submitting}
          />
        </div>
        <div className="list-form-actions">
          <button
            id="list-form-cancel-btn"
            type="button"
            className="list-form-cancel"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            id="list-form-submit-btn"
            type="submit"
            className="list-form-submit"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting
              ? 'Saving...'
              : mode === 'create'
                ? 'Add list'
                : 'Save changes'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
