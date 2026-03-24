/**
 * Habit form modal: add or edit a habit via native <dialog>.
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import type { Habit, HabitCreatePayload, HabitUpdatePayload } from '../types/habit'
import { HabitFrequency, HABIT_FREQUENCY_LABELS } from '../types/habit'
import { useCreateHabit, useUpdateHabit } from '../hooks/useHabits'
import './HabitFormModal.css'

interface HabitFormModalProps {
  open: boolean
  mode: 'create' | 'edit'
  habit?: Habit
  onClose: () => void
}

interface FormValues {
  name: string
  frequency: string
  targetCount: string
  reminderTimes: string[]
}

const EMPTY_FORM: FormValues = {
  name: '',
  frequency: '',
  targetCount: '1',
  reminderTimes: [],
}

function getInitialValues(mode: 'create' | 'edit', habit?: Habit): FormValues {
  if (mode === 'edit' && habit) {
    return {
      name: habit.name,
      frequency: habit.frequency,
      targetCount: String(habit.target_count),
      reminderTimes: habit.reminder_times.length > 0 ? [...habit.reminder_times] : [],
    }
  }
  return EMPTY_FORM
}

const VALID_FREQUENCIES = new Set<string>(Object.values(HabitFrequency))

export function HabitFormModal({
  open,
  mode,
  habit,
  onClose,
}: HabitFormModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<Element | null>(null)

  const createMutation = useCreateHabit()
  const updateMutation = useUpdateHabit()

  const initialValues = useMemo(
    () => (open ? getInitialValues(mode, habit) : null),
    [open, mode, habit]
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

  function addReminderTime() {
    setForm((prev) => ({
      ...prev,
      reminderTimes: [...prev.reminderTimes, '08:00'],
    }))
  }

  function removeReminderTime(index: number) {
    setForm((prev) => ({
      ...prev,
      reminderTimes: prev.reminderTimes.filter((_, i) => i !== index),
    }))
  }

  function updateReminderTime(index: number, value: string) {
    setForm((prev) => ({
      ...prev,
      reminderTimes: prev.reminderTimes.map((t, i) =>
        i === index ? value : t
      ),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!form.name.trim()) {
      setFormError('Name is required.')
      return
    }
    if (!form.frequency || !VALID_FREQUENCIES.has(form.frequency)) {
      setFormError('Frequency is required.')
      return
    }
    const targetNum = Number(form.targetCount) || 1
    if (targetNum < 1 || targetNum > 31) {
      setFormError('Target must be between 1 and 31.')
      return
    }

    try {
      const common = {
        name: form.name.trim(),
        frequency: form.frequency as HabitFrequency,
        target_count: targetNum,
        reminder_times:
          form.reminderTimes.length > 0 ? form.reminderTimes : [],
      }
      if (mode === 'create') {
        await createMutation.mutateAsync(common as HabitCreatePayload)
      } else if (habit) {
        await updateMutation.mutateAsync({
          id: habit.id,
          payload: common as HabitUpdatePayload,
        })
      }
      handleClose()
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Something went wrong.'
      )
    }
  }

  const submitting = createMutation.isPending || updateMutation.isPending

  return (
    <dialog
      id="habit-form-dialog"
      ref={dialogRef}
      className="habit-form-dialog"
      aria-labelledby="habit-form-title"
      onClose={handleClose}
    >
      <h2 id="habit-form-title" className="habit-form-title">
        {mode === 'create' ? 'Add habit' : 'Edit habit'}
      </h2>
      <form id="habit-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <p id="habit-form-error" className="habit-form-error" role="alert">
            {formError}
          </p>
        )}
        <div className="habit-form-field">
          <label htmlFor="habit-form-name-input">Name</label>
          <input
            id="habit-form-name-input"
            type="text"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            required
            maxLength={200}
            disabled={submitting}
          />
        </div>
        <div className="habit-form-field">
          <label htmlFor="habit-form-frequency-input">Frequency</label>
          <select
            id="habit-form-frequency-input"
            value={form.frequency}
            onChange={(e) => updateField('frequency', e.target.value)}
            required
            disabled={submitting}
          >
            <option value="" disabled>
              Select frequency
            </option>
            {Object.values(HabitFrequency).map((freq) => (
              <option key={freq} value={freq}>
                {HABIT_FREQUENCY_LABELS[freq]}
              </option>
            ))}
          </select>
        </div>
        <div className="habit-form-field">
          <label htmlFor="habit-form-target-input">
            Target (times per period)
          </label>
          <input
            id="habit-form-target-input"
            type="number"
            min="1"
            max="31"
            value={form.targetCount}
            onChange={(e) => updateField('targetCount', e.target.value)}
            disabled={submitting}
          />
        </div>
        <div className="habit-form-field">
          <label>Reminder times</label>
          <div className="habit-form-reminder-list">
            {form.reminderTimes.map((t, i) => (
              <div key={i} className="habit-form-reminder-row">
                <input
                  type="time"
                  value={t}
                  onChange={(e) => updateReminderTime(i, e.target.value)}
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="habit-form-reminder-remove"
                  onClick={() => removeReminderTime(i)}
                  disabled={submitting}
                  aria-label={`Remove reminder at ${t}`}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="habit-form-add-reminder"
              onClick={addReminderTime}
              disabled={submitting}
            >
              + Add reminder time
            </button>
          </div>
        </div>
        <div className="habit-form-actions">
          <button
            id="habit-form-cancel-btn"
            type="button"
            className="habit-form-cancel"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            id="habit-form-submit-btn"
            type="submit"
            className="habit-form-submit"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting
              ? 'Saving...'
              : mode === 'create'
                ? 'Add habit'
                : 'Save changes'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
