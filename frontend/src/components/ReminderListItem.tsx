/**
 * Single reminder row with tap-to-expand detail view.
 * Shows name, relative due time, snoozed badge.
 * Expanding reveals recurrence info, snooze presets, and action buttons.
 */

import { useState } from 'react'
import type { StandaloneReminder } from '../types/standaloneReminder'
import {
  RECURRENCE_LABELS,
  DAY_OF_WEEK_LABELS,
  MONTH_LABELS,
  SNOOZE_PRESETS,
  SNOOZE_PRESET_LABELS,
} from '../types/standaloneReminder'
import type { SnoozePreset } from '../types/standaloneReminder'
import './ReminderListItem.css'

interface ReminderListItemProps {
  reminder: StandaloneReminder
  onSnooze: (reminder: StandaloneReminder, minutes: SnoozePreset) => void
  onClear: (reminder: StandaloneReminder) => void
  onEdit: (reminder: StandaloneReminder) => void
  onDelete: (reminder: StandaloneReminder) => void
}

function formatRelativeTime(isoStr: string): string {
  const date = new Date(isoStr)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()

  if (diffMs < 0) {
    const pastMs = Math.abs(diffMs)
    const pastMins = Math.round(pastMs / 60_000)
    if (pastMins < 1) return 'Just now'
    if (pastMins < 60) return `${pastMins} min ago`
    const pastHours = Math.round(pastMs / 3_600_000)
    if (pastHours < 24) return `${pastHours}h ago`
    return formatDateTime(isoStr)
  }

  const diffMins = Math.round(diffMs / 60_000)
  if (diffMins < 1) return 'Any moment'
  if (diffMins < 60) return `In ${diffMins} min`

  const timeStr = formatTime12h(date.toTimeString().slice(0, 5))
  const todayDate = now.toDateString()
  const tomorrowDate = new Date(now.getTime() + 86_400_000).toDateString()
  const targetDate = date.toDateString()

  if (targetDate === todayDate) return `Today at ${timeStr}`
  if (targetDate === tomorrowDate) return `Tomorrow at ${timeStr}`
  return formatDateTime(isoStr) + ` at ${timeStr}`
}

function formatDateTime(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime12h(time24: string): string {
  const [hStr, mStr] = time24.split(':')
  const h = parseInt(hStr, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${mStr} ${ampm}`
}

function formatRecurrenceDetail(reminder: StandaloneReminder): string {
  if (!reminder.recurrence) return 'One-time'
  const label = RECURRENCE_LABELS[reminder.recurrence]
  const timeStr = reminder.remind_time ? formatTime12h(reminder.remind_time) : ''

  if (reminder.recurrence === 'weekly' && reminder.day_of_week != null) {
    return `${label} on ${DAY_OF_WEEK_LABELS[reminder.day_of_week]} at ${timeStr}`
  }
  if (reminder.recurrence === 'monthly' && reminder.day_of_month != null) {
    return `${label} on the ${ordinal(reminder.day_of_month)} at ${timeStr}`
  }
  if (
    reminder.recurrence === 'yearly' &&
    reminder.month_of_year != null &&
    reminder.day_of_month != null
  ) {
    return `${label} on ${MONTH_LABELS[reminder.month_of_year]} ${reminder.day_of_month} at ${timeStr}`
  }
  return `${label} at ${timeStr}`
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function ReminderListItem({
  reminder,
  onSnooze,
  onClear,
  onEdit,
  onDelete,
}: ReminderListItemProps) {
  const [expanded, setExpanded] = useState(false)
  const instance = reminder.latest_instance
  const isSnoozed = instance?.snoozed_until && new Date(instance.snoozed_until) > new Date()

  const dueTimeStr = instance
    ? formatRelativeTime(instance.due_at)
    : reminder.next_trigger_at
      ? formatRelativeTime(reminder.next_trigger_at)
      : reminder.remind_at
        ? formatRelativeTime(reminder.remind_at)
        : 'Not scheduled'

  return (
    <li
      id={`reminder-${reminder.id}`}
      className={`reminder-list-item${expanded ? ' reminder-list-item--expanded' : ''}`}
    >
      <button
        type="button"
        className="reminder-list-item-content"
        aria-expanded={expanded}
        aria-controls={`reminder-${reminder.id}-details`}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="reminder-list-item-content-text">
          <span
            id={`reminder-${reminder.id}-name`}
            className="reminder-list-item-name"
          >
            {reminder.name}
          </span>
          <div className="reminder-list-item-meta">
            <span className="reminder-list-item-due">{dueTimeStr}</span>
            {isSnoozed && (
              <span className="reminder-list-item-snoozed-badge">Snoozed</span>
            )}
            {reminder.recurrence && (
              <span className="reminder-list-item-recurrence">
                {RECURRENCE_LABELS[reminder.recurrence]}
              </span>
            )}
          </div>
        </div>
        <svg
          className="reminder-list-item-chevron"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M7 4l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        id={`reminder-${reminder.id}-details`}
        className="reminder-list-item-details"
        role="region"
        aria-labelledby={`reminder-${reminder.id}-name`}
        aria-hidden={!expanded}
      >
        <div className="reminder-list-item-details-inner">
          <p className="reminder-list-item-detail-row">
            <span className="reminder-list-item-detail-label">Schedule</span>
            <span>{formatRecurrenceDetail(reminder)}</span>
          </p>
          {instance && (
            <p className="reminder-list-item-detail-row">
              <span className="reminder-list-item-detail-label">Due</span>
              <span>{formatDateTime(instance.due_at)}</span>
            </p>
          )}
          {isSnoozed && instance?.snoozed_until && (
            <p className="reminder-list-item-detail-row">
              <span className="reminder-list-item-detail-label">Snoozed until</span>
              <span>{formatRelativeTime(instance.snoozed_until)}</span>
            </p>
          )}
          <p className="reminder-list-item-detail-row">
            <span className="reminder-list-item-detail-label">Created</span>
            <span>{formatDateTime(reminder.created_at)}</span>
          </p>
          {instance && (
            <div className="reminder-list-item-snooze-bar">
              <span className="reminder-list-item-detail-label">Snooze</span>
              <div className="reminder-list-item-snooze-presets">
                {SNOOZE_PRESETS.map((minutes) => (
                  <button
                    key={minutes}
                    id={`reminder-${reminder.id}-snooze-${minutes}`}
                    type="button"
                    className="reminder-list-item-snooze-btn"
                    onClick={() => onSnooze(reminder, minutes)}
                    aria-label={`Snooze "${reminder.name}" for ${SNOOZE_PRESET_LABELS[minutes]}`}
                  >
                    {SNOOZE_PRESET_LABELS[minutes]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="reminder-list-item-actions">
            {instance && (
              <button
                id={`reminder-${reminder.id}-clear-btn`}
                type="button"
                className="reminder-list-item-clear"
                onClick={() => onClear(reminder)}
                aria-label={`Clear "${reminder.name}"`}
              >
                Clear
              </button>
            )}
            <button
              id={`reminder-${reminder.id}-edit-btn`}
              type="button"
              className="reminder-list-item-edit"
              onClick={() => onEdit(reminder)}
              aria-label={`Edit "${reminder.name}"`}
            >
              Edit
            </button>
            <button
              id={`reminder-${reminder.id}-delete-btn`}
              type="button"
              className="reminder-list-item-delete"
              onClick={() => onDelete(reminder)}
              aria-label={`Delete "${reminder.name}"`}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}
