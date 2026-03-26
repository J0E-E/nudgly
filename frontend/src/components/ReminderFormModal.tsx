/**
 * Reminder form modal: add or edit a standalone reminder via native <dialog>.
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import type { StandaloneReminder, StandaloneReminderCreatePayload, StandaloneReminderUpdatePayload } from '../types/standaloneReminder'
import { ReminderRecurrence, RECURRENCE_LABELS, DAY_OF_WEEK_LABELS, MONTH_LABELS } from '../types/standaloneReminder'
import { useCreateStandaloneReminder, useUpdateStandaloneReminder } from '../hooks/useStandaloneReminders'
import './ReminderFormModal.css'

interface ReminderFormModalProps {
  open: boolean
  mode: 'create' | 'edit'
  reminder?: StandaloneReminder
  onClose: () => void
}

interface FormValues {
  name: string
  type: 'one-time' | 'recurring'
  remindAt: string
  recurrence: string
  remindTime: string
  dayOfWeek: string
  dayOfMonth: string
  monthOfYear: string
}

const EMPTY_FORM: FormValues = {
  name: '',
  type: 'one-time',
  remindAt: '',
  recurrence: '',
  remindTime: '',
  dayOfWeek: '',
  dayOfMonth: '',
  monthOfYear: '',
}

function toDateTimeLocal(isoStr: string): string {
  const d = new Date(isoStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function getInitialValues(mode: 'create' | 'edit', reminder?: StandaloneReminder): FormValues {
  if (mode === 'edit' && reminder) {
    return {
      name: reminder.name,
      type: reminder.recurrence ? 'recurring' : 'one-time',
      remindAt: reminder.remind_at ? toDateTimeLocal(reminder.remind_at) : '',
      recurrence: reminder.recurrence || '',
      remindTime: reminder.remind_time || '',
      dayOfWeek: reminder.day_of_week != null ? String(reminder.day_of_week) : '',
      dayOfMonth: reminder.day_of_month != null ? String(reminder.day_of_month) : '',
      monthOfYear: reminder.month_of_year != null ? String(reminder.month_of_year) : '',
    }
  }
  return EMPTY_FORM
}

export function ReminderFormModal({
  open,
  mode,
  reminder,
  onClose,
}: ReminderFormModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<Element | null>(null)

  const createMutation = useCreateStandaloneReminder()
  const updateMutation = useUpdateStandaloneReminder()

  const initialValues = useMemo(
    () => (open ? getInitialValues(mode, reminder) : null),
    [open, mode, reminder]
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

  function updateField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
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
      if (form.type === 'one-time') {
        if (!form.remindAt) {
          setFormError('Date and time are required for one-time reminders.')
          return
        }
        const payload = {
          name: form.name.trim(),
          remind_at: new Date(form.remindAt).toISOString(),
          recurrence: null,
        }
        if (mode === 'create') {
          await createMutation.mutateAsync(payload as StandaloneReminderCreatePayload)
        } else if (reminder) {
          await updateMutation.mutateAsync({
            id: reminder.id,
            payload: payload as StandaloneReminderUpdatePayload,
          })
        }
      } else {
        if (!form.recurrence) {
          setFormError('Recurrence is required.')
          return
        }
        if (!form.remindTime) {
          setFormError('Time is required for recurring reminders.')
          return
        }
        if (form.recurrence === 'weekly' && form.dayOfWeek === '') {
          setFormError('Day of week is required for weekly reminders.')
          return
        }
        if ((form.recurrence === 'monthly' || form.recurrence === 'yearly') && form.dayOfMonth === '') {
          setFormError('Day of month is required.')
          return
        }
        if (form.recurrence === 'yearly' && form.monthOfYear === '') {
          setFormError('Month is required for yearly reminders.')
          return
        }

        const payload: Record<string, unknown> = {
          name: form.name.trim(),
          recurrence: form.recurrence,
          remind_time: form.remindTime,
          remind_at: null,
        }
        if (form.recurrence === 'weekly') {
          payload.day_of_week = Number(form.dayOfWeek)
        }
        if (form.recurrence === 'monthly' || form.recurrence === 'yearly') {
          payload.day_of_month = Number(form.dayOfMonth)
        }
        if (form.recurrence === 'yearly') {
          payload.month_of_year = Number(form.monthOfYear)
        }

        if (mode === 'create') {
          await createMutation.mutateAsync(payload as StandaloneReminderCreatePayload)
        } else if (reminder) {
          await updateMutation.mutateAsync({
            id: reminder.id,
            payload: payload as StandaloneReminderUpdatePayload,
          })
        }
      }
      handleClose()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  const submitting = createMutation.isPending || updateMutation.isPending

  return (
    <dialog
      id="reminder-form-dialog"
      ref={dialogRef}
      className="reminder-form-dialog"
      aria-labelledby="reminder-form-title"
      onClose={handleClose}
    >
      <h2 id="reminder-form-title" className="reminder-form-title">
        {mode === 'create' ? 'Add reminder' : 'Edit reminder'}
      </h2>
      <form id="reminder-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <p id="reminder-form-error" className="reminder-form-error" role="alert">
            {formError}
          </p>
        )}
        <div className="reminder-form-field">
          <label htmlFor="reminder-form-name-input">Name</label>
          <input
            id="reminder-form-name-input"
            type="text"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            required
            maxLength={200}
            disabled={submitting}
            placeholder="e.g. Fasting start, Show time"
          />
        </div>
        <div className="reminder-form-field">
          <label>Type</label>
          <div className="reminder-form-type-toggle">
            <button
              id="reminder-form-type-onetime"
              type="button"
              className={`reminder-form-type-btn${form.type === 'one-time' ? ' reminder-form-type-btn--active' : ''}`}
              onClick={() => updateField('type', 'one-time')}
              disabled={submitting}
            >
              One-time
            </button>
            <button
              id="reminder-form-type-recurring"
              type="button"
              className={`reminder-form-type-btn${form.type === 'recurring' ? ' reminder-form-type-btn--active' : ''}`}
              onClick={() => updateField('type', 'recurring')}
              disabled={submitting}
            >
              Recurring
            </button>
          </div>
        </div>
        {form.type === 'one-time' ? (
          <div className="reminder-form-field">
            <label htmlFor="reminder-form-datetime-input">Date & time</label>
            <input
              id="reminder-form-datetime-input"
              type="datetime-local"
              value={form.remindAt}
              onChange={(e) => updateField('remindAt', e.target.value)}
              disabled={submitting}
            />
          </div>
        ) : (
          <>
            <div className="reminder-form-field">
              <label htmlFor="reminder-form-recurrence-input">Repeat</label>
              <select
                id="reminder-form-recurrence-input"
                value={form.recurrence}
                onChange={(e) => updateField('recurrence', e.target.value)}
                required
                disabled={submitting}
              >
                <option value="" disabled>
                  Select frequency
                </option>
                {Object.values(ReminderRecurrence).map((r) => (
                  <option key={r} value={r}>
                    {RECURRENCE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="reminder-form-field">
              <label htmlFor="reminder-form-time-input">Time</label>
              <input
                id="reminder-form-time-input"
                type="time"
                value={form.remindTime}
                onChange={(e) => updateField('remindTime', e.target.value)}
                disabled={submitting}
              />
            </div>
            {form.recurrence === 'weekly' && (
              <div className="reminder-form-field">
                <label htmlFor="reminder-form-dow-input">Day of week</label>
                <select
                  id="reminder-form-dow-input"
                  value={form.dayOfWeek}
                  onChange={(e) => updateField('dayOfWeek', e.target.value)}
                  disabled={submitting}
                >
                  <option value="" disabled>
                    Select day
                  </option>
                  {Object.entries(DAY_OF_WEEK_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {(form.recurrence === 'monthly' || form.recurrence === 'yearly') && (
              <div className="reminder-form-field">
                <label htmlFor="reminder-form-dom-input">Day of month</label>
                <input
                  id="reminder-form-dom-input"
                  type="number"
                  min="1"
                  max="31"
                  value={form.dayOfMonth}
                  onChange={(e) => updateField('dayOfMonth', e.target.value)}
                  disabled={submitting}
                />
              </div>
            )}
            {form.recurrence === 'yearly' && (
              <div className="reminder-form-field">
                <label htmlFor="reminder-form-moy-input">Month</label>
                <select
                  id="reminder-form-moy-input"
                  value={form.monthOfYear}
                  onChange={(e) => updateField('monthOfYear', e.target.value)}
                  disabled={submitting}
                >
                  <option value="" disabled>
                    Select month
                  </option>
                  {Object.entries(MONTH_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}
        <div className="reminder-form-actions">
          <button
            id="reminder-form-cancel-btn"
            type="button"
            className="reminder-form-cancel"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            id="reminder-form-submit-btn"
            type="submit"
            className="reminder-form-submit"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting
              ? 'Saving...'
              : mode === 'create'
                ? 'Add reminder'
                : 'Save changes'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
